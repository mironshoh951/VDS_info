'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import { revokeSessionById } from '@/server/modules/admin/security-centre'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { STEP_UP_SCOPES, type StepUpScope } from '@/server/auth/capabilities'

export interface SecurityActionResult {
  ok: boolean
  message?: string
  stepUp?: { scope: StepUpScope; mfaRequired: boolean }
}

export async function revokeSessionAction(input: {
  sessionId: string
  challengeToken?: string
}): Promise<SecurityActionResult> {
  const parsed = z
    .object({
      sessionId: z.string().uuid(),
      challengeToken: z.string().min(10).optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await revokeSessionById(
      actor,
      parsed.data.sessionId,
      parsed.data.challengeToken ?? null,
    )
    revalidatePath('/admin/security')
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
    logger.error({ err: error }, 'session revoke failed')
    return { ok: false, message: 'Something went wrong.' }
  }
}
