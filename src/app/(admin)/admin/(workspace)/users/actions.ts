'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import {
  createUser,
  changeUserRole,
  setUserStatus,
  resetUserPassword,
  deleteUser,
} from '@/server/modules/admin/users'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { STEP_UP_SCOPES, type StepUpScope } from '@/server/auth/capabilities'

export interface UserActionResult {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string>
  stepUp?: { scope: StepUpScope; mfaRequired: boolean }
}

function toResult(error: unknown): UserActionResult {
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
    if (error.code === 'VALIDATION_FAILED' && error.details) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of error.details) {
        fieldErrors[issue.field] = issue.message ?? issue.code
      }
      return { ok: false, message: error.message, fieldErrors }
    }
    return { ok: false, message: error.message }
  }
  logger.error({ err: error }, 'user action failed')
  return { ok: false, message: 'Something went wrong.' }
}

const uuid = z.string().uuid()
const token = z.string().min(10).optional()

export async function createUserAction(input: {
  name: string
  email: string
  password: string
  role: string
  challengeToken?: string
}): Promise<UserActionResult> {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(320),
      password: z.string().min(1).max(200),
      role: z.enum(['SUPER_ADMIN', 'VIEWER']),
      challengeToken: token,
    })
    .safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Check the name, email and password.' }
  }

  try {
    const actor = await getActor()
    await createUser(actor, {
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      role: parsed.data.role,
      challengeToken: parsed.data.challengeToken ?? null,
    })
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function changeRoleAction(input: {
  userId: string
  role: string
  challengeToken?: string
}): Promise<UserActionResult> {
  const parsed = z
    .object({
      userId: uuid,
      role: z.enum(['SUPER_ADMIN', 'VIEWER']),
      challengeToken: token,
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await changeUserRole(
      actor,
      parsed.data.userId,
      parsed.data.role,
      parsed.data.challengeToken ?? null,
    )
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function setStatusAction(input: {
  userId: string
  status: string
  challengeToken?: string
}): Promise<UserActionResult> {
  const parsed = z
    .object({
      userId: uuid,
      status: z.enum(['ACTIVE', 'SUSPENDED', 'LOCKED']),
      challengeToken: token,
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await setUserStatus(
      actor,
      parsed.data.userId,
      parsed.data.status,
      parsed.data.challengeToken ?? null,
    )
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function resetPasswordAction(input: {
  userId: string
  password: string
  challengeToken?: string
}): Promise<UserActionResult> {
  const parsed = z
    .object({ userId: uuid, password: z.string().min(1).max(200), challengeToken: token })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await resetUserPassword(
      actor,
      parsed.data.userId,
      parsed.data.password,
      parsed.data.challengeToken ?? null,
    )
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function deleteUserAction(input: {
  userId: string
  challengeToken?: string
}): Promise<UserActionResult> {
  const parsed = z.object({ userId: uuid, challengeToken: token }).safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await deleteUser(actor, parsed.data.userId, parsed.data.challengeToken ?? null)
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}
