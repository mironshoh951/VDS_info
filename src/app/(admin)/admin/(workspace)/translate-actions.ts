'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import { translateRecord } from '@/server/modules/ai/translate'
import { RESOURCES, type ResourceKey } from '@/server/modules/admin/resources'
import { LOCALES } from '@/i18n/config'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface TranslateActionResult {
  ok: boolean
  /** Locales that received a draft. */
  translated?: string[]
  /** Locales the model could not produce; the rest still went through. */
  skipped?: string[]
  /** Spend for this run, in USD, for the confirmation line. */
  costUsd?: number
  /** The drafted text, so the open editor can show it without a reload. */
  values?: Record<string, Record<string, unknown>>
  message?: string
}

const RESOURCE = z.enum(Object.keys(RESOURCES) as [ResourceKey, ...ResourceKey[]])

export async function translateRecordAction(input: {
  resourceKey: string
  id: string
  targetLocales?: string[]
}): Promise<TranslateActionResult> {
  const parsed = z
    .object({
      resourceKey: RESOURCE,
      id: z.string().uuid(),
      targetLocales: z.array(z.enum(LOCALES)).optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const outcome = await translateRecord(actor, parsed.data)

    revalidatePath(`/admin/${RESOURCES[parsed.data.resourceKey].path}/${parsed.data.id}`)

    return {
      ok: true,
      translated: outcome.translated.map((entry) => entry.locale),
      skipped: outcome.skipped,
      costUsd: outcome.costMicros / 1_000_000,
      values: outcome.values,
    }
  } catch (error) {
    // An AppError here is something the operator can act on — no API key, the
    // budget is spent, there is no English source text — so its message is
    // shown as written rather than replaced with a generic failure.
    if (isAppError(error)) return { ok: false, message: error.message }
    logger.error({ err: error }, 'AI translation failed')
    return { ok: false, message: 'Something went wrong.' }
  }
}
