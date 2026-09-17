import { getEnv } from '@/lib/env'
import { dependencyUnavailable } from '@/lib/errors'
import { OpenAiCompatibleProvider, type Pricing } from './openai-compatible'
import type { AiProviderAdapter } from './types'
import type { AIProvider } from '@/server/db/generated/enums'

/**
 * Which providers this deployment can call, and what they cost.
 *
 * Prices are listed per million tokens and are used only to keep the spend
 * ledger honest — they are not billing. Vendors change them, so a figure here
 * that has drifted makes the budget warning early or late, never wrong in a way
 * that charges anyone. They are stated explicitly rather than fetched because a
 * budget check that depends on a network call is a budget check that fails open.
 */

const PRICING: Record<string, Pricing> = {
  // Groq, Llama 3.3 70B Versatile.
  groq: { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  openai: { inputPerMillion: 2.0, outputPerMillion: 8.0 },
  anthropic: { inputPerMillion: 3.0, outputPerMillion: 15.0 },
}

/** Provider names as they appear in settings and environment variables. */
export const PROVIDER_KEYS = ['groq', 'openai', 'anthropic'] as const
export type ProviderKey = (typeof PROVIDER_KEYS)[number]

export function isProviderKey(value: string): value is ProviderKey {
  return (PROVIDER_KEYS as readonly string[]).includes(value)
}

const ENUM_BY_KEY: Record<ProviderKey, AIProvider> = {
  groq: 'GROQ',
  openai: 'OPENAI',
  anthropic: 'ANTHROPIC',
}

let cache: Map<ProviderKey, AiProviderAdapter> | null = null

function build(): Map<ProviderKey, AiProviderAdapter> {
  const env = getEnv()

  return new Map<ProviderKey, AiProviderAdapter>([
    [
      'groq',
      new OpenAiCompatibleProvider({
        id: ENUM_BY_KEY.groq,
        label: 'Groq',
        // Groq publishes an OpenAI-compatible surface at this path, which is
        // why it needs no adapter of its own.
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: env.GROQ_API_KEY,
        chatModel: env.AI_CHAT_MODEL_GROQ,
        pricing: PRICING.groq!,
      }),
    ],
    [
      'openai',
      new OpenAiCompatibleProvider({
        id: ENUM_BY_KEY.openai,
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: env.OPENAI_API_KEY,
        chatModel: env.AI_CHAT_MODEL_OPENAI,
        pricing: PRICING.openai!,
      }),
    ],
    [
      'anthropic',
      // Anthropic's own API is not OpenAI-shaped, but it publishes a
      // compatibility endpoint. Using it keeps one adapter instead of two; if
      // this deployment ever needs Anthropic-specific features, that is the
      // point to write a real adapter rather than now.
      new OpenAiCompatibleProvider({
        id: ENUM_BY_KEY.anthropic,
        label: 'Anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: env.ANTHROPIC_API_KEY,
        chatModel: env.AI_CHAT_MODEL_ANTHROPIC,
        pricing: PRICING.anthropic!,
      }),
    ],
  ])
}

export function providers(): Map<ProviderKey, AiProviderAdapter> {
  if (!cache) cache = build()
  return cache
}

export function provider(key: ProviderKey): AiProviderAdapter {
  const adapter = providers().get(key)
  if (!adapter) throw dependencyUnavailable(`Unknown AI provider: ${key}`)
  return adapter
}

/** Which providers actually have a key, for the settings screen to report. */
export function configuredProviders(): ProviderKey[] {
  return [...providers().entries()]
    .filter(([, adapter]) => adapter.isConfigured())
    .map(([key]) => key)
}

export function anyProviderConfigured(): boolean {
  return configuredProviders().length > 0
}
