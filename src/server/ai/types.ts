import type { AIProvider, AITaskType } from '@/server/db/generated/enums'

/**
 * The shape every AI provider is reduced to.
 *
 * Deliberately narrow. The application asks for a completion and gets text plus
 * a token count; it never sees a provider's own request or response type. That
 * is what makes swapping Groq for OpenAI a settings change rather than a
 * rewrite, and it is why the cost and budget logic can live in one place
 * instead of once per vendor.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  /** Upper bound on the reply. Providers differ on the name; this is ours. */
  maxOutputTokens?: number
  /** 0 for extraction and translation, higher only where variety is wanted. */
  temperature?: number
  /** Ask the provider for strict JSON where it supports it. */
  json?: boolean
  signal?: AbortSignal
}

export interface ChatResponse {
  text: string
  model: string
  inputTokens: number
  outputTokens: number
}

export interface AiProviderAdapter {
  readonly id: AIProvider
  readonly label: string
  /** Chat models this deployment is configured to call. */
  readonly chatModel: string
  /** False when no API key is configured — the caller reports it, not throws. */
  isConfigured(): boolean
  chat(request: ChatRequest): Promise<ChatResponse>
  /** Cost in USD micro-units, so the ledger never stores a float. */
  costMicros(input: { inputTokens: number; outputTokens: number }): number
}

export interface CompletionContext {
  taskType: AITaskType
  surface?: string
  userId?: string
  locale?: string
  entityType?: string
  entityId?: string
}
