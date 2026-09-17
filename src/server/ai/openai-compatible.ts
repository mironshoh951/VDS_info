import { getEnv } from '@/lib/env'
import { conflict, dependencyUnavailable } from '@/lib/errors'
import type { AiProviderAdapter, ChatRequest, ChatResponse } from './types'
import type { AIProvider } from '@/server/db/generated/enums'

/**
 * One adapter for every provider that speaks the OpenAI chat-completions
 * protocol — which, today, is OpenAI and Groq.
 *
 * Writing the Groq client separately would have meant two copies of the same
 * request building, the same error handling and the same token accounting,
 * differing only in a base URL. The protocol is the thing worth naming here,
 * not the vendor.
 */

export interface Pricing {
  /** USD per million input tokens. */
  inputPerMillion: number
  /** USD per million output tokens. */
  outputPerMillion: number
}

export interface OpenAiCompatibleOptions {
  id: AIProvider
  label: string
  baseUrl: string
  apiKey: string | undefined
  chatModel: string
  pricing: Pricing
}

interface CompletionPayload {
  choices?: { message?: { content?: string | null } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  model?: string
  error?: { message?: string; type?: string }
}

export class OpenAiCompatibleProvider implements AiProviderAdapter {
  readonly id: AIProvider
  readonly label: string
  readonly chatModel: string

  private readonly baseUrl: string
  private readonly apiKey: string | undefined
  private readonly pricing: Pricing

  constructor(options: OpenAiCompatibleOptions) {
    this.id = options.id
    this.label = options.label
    this.chatModel = options.chatModel
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.apiKey = options.apiKey
    this.pricing = options.pricing
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  costMicros({
    inputTokens,
    outputTokens,
  }: {
    inputTokens: number
    outputTokens: number
  }): number {
    const usd =
      (inputTokens / 1_000_000) * this.pricing.inputPerMillion +
      (outputTokens / 1_000_000) * this.pricing.outputPerMillion
    return Math.round(usd * 1_000_000)
  }

  /**
   * Model IDs that answer `/models` but cannot hold a conversation.
   *
   * A provider's model list is every model on the account — speech-to-text,
   * text-to-speech, moderation classifiers and chat models together — and the
   * API gives no field that separates them. Offering the unfiltered list to an
   * operator choosing a chat model is worse than offering nothing: the first
   * name alphabetically is usually a speech model, and picking it produces
   * "does not support chat completions", which reads like a second, unrelated
   * fault.
   */
  private static readonly NON_CHAT = [
    'whisper', // speech to text
    'orpheus', // text to speech
    'tts',
    'guard', // prompt-guard / safeguard moderation classifiers
    'embed',
    'rerank',
    'moderation',
  ]

  private looksLikeUnknownModel(status: number, detail: string | undefined): boolean {
    if (status !== 404 && status !== 400) return false
    const text = (detail ?? '').toLowerCase()
    return (
      text.includes('does not exist') ||
      text.includes('model_not_found') ||
      // The model is real but is an ASR/TTS/moderation model. Same cause from
      // the operator's point of view — the wrong name is configured — so it
      // gets the same answer.
      text.includes('does not support chat completions')
    )
  }

  /**
   * The chat models this key may call, best effort.
   *
   * Only ever used to improve an error message, so every failure here is
   * swallowed: a diagnostic that itself throws replaces one confusing message
   * with a worse one.
   */
  private async listChatModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) return []
      const payload = (await response.json()) as { data?: { id?: string }[] }
      return (payload.data ?? [])
        .map((entry) => entry.id)
        .filter((id): id is string => typeof id === 'string')
        .filter((id) => {
          const lower = id.toLowerCase()
          return !OpenAiCompatibleProvider.NON_CHAT.some((word) => lower.includes(word))
        })
        .sort()
        .slice(0, 25)
    } catch {
      return []
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.apiKey) {
      throw dependencyUnavailable(`${this.label} is not configured: no API key is set.`)
    }

    const env = getEnv()

    // Two ways to stop: the caller's own signal, and a deadline. Without the
    // deadline a hung provider connection holds a server action open until the
    // platform kills the request, and the operator sees a spinner rather than
    // an error.
    const timeout = AbortSignal.timeout(env.AI_REQUEST_TIMEOUT_MS)
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.chatModel,
          messages: request.messages,
          temperature: request.temperature ?? 0,
          max_tokens: request.maxOutputTokens ?? 2048,
          ...(request.json ? { response_format: { type: 'json_object' } } : {}),
        }),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw dependencyUnavailable(`${this.label} did not respond in time.`)
      }
      throw dependencyUnavailable(`${this.label} could not be reached.`)
    }

    const payload = (await response.json().catch(() => null)) as CompletionPayload | null

    if (!response.ok) {
      // The provider's own message is passed through for 4xx, because "model
      // not found" or "context length exceeded" is something the operator can
      // act on. A 5xx says nothing useful and is reported as unavailable.
      const detail = payload?.error?.message
      if (response.status === 429) {
        throw dependencyUnavailable(
          `${this.label} rate limit reached. Try again shortly.`,
        )
      }
      if (response.status >= 500) {
        throw dependencyUnavailable(`${this.label} is having trouble right now.`)
      }

      // Providers retire models on a few months' notice, and the resulting
      // message — "the model X does not exist or you do not have access to it"
      // — leaves the operator with nowhere to go. Asking the same API which
      // models this key *can* use turns it into an answer.
      if (this.looksLikeUnknownModel(response.status, detail)) {
        const available = await this.listChatModels()
        throw conflict(
          `"${this.chatModel}" is not a chat model this ${this.label} key can use. ` +
            (available.length > 0
              ? `Chat models available: ${available.join(', ')}. ` +
                `Set AI_CHAT_MODEL_${this.id} in .env to one of these and restart.`
              : `Set AI_CHAT_MODEL_${this.id} in .env to a chat model from the provider's list and restart.`),
        )
      }

      throw conflict(detail ?? `${this.label} rejected the request.`)
    }

    const text = payload?.choices?.[0]?.message?.content ?? ''
    if (!text.trim()) {
      throw dependencyUnavailable(`${this.label} returned an empty response.`)
    }

    return {
      text,
      model: payload?.model ?? this.chatModel,
      inputTokens: payload?.usage?.prompt_tokens ?? 0,
      outputTokens: payload?.usage?.completion_tokens ?? 0,
    }
  }
}
