import { isAppError, dependencyUnavailable } from '@/lib/errors'
import { getSettings } from '@/server/modules/settings/service'
import { provider, isProviderKey, type ProviderKey } from './providers'
import { assertWithinBudget, recordUsage } from './usage'
import type { ChatRequest, ChatResponse, CompletionContext } from './types'
import type { EntityType } from '@/server/db/generated/enums'

/**
 * The single way the application talks to a model.
 *
 * Routing, the budget check and the usage ledger all happen here, so no caller
 * can accidentally skip one. A feature that wants a completion asks for one; it
 * does not choose a vendor, price the call, or remember to write a row.
 */

type Route = 'chat' | 'translate'

async function routeFor(route: Route): Promise<ProviderKey> {
  const routing = await getSettings('ai.routing')
  const configured =
    route === 'translate' ? routing.translateProvider : routing.chatProvider
  const key = typeof configured === 'string' ? configured : ''
  return isProviderKey(key) ? key : 'groq'
}

export interface CompletionResult extends ChatResponse {
  providerKey: ProviderKey
  costMicros: number
}

export async function complete(
  request: ChatRequest,
  context: CompletionContext & { route?: Route },
): Promise<CompletionResult> {
  const key = await routeFor(context.route ?? 'chat')
  const adapter = provider(key)

  if (!adapter.isConfigured()) {
    throw dependencyUnavailable(
      `${adapter.label} is selected in Settings → AI but has no API key. ` +
        `Set the key in the environment and restart, or choose a different provider.`,
    )
  }

  await assertWithinBudget()

  const startedAt = Date.now()

  try {
    const response = await adapter.chat(request)
    const costMicros = adapter.costMicros(response)

    await recordUsage({
      taskType: context.taskType,
      provider: adapter.id,
      model: response.model,
      surface: context.surface,
      userId: context.userId,
      entityType: context.entityType as EntityType | undefined,
      entityId: context.entityId,
      locale: context.locale,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costMicros,
      latencyMs: Date.now() - startedAt,
      success: true,
    })

    return { ...response, providerKey: key, costMicros }
  } catch (error) {
    // A failed call is still recorded. Most providers bill for the input
    // tokens of a request that errors late, and a ledger that only counts
    // successes drifts from the invoice in the one direction that matters.
    await recordUsage({
      taskType: context.taskType,
      provider: adapter.id,
      model: adapter.chatModel,
      surface: context.surface,
      userId: context.userId,
      entityType: context.entityType as EntityType | undefined,
      entityId: context.entityId,
      locale: context.locale,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorCode: isAppError(error) ? error.code : 'INTERNAL',
    })
    throw error
  }
}

/**
 * Parses a JSON reply.
 *
 * Models wrap JSON in prose or a fenced code block often enough that trusting
 * `JSON.parse` on the raw text turns a good answer into an error. This takes
 * the outermost braces and parses those, which recovers the common cases
 * without accepting something that is not JSON at all.
 */
export function parseJsonReply<T>(text: string): T | null {
  const trimmed = text.trim()
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start === -1 || end <= start) return null

  try {
    return JSON.parse(fenced.slice(start, end + 1)) as T
  } catch {
    return null
  }
}
