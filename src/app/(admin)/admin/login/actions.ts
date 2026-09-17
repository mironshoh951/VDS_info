'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { login, completeMfa } from '@/server/auth/login'
import { setSessionCookies } from '@/server/auth/session'
import { getPendingMfaSession } from '@/server/auth/context'
import { getRequestContext } from '@/server/security/request-context'
import { getSettings } from '@/server/modules/settings/service'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

/**
 * Sign-in server actions.
 *
 * Errors are returned as state rather than thrown, so the form can render them
 * without losing what the user typed. The messages are deliberately generic —
 * the detail is in the audit log, not on screen.
 */

export interface LoginFormState {
  status: 'idle' | 'error' | 'mfa_required'
  message?: string
}

const credentialsSchema = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
})

const codeSchema = z.object({
  code: z.string().trim().min(6).max(12),
})

async function issuerName(): Promise<string> {
  const general = await getSettings('site.general')
  return general.siteName || 'VDS Administration'
}

export async function loginAction(
  _previous: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { status: 'error', message: 'Enter your email address and password.' }
  }

  const context = await getRequestContext()

  try {
    const outcome = await login({
      email: parsed.data.email,
      password: parsed.data.password,
      host: context.host,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    })

    await setSessionCookies(outcome.session)

    if (outcome.status === 'mfa_required') {
      return { status: 'mfa_required' }
    }
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'error', message: error.message }
    }
    logger.error({ err: error }, 'unexpected login failure')
    // In local development surface the underlying cause — a missing migration
    // or an unreachable database is otherwise indistinguishable from a real
    // outage. Production keeps the opaque message so nothing leaks.
    if (process.env.NODE_ENV === 'development') {
      const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
      return { status: 'error', message: `Sign-in failed (dev): ${detail}` }
    }
    return { status: 'error', message: 'Sign-in is temporarily unavailable.' }
  }

  redirect('/admin/dashboard')
}

export async function verifyMfaAction(
  _previous: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = codeSchema.safeParse({ code: formData.get('code') })
  if (!parsed.success) {
    return { status: 'mfa_required', message: 'Enter the 6-digit code from your app.' }
  }

  const pending = await getPendingMfaSession()
  if (!pending) {
    return {
      status: 'error',
      message: 'Your sign-in attempt expired. Please start again.',
    }
  }

  const context = await getRequestContext()

  try {
    const rotated = await completeMfa({
      userId: pending.user.id,
      sessionId: pending.id,
      email: pending.user.email,
      code: parsed.data.code,
      issuer: await issuerName(),
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    })
    await setSessionCookies(rotated)
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'mfa_required', message: error.message }
    }
    logger.error({ err: error }, 'unexpected mfa failure')
    return { status: 'mfa_required', message: 'Verification is temporarily unavailable.' }
  }

  redirect('/admin/dashboard')
}
