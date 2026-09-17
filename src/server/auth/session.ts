import { cookies } from 'next/headers'
import { db, dbRaw } from '@/server/db/client'
import { getRedis, redisAvailable } from '@/server/cache/redis'
import { randomToken, sha256 } from '@/lib/ids'
import { logger } from '@/lib/logger'
import {
  SESSION_COOKIE,
  CSRF_COOKIE_NAME,
  sessionCookieAttributes,
  csrfCookieAttributes,
  clearedCookieAttributes,
} from './cookies'
import { issueCsrfToken } from '@/server/security/csrf'
import type { UserRole, UserStatus } from '@/server/db/generated/enums'

/**
 * Server-side session management.
 *
 * Sessions are opaque: the cookie holds a random token, the database holds
 * only its SHA-256 hash. A database dump therefore yields no usable sessions.
 *
 * Two expiries are enforced on every request — an idle window that slides
 * forward with activity, and an absolute lifetime that never does. A session
 * also records the host it was issued for, so an admin session presented on
 * the public host (or vice versa) is rejected outright.
 */

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000
export const ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1000
export const STEP_UP_TTL_MS = 5 * 60 * 1000

const REVOCATION_PREFIX = 'sess:revoked:'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
  status: UserStatus
  locale: string
  mfaEnrolled: boolean
}

export interface ActiveSession {
  id: string
  token: string
  host: string
  mfaSatisfied: boolean
  stepUpVerifiedAt: Date | null
  stepUpScope: string | null
  expiresAt: Date
  absoluteExpiresAt: Date
  user: SessionUser
}

export interface CreateSessionInput {
  userId: string
  host: string
  ip: string | null
  userAgent: string | null
  /** False when MFA is enrolled and still pending. */
  mfaSatisfied: boolean
}

export interface CreatedSession {
  token: string
  csrfToken: string
  expiresAt: Date
  sessionId: string
}

export async function createSession(input: CreateSessionInput): Promise<CreatedSession> {
  const token = randomToken(32)
  const now = Date.now()
  const expiresAt = new Date(now + IDLE_TIMEOUT_MS)
  const absoluteExpiresAt = new Date(now + ABSOLUTE_LIFETIME_MS)

  const session = await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId: input.userId,
      host: input.host,
      expiresAt,
      absoluteExpiresAt,
      mfaSatisfiedAt: input.mfaSatisfied ? new Date() : null,
      ip: input.ip,
      userAgent: input.userAgent,
    },
    select: { id: true },
  })

  return {
    token,
    csrfToken: issueCsrfToken(token),
    expiresAt,
    sessionId: session.id,
  }
}

/** Writes the session and CSRF cookies onto the response. */
export async function setSessionCookies(created: CreatedSession): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE(), created.token, sessionCookieAttributes(created.expiresAt))
  store.set(
    CSRF_COOKIE_NAME(),
    created.csrfToken,
    csrfCookieAttributes(created.expiresAt),
  )
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE(), '', clearedCookieAttributes())
  store.set(CSRF_COOKIE_NAME(), '', { ...clearedCookieAttributes(), httpOnly: false })
}

async function isRevokedInCache(sessionId: string): Promise<boolean> {
  // Skipping the call entirely when Redis is known to be down matters here:
  // this runs on every authenticated request.
  if (!redisAvailable()) return false
  try {
    return (await getRedis().exists(`${REVOCATION_PREFIX}${sessionId}`)) === 1
  } catch (error) {
    // Redis is an accelerator here, not the source of truth. The database
    // check below still catches a revoked session.
    logger.warn({ err: error }, 'session revocation cache unavailable')
    return false
  }
}

/**
 * Loads and validates the current session. Returns null for every failure
 * mode — expired, revoked, wrong host, suspended user — so callers cannot
 * accidentally treat a partially valid session as authenticated.
 */
export async function getActiveSession(host: string): Promise<ActiveSession | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE())?.value
  if (!token) return null

  const record = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      id: true,
      host: true,
      expiresAt: true,
      absoluteExpiresAt: true,
      mfaSatisfiedAt: true,
      stepUpVerifiedAt: true,
      stepUpScope: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          locale: true,
          deletedAt: true,
          lockedUntil: true,
          mfaCredentials: { where: { confirmedAt: { not: null } }, select: { id: true } },
        },
      },
    },
  })

  if (!record) return null
  if (record.revokedAt) return null
  if (await isRevokedInCache(record.id)) return null

  const now = new Date()
  if (record.expiresAt <= now || record.absoluteExpiresAt <= now) return null

  // A session is bound to the host that issued it: the admin cookie is not a
  // public-site cookie and cannot be replayed across the boundary.
  if (record.host !== host) return null

  const user = record.user
  if (!user || user.deletedAt) return null
  if (user.status !== 'ACTIVE') return null
  if (user.lockedUntil && user.lockedUntil > now) return null

  return {
    id: record.id,
    token,
    host: record.host,
    mfaSatisfied: record.mfaSatisfiedAt !== null,
    stepUpVerifiedAt: record.stepUpVerifiedAt,
    stepUpScope: record.stepUpScope,
    expiresAt: record.expiresAt,
    absoluteExpiresAt: record.absoluteExpiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      locale: user.locale,
      mfaEnrolled: user.mfaCredentials.length > 0,
    },
  }
}

/**
 * Slides the idle window forward. Throttled to once a minute so an active
 * admin does not generate a write per request.
 */
export async function touchSession(session: ActiveSession): Promise<void> {
  const remaining = session.expiresAt.getTime() - Date.now()
  if (remaining > IDLE_TIMEOUT_MS - 60_000) return

  const nextExpiry = new Date(
    Math.min(Date.now() + IDLE_TIMEOUT_MS, session.absoluteExpiresAt.getTime()),
  )

  await db.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date(), expiresAt: nextExpiry },
  })
}

/**
 * Issues a fresh token for an existing session. Called after login and after
 * MFA completion to defeat session fixation.
 */
export async function rotateSession(
  sessionId: string,
  options: { markMfaSatisfied?: boolean } = {},
): Promise<CreatedSession> {
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + IDLE_TIMEOUT_MS)

  const updated = await db.session.update({
    where: { id: sessionId },
    data: {
      tokenHash: sha256(token),
      expiresAt,
      lastSeenAt: new Date(),
      ...(options.markMfaSatisfied ? { mfaSatisfiedAt: new Date() } : {}),
    },
    select: { id: true },
  })

  return { token, csrfToken: issueCsrfToken(token), expiresAt, sessionId: updated.id }
}

export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
  if (!redisAvailable()) return
  try {
    await getRedis().set(`${REVOCATION_PREFIX}${sessionId}`, '1', 'EX', 60 * 60 * 24)
  } catch (error) {
    logger.warn({ err: error, sessionId }, 'failed to cache session revocation')
  }
}

export async function revokeAllSessionsForUser(
  userId: string,
  reason: string,
  exceptSessionId?: string,
): Promise<number> {
  const sessions = await db.session.findMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    select: { id: true },
  })

  if (sessions.length === 0) return 0

  await db.session.updateMany({
    where: { id: { in: sessions.map((s) => s.id) } },
    data: { revokedAt: new Date(), revokedReason: reason },
  })

  if (!redisAvailable()) return sessions.length
  try {
    const redis = getRedis()
    const pipeline = redis.pipeline()
    for (const session of sessions) {
      pipeline.set(`${REVOCATION_PREFIX}${session.id}`, '1', 'EX', 60 * 60 * 24)
    }
    await pipeline.exec()
  } catch (error) {
    logger.warn({ err: error, userId }, 'failed to cache bulk session revocation')
  }

  return sessions.length
}

/** Housekeeping: removes sessions that are past their absolute lifetime. */
export async function purgeExpiredSessions(olderThanDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const result = await dbRaw.session.deleteMany({
    where: { absoluteExpiresAt: { lt: cutoff } },
  })
  return result.count
}
