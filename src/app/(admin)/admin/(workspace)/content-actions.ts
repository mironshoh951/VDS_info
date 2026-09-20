'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import { createStepUpChallenge } from '@/server/auth/step-up'
import { getRequestContext } from '@/server/security/request-context'
import { getSettings } from '@/server/modules/settings/service'
import {
  setStatus,
  setFeatured,
  softDelete,
  restore,
  permanentlyDelete,
  bulkOperation,
  type BulkOperation,
} from '@/server/modules/admin/content-service'
import {
  RESOURCE_KEYS,
  RESOURCES,
  type ResourceKey,
} from '@/server/modules/admin/resources'
import { STEP_UP_SCOPES, type StepUpScope } from '@/server/auth/capabilities'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

/**
 * Server actions behind the administration lists.
 *
 * Each returns a result object rather than throwing, so the UI can show a
 * precise message — including the 428 that asks for password confirmation —
 * without the page falling into an error boundary.
 *
 * Note what these actions do *not* do: none of them contains an authorization
 * check of its own. They delegate to the content service, which is the single
 * place the rule lives; an action that forgot to check would still be refused.
 */

export interface ActionResult {
  ok: boolean
  message?: string
  /** Present when the action needs password confirmation first. */
  stepUp?: { scope: StepUpScope; mfaRequired: boolean }
}

const resourceSchema = z.enum(RESOURCE_KEYS as [ResourceKey, ...ResourceKey[]])
const idSchema = z.string().uuid()

function toResult(error: unknown): ActionResult {
  if (isAppError(error)) {
    if (error.code === 'STEP_UP_REQUIRED') {
      const meta = error.meta as { scope?: string; mfaRequired?: boolean } | undefined
      const scope = STEP_UP_SCOPES.find((value) => value === meta?.scope)
      return {
        ok: false,
        message: error.message,
        ...(scope ? { stepUp: { scope, mfaRequired: Boolean(meta?.mfaRequired) } } : {}),
      }
    }
    return { ok: false, message: error.message }
  }

  logger.error({ err: error }, 'unexpected failure in a content action')
  return { ok: false, message: 'Something went wrong. Please try again.' }
}

function refresh(resourceKey: ResourceKey): void {
  revalidatePath(`/admin/${RESOURCES[resourceKey].path}`)
}

export async function changeStatusAction(input: {
  resource: string
  id: string
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED'
}): Promise<ActionResult> {
  const parsed = z
    .object({
      resource: resourceSchema,
      id: idSchema,
      status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await setStatus(parsed.data.resource, parsed.data.id, parsed.data.status, { actor })
    refresh(parsed.data.resource)
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function toggleFeaturedAction(input: {
  resource: string
  id: string
  featured: boolean
}): Promise<ActionResult> {
  const parsed = z
    .object({ resource: resourceSchema, id: idSchema, featured: z.boolean() })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await setFeatured(parsed.data.resource, parsed.data.id, parsed.data.featured, {
      actor,
    })
    refresh(parsed.data.resource)
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function trashAction(input: {
  resource: string
  id: string
}): Promise<ActionResult> {
  const parsed = z.object({ resource: resourceSchema, id: idSchema }).safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await softDelete(parsed.data.resource, parsed.data.id, { actor })
    refresh(parsed.data.resource)
    revalidatePath('/admin/trash')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function restoreAction(input: {
  resource: string
  id: string
}): Promise<ActionResult> {
  const parsed = z.object({ resource: resourceSchema, id: idSchema }).safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await restore(parsed.data.resource, parsed.data.id, { actor })
    refresh(parsed.data.resource)
    revalidatePath('/admin/trash')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function permanentDeleteAction(input: {
  resource: string
  id: string
  challengeToken?: string
}): Promise<ActionResult> {
  const parsed = z
    .object({
      resource: resourceSchema,
      id: idSchema,
      challengeToken: z.string().min(10).optional(),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await permanentlyDelete(parsed.data.resource, parsed.data.id, {
      actor,
      challengeToken: parsed.data.challengeToken ?? null,
    })
    refresh(parsed.data.resource)
    revalidatePath('/admin/trash')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function bulkAction(input: {
  resource: string
  ids: string[]
  operation: BulkOperation
}): Promise<ActionResult & { succeeded?: number; failed?: number }> {
  const parsed = z
    .object({
      resource: resourceSchema,
      ids: z.array(idSchema).min(1).max(500),
      operation: z.enum([
        'publish',
        'unpublish',
        'archive',
        'feature',
        'unfeature',
        'delete',
        'translate',
      ]),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const result = await bulkOperation(
      parsed.data.resource,
      parsed.data.ids,
      parsed.data.operation,
      { actor },
    )
    refresh(parsed.data.resource)
    return {
      ok: result.failed.length === 0,
      succeeded: result.succeeded,
      failed: result.failed.length,
      ...(result.failed.length > 0
        ? { message: `${result.succeeded} updated, ${result.failed.length} failed.` }
        : {}),
    }
  } catch (error) {
    return toResult(error)
  }
}

/**
 * Exchanges a password (and TOTP, when enrolled) for a single-use challenge
 * token scoped to one kind of destructive action (§7).
 */
export async function requestStepUpAction(input: {
  scope: string
  password: string
  totpCode?: string
}): Promise<{ ok: boolean; token?: string; message?: string }> {
  const parsed = z
    .object({
      scope: z.enum(STEP_UP_SCOPES as unknown as [string, ...string[]]),
      password: z.string().min(1).max(200),
      totpCode: z.string().trim().min(6).max(12).optional(),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Enter your password to continue.' }

  try {
    const actor = await getActor()
    if (actor.kind !== 'user') return { ok: false, message: 'Your session has expired.' }

    const [context, general] = await Promise.all([
      getRequestContext(),
      getSettings('site.general'),
    ])

    const challenge = await createStepUpChallenge({
      userId: actor.userId,
      sessionId: actor.sessionId,
      email: actor.email,
      scope: parsed.data.scope as StepUpScope,
      password: parsed.data.password,
      ...(parsed.data.totpCode ? { totpCode: parsed.data.totpCode } : {}),
      issuer: general.siteName || 'VDS Administration',
      ip: context.ip,
      userAgent: context.userAgent,
    })

    return { ok: true, token: challenge.challengeToken }
  } catch (error) {
    const result = toResult(error)
    return { ok: false, ...(result.message ? { message: result.message } : {}) }
  }
}
