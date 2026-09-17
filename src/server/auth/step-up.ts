import { db } from '@/server/db/client'
import { randomToken, sha256 } from '@/lib/ids'
import { verifyPassword } from './password'
import { verifyMfa } from './mfa'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { recordSecurityEvent } from '@/server/security/security-events'
import { forbidden, unauthenticated } from '@/lib/errors'
import type { StepUpScope } from './capabilities'

/**
 * Step-up re-authentication (§7).
 *
 * Being logged in is not enough to do something destructive. The user proves
 * possession of the password (and MFA, when enrolled) for a *named scope*, and
 * receives a single-use, short-lived challenge token. The token is consumed by
 * the use-case that performs the action.
 *
 * Scoping matters: a confirmation given to delete a product cannot be replayed
 * to change security settings.
 */

export const STEP_UP_TTL_MS = 5 * 60 * 1000

export interface StepUpRequest {
  userId: string
  sessionId: string
  email: string
  scope: StepUpScope
  password: string
  totpCode?: string
  issuer: string
  ip?: string | null
  userAgent?: string | null
}

export interface StepUpResult {
  challengeToken: string
  expiresAt: Date
}

export async function createStepUpChallenge(
  request: StepUpRequest,
): Promise<StepUpResult> {
  await enforceRateLimit('auth.stepUp', request.userId)

  const user = await db.user.findUnique({
    where: { id: request.userId },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      mfaCredentials: { where: { confirmedAt: { not: null } }, select: { id: true } },
    },
  })

  if (!user || user.status !== 'ACTIVE') {
    throw unauthenticated('Session is no longer valid.')
  }

  const passwordOk = await verifyPassword(user.passwordHash, request.password)
  if (!passwordOk) {
    await recordSecurityEvent({
      type: 'STEP_UP_FAILURE',
      userId: user.id,
      severity: 'warning',
      message: `Step-up password check failed for scope "${request.scope}".`,
      metadata: { scope: request.scope },
      ip: request.ip,
      userAgent: request.userAgent,
    })
    throw forbidden('That password is not correct.')
  }

  let mfaUsed = false
  if (user.mfaCredentials.length > 0) {
    if (!request.totpCode) {
      throw forbidden('A verification code is required.')
    }
    const mfa = await verifyMfa(user.id, request.email, request.totpCode, request.issuer)
    if (!mfa.ok) {
      await recordSecurityEvent({
        type: 'STEP_UP_FAILURE',
        userId: user.id,
        severity: 'warning',
        message: `Step-up MFA check failed for scope "${request.scope}".`,
        metadata: { scope: request.scope, reason: mfa.reason },
        ip: request.ip,
        userAgent: request.userAgent,
      })
      throw forbidden('That verification code is not valid.')
    }
    mfaUsed = true
  }

  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + STEP_UP_TTL_MS)

  await db.stepUpChallenge.create({
    data: {
      userId: user.id,
      sessionId: request.sessionId,
      tokenHash: sha256(token),
      scope: request.scope,
      mfaUsed,
      expiresAt,
    },
  })

  await recordSecurityEvent({
    type: 'STEP_UP_SUCCESS',
    userId: user.id,
    severity: 'info',
    message: `Step-up confirmed for scope "${request.scope}".`,
    metadata: { scope: request.scope, mfaUsed },
    ip: request.ip,
    userAgent: request.userAgent,
  })

  return { challengeToken: token, expiresAt }
}

/**
 * Consumes a challenge. Single use: the row is marked consumed in the same
 * update that reads it, so two concurrent requests cannot both succeed.
 */
export async function consumeStepUpChallenge(input: {
  token: string
  userId: string
  sessionId: string
  scope: StepUpScope
}): Promise<{ mfaUsed: boolean }> {
  const tokenHash = sha256(input.token)

  const result = await db.stepUpChallenge.updateMany({
    where: {
      tokenHash,
      userId: input.userId,
      sessionId: input.sessionId,
      scope: input.scope,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  })

  if (result.count !== 1) {
    throw forbidden('This confirmation has expired or was already used.')
  }

  const challenge = await db.stepUpChallenge.findFirst({
    where: { tokenHash },
    select: { mfaUsed: true },
  })

  return { mfaUsed: challenge?.mfaUsed ?? false }
}

/** Housekeeping for expired challenges. */
export async function purgeExpiredChallenges(): Promise<number> {
  const result = await db.stepUpChallenge.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  })
  return result.count
}
