'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import { updateSetting } from '@/server/modules/settings/service'
import {
  settingsRegistry,
  type SettingsNamespace,
} from '@/server/modules/settings/registry'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { STEP_UP_SCOPES, type StepUpScope } from '@/server/auth/capabilities'
import type { StepUpReceipt } from '@/server/auth/guard'

export interface SettingsActionResult {
  ok: boolean
  message?: string
  stepUp?: { scope: StepUpScope; mfaRequired: boolean }
}

const NAMESPACES = Object.keys(settingsRegistry) as SettingsNamespace[]

/**
 * Saves one setting.
 *
 * Values arrive as JSON from the client and are validated against the
 * registry's Zod schema inside the service, so a hand-crafted request cannot
 * write a shape the application does not expect.
 */
export async function saveSettingAction(input: {
  namespace: string
  key: string
  value: unknown
  localized?: Record<string, unknown>
  challengeToken?: string
}): Promise<SettingsActionResult> {
  const parsed = z
    .object({
      namespace: z.enum(NAMESPACES as [SettingsNamespace, ...SettingsNamespace[]]),
      key: z.string().min(1).max(100),
      value: z.unknown(),
      localized: z.record(z.string(), z.unknown()).optional(),
      challengeToken: z.string().min(10).optional(),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await updateSetting(actor, {
      namespace: parsed.data.namespace,
      key: parsed.data.key,
      value: parsed.data.value,
      ...(parsed.data.localized ? { localized: parsed.data.localized } : {}),
      challengeToken: parsed.data.challengeToken ?? null,
    })

    revalidatePath('/admin/settings')
    // Settings feed the public layout, so its cached renders must go too.
    revalidatePath('/[locale]', 'layout')
    return { ok: true }
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === 'STEP_UP_REQUIRED') {
        const meta = error.meta as { scope?: string; mfaRequired?: boolean } | undefined
        const scope = STEP_UP_SCOPES.find((value) => value === meta?.scope)
        return {
          ok: false,
          message: error.message,
          ...(scope
            ? { stepUp: { scope, mfaRequired: Boolean(meta?.mfaRequired) } }
            : {}),
        }
      }
      return { ok: false, message: error.message }
    }
    logger.error({ err: error }, 'setting save failed')
    return { ok: false, message: 'Something went wrong.' }
  }
}

export interface SettingChange {
  namespace: string
  key: string
  value: unknown
  localized?: Record<string, unknown>
}

/**
 * Saves a whole group at once.
 *
 * Settings within a group are usually changed together — a site name and its
 * tagline, a maintenance flag and the message shown while it is on — and
 * confirming a password once per field turns a two-minute edit into a dozen
 * prompts. One confirmation covers the batch.
 *
 * Each value still goes through `updateSetting` individually, so validation
 * and the audit trail stay per-setting: the log continues to show exactly
 * which value changed from what to what, which is the property that makes it
 * worth reading.
 *
 * The confirmation token, though, can only be spent once. Handing it to every
 * write in the loop meant the first succeeded and the second came back with
 * "this confirmation has expired or was already used" — with some of the group
 * saved and some not. The first write now returns a receipt and the rest carry
 * that instead of the token.
 */
export async function saveSettingsBatchAction(input: {
  changes: SettingChange[]
  challengeToken?: string
}): Promise<SettingsActionResult & { savedKeys?: string[] }> {
  const parsed = z
    .object({
      changes: z
        .array(
          z.object({
            namespace: z.enum(NAMESPACES as [SettingsNamespace, ...SettingsNamespace[]]),
            key: z.string().min(1).max(100),
            value: z.unknown(),
            localized: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .min(1)
        .max(60),
      challengeToken: z.string().min(10).optional(),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  const actor = await getActor()
  const savedKeys: string[] = []
  let stepUp: StepUpReceipt | null = null

  for (const change of parsed.data.changes) {
    try {
      const outcome = await updateSetting(actor, {
        namespace: change.namespace,
        key: change.key,
        value: change.value,
        ...(change.localized ? { localized: change.localized } : {}),
        // The token on the first write only; after that the receipt it
        // produced stands in for it.
        ...(stepUp ? { stepUp } : { challengeToken: parsed.data.challengeToken ?? null }),
      })
      stepUp = outcome.receipt ?? stepUp
      savedKeys.push(`${change.namespace}.${change.key}`)
    } catch (error) {
      if (isAppError(error)) {
        if (error.code === 'STEP_UP_REQUIRED') {
          const meta = error.meta as { scope?: string; mfaRequired?: boolean } | undefined
          const scope = STEP_UP_SCOPES.find((value) => value === meta?.scope)
          // This can only fire on the first change, before anything is written,
          // so the client can safely re-send the whole batch with a token.
          return {
            ok: false,
            message: error.message,
            savedKeys,
            ...(scope
              ? { stepUp: { scope, mfaRequired: Boolean(meta?.mfaRequired) } }
              : {}),
          }
        }
        return { ok: false, message: error.message, savedKeys }
      }
      logger.error({ err: error, key: change.key }, 'setting batch save failed')
      return { ok: false, message: 'Something went wrong.', savedKeys }
    }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/[locale]', 'layout')
  return { ok: true, savedKeys }
}
