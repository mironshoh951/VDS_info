import { db } from '@/server/db/client'
import { logger } from '@/lib/logger'
import { budgetExceeded } from '@/lib/errors'
import { getSettings } from '@/server/modules/settings/service'
import type { AIProvider, AITaskType, EntityType } from '@/server/db/generated/enums'

/**
 * The spend ledger and the cap on it (§7.3).
 *
 * Every call is written to `AIUsage`, successes and failures alike. A failed
 * call still consumed input tokens at most providers, and a month where the
 * bill and the ledger disagree is a month nobody trusts the ledger again.
 *
 * Cost is stored in USD micro-units. Money in floating point accumulates error
 * across thousands of rows, and the one number this table exists to produce is
 * a sum.
 */

export interface UsageRecord {
  taskType: AITaskType
  provider: AIProvider
  model: string
  surface?: string
  userId?: string
  entityType?: EntityType
  entityId?: string
  locale?: string
  inputTokens: number
  outputTokens: number
  costMicros: number
  latencyMs?: number
  cached?: boolean
  success: boolean
  errorCode?: string
}

export async function recordUsage(entry: UsageRecord): Promise<void> {
  try {
    await db.aIUsage.create({
      data: {
        taskType: entry.taskType,
        provider: entry.provider,
        model: entry.model,
        surface: entry.surface ?? null,
        userId: entry.userId ?? null,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        locale: entry.locale ?? null,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        costMicros: entry.costMicros,
        latencyMs: entry.latencyMs ?? null,
        cached: entry.cached ?? false,
        success: entry.success,
        errorCode: entry.errorCode ?? null,
      },
    })
  } catch (error) {
    // The ledger must never be the reason a completed translation is lost. A
    // missing row is a reporting gap; a thrown error here would discard work
    // the provider has already been paid for.
    logger.error({ err: error }, 'Failed to record AI usage')
  }
}

function startOfMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export interface BudgetState {
  limitUsd: number
  spentUsd: number
  percentUsed: number
  warn: boolean
  /** True when the cap is reached and `hardStop` is on. */
  blocked: boolean
  hardStop: boolean
}

export async function budgetState(): Promise<BudgetState> {
  const settings = await getSettings('ai.budget')
  const limitUsd = Number(settings.monthlyLimitUsd ?? 0)
  const warnAt = Number(settings.warnAtPercent ?? 70)
  const hardStop = Boolean(settings.hardStop)

  const aggregate = await db.aIUsage.aggregate({
    _sum: { costMicros: true },
    where: { createdAt: { gte: startOfMonth() } },
  })

  const spentUsd = (aggregate._sum.costMicros ?? 0) / 1_000_000
  // A limit of zero means "no cap", not "spend nothing" — otherwise a fresh
  // install with an unset budget would report every call as over budget.
  const percentUsed = limitUsd > 0 ? (spentUsd / limitUsd) * 100 : 0

  return {
    limitUsd,
    spentUsd,
    percentUsed,
    warn: limitUsd > 0 && percentUsed >= warnAt,
    blocked: limitUsd > 0 && hardStop && spentUsd >= limitUsd,
    hardStop,
  }
}

/**
 * Checked before a call, not after.
 *
 * The cap is a month's spend, and a single request cannot be priced before it
 * runs, so this stops the next call once the line is crossed rather than
 * pretending to predict it. That means the cap can be overshot by one request —
 * which is the honest trade for not refusing work on a guess.
 */
export async function assertWithinBudget(): Promise<BudgetState> {
  const state = await budgetState()
  if (state.blocked) {
    throw budgetExceeded(
      `The monthly AI budget of $${state.limitUsd.toFixed(2)} is used up. ` +
        'Raise it in Settings → AI, or wait for the next month.',
    )
  }
  return state
}
