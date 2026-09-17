import { db } from '@/server/db/client'
import { verifyPassword, fakeVerify } from './password'
import { createSession, rotateSession, type CreatedSession } from './session'
import { verifyMfa } from './mfa'
import { enforceRateLimit, resetRateLimit } from '@/server/security/rate-limit'
import { recordSecurityEvent } from '@/server/security/security-events'
import { recordAudit } from '@/server/security/audit'
import { AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

/**
 * Admin authentication (§6).
 *
 * Design points that matter:
 *
 *  - **No account enumeration.** An unknown email performs a dummy Argon2
 *    verification and returns the same generic message as a wrong password,
 *    with comparable timing.
 *  - **Two limiters.** Per-IP stops a single attacker; per-account stops a
 *    distributed attack against one inbox.
 *  - **Lockout is persisted on the user**, so it survives a Redis restart.
 *  - **MFA is a separate step** that grants no authorization until completed.
 */

const MAX_FAILURES_BEFORE_LOCK = 10
const LOCK_DURATION_MS = 30 * 60 * 1000

export interface LoginInput {
  email: string
  password: string
  host: string
  ip: string | null
  userAgent: string | null
  requestId: string | null
}

export type LoginOutcome =
  | { status: 'success'; session: CreatedSession; userId: string }
  | { status: 'mfa_required'; session: CreatedSession; userId: string }

const GENERIC_FAILURE = 'Email or password is incorrect.'

export async function login(input: LoginInput): Promise<LoginOutcome> {
  const email = input.email.trim().toLowerCase()

  await enforceRateLimit('auth.login.ip', input.ip ?? 'unknown')
  await enforceRateLimit('auth.login.account', email)

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      role: true,
      status: true,
      failedLoginCount: true,
      lockedUntil: true,
      mfaCredentials: { where: { confirmedAt: { not: null } }, select: { id: true } },
    },
  })

  if (!user) {
    // Equalise timing with the real path so a missing account is not detectable.
    await fakeVerify(input.password)
    await recordFailure(null, email, input, 'unknown_account')
    throw new AppError('UNAUTHENTICATED', GENERIC_FAILURE)
  }

  const now = new Date()

  if (user.lockedUntil && user.lockedUntil > now) {
    await recordFailure(user.id, email, input, 'locked')
    throw new AppError(
      'UNAUTHENTICATED',
      'This account is temporarily locked. Try again later or contact an administrator.',
    )
  }

  if (user.status !== 'ACTIVE') {
    await recordFailure(user.id, email, input, `status_${user.status.toLowerCase()}`)
    throw new AppError('UNAUTHENTICATED', GENERIC_FAILURE)
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password)

  if (!passwordOk) {
    const failures = user.failedLoginCount + 1
    const shouldLock = failures >= MAX_FAILURES_BEFORE_LOCK

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failures,
        ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) } : {}),
      },
    })

    await recordFailure(user.id, email, input, 'bad_password')

    if (shouldLock) {
      await recordSecurityEvent({
        type: 'ACCOUNT_LOCKED',
        userId: user.id,
        severity: 'critical',
        message: `Account locked after ${failures} failed sign-in attempts.`,
        metadata: { failures },
        ip: input.ip,
        userAgent: input.userAgent,
      })
      logger.warn({ userId: user.id }, 'account locked after repeated failures')
    }

    throw new AppError('UNAUTHENTICATED', GENERIC_FAILURE)
  }

  // Password accepted — reset counters and limiters.
  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: now,
      lastLoginIp: input.ip,
    },
  })
  await resetRateLimit('auth.login.account', email)

  const mfaEnrolled = user.mfaCredentials.length > 0

  const session = await createSession({
    userId: user.id,
    host: input.host,
    ip: input.ip,
    userAgent: input.userAgent,
    mfaSatisfied: !mfaEnrolled,
  })

  await db.loginAttempt.create({
    data: {
      userId: user.id,
      email,
      success: true,
      ip: input.ip,
      userAgent: input.userAgent,
      host: input.host,
    },
  })

  await recordSecurityEvent({
    type: 'LOGIN_SUCCESS',
    userId: user.id,
    severity: 'info',
    message: mfaEnrolled ? 'Password accepted; awaiting MFA.' : 'Signed in.',
    ip: input.ip,
    userAgent: input.userAgent,
  })

  await recordAudit({
    actor: { id: user.id, role: user.role, label: `${user.name} <${user.email}>` },
    action: 'auth.login',
    context: { ip: input.ip, userAgent: input.userAgent, requestId: input.requestId },
  })

  return mfaEnrolled
    ? { status: 'mfa_required', session, userId: user.id }
    : { status: 'success', session, userId: user.id }
}

export interface CompleteMfaInput {
  userId: string
  sessionId: string
  email: string
  code: string
  issuer: string
  ip: string | null
  userAgent: string | null
  requestId: string | null
}

/**
 * Second factor. On success the session token is rotated, which invalidates
 * anything an attacker might have captured during the first step.
 */
export async function completeMfa(input: CompleteMfaInput): Promise<CreatedSession> {
  await enforceRateLimit('auth.mfa', input.userId)

  const result = await verifyMfa(input.userId, input.email, input.code, input.issuer)

  if (!result.ok) {
    await recordSecurityEvent({
      type: 'MFA_FAILURE',
      userId: input.userId,
      severity: 'warning',
      message: 'Multi-factor verification failed.',
      metadata: { reason: result.reason },
      ip: input.ip,
      userAgent: input.userAgent,
    })
    throw new AppError('UNAUTHENTICATED', 'That verification code is not valid.')
  }

  if (result.usedRecoveryCode) {
    await recordSecurityEvent({
      type: 'RECOVERY_CODE_USED',
      userId: input.userId,
      severity: 'warning',
      message: 'A recovery code was used to sign in.',
      ip: input.ip,
      userAgent: input.userAgent,
    })
  }

  const rotated = await rotateSession(input.sessionId, { markMfaSatisfied: true })

  await recordAudit({
    actor: { id: input.userId, role: null, label: input.email },
    action: 'auth.mfa_completed',
    context: { ip: input.ip, userAgent: input.userAgent, requestId: input.requestId },
  })

  return rotated
}

async function recordFailure(
  userId: string | null,
  email: string,
  input: LoginInput,
  reason: string,
): Promise<void> {
  await db.loginAttempt.create({
    data: {
      userId,
      email,
      success: false,
      reason,
      ip: input.ip,
      userAgent: input.userAgent,
      host: input.host,
    },
  })

  await recordSecurityEvent({
    type: 'LOGIN_FAILURE',
    userId,
    severity: 'info',
    message: `Sign-in failed (${reason}).`,
    metadata: { reason },
    ip: input.ip,
    userAgent: input.userAgent,
  })
}
