import { db } from '@/server/db/client'
import { requireCapability, authorize } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { revokeSession } from '@/server/auth/session'
import { recordAudit } from '@/server/security/audit'
import { recordSecurityEvent } from '@/server/security/security-events'
import { notFound } from '@/lib/errors'
import type { SecurityEventType } from '@/server/db/generated/enums'

/**
 * Security centre (§65).
 *
 * Answers the questions that matter after an incident — and, more often,
 * before one: who is signed in right now, what failed recently, and which
 * accounts still have no second factor.
 */

export interface SessionRow {
  id: string
  userName: string
  userEmail: string
  host: string
  ip: string | null
  userAgent: string | null
  createdAt: Date
  lastSeenAt: Date
  expiresAt: Date
  mfaSatisfied: boolean
  isCurrent: boolean
}

export interface LoginAttemptRow {
  id: string
  email: string
  success: boolean
  reason: string | null
  ip: string | null
  createdAt: Date
}

export interface SecurityEventRow {
  id: string
  type: SecurityEventType
  severity: string
  message: string
  userName: string | null
  ip: string | null
  createdAt: Date
}

export interface AccountRow {
  id: string
  name: string
  email: string
  role: string
  status: string
  mfaEnabled: boolean
  lastLoginAt: Date | null
  lockedUntil: Date | null
}

export interface SecurityOverview {
  sessions: SessionRow[]
  recentAttempts: LoginAttemptRow[]
  failedLast24h: number
  events: SecurityEventRow[]
  accounts: AccountRow[]
  accountsWithoutMfa: number
}

export async function securityOverview(actor: Actor): Promise<SecurityOverview> {
  await requireCapability(actor, 'security.read')

  const currentSessionId = actor.kind === 'user' ? actor.sessionId : null
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [sessions, recentAttempts, failedLast24h, events, users] = await Promise.all([
    db.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      take: 50,
      select: {
        id: true,
        host: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        mfaSatisfiedAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    db.loginAttempt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        email: true,
        success: true,
        reason: true,
        ip: true,
        createdAt: true,
      },
    }),
    db.loginAttempt.count({ where: { success: false, createdAt: { gte: dayAgo } } }),
    db.securityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        type: true,
        severity: true,
        message: true,
        ip: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    db.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        lockedUntil: true,
        mfaCredentials: { where: { confirmedAt: { not: null } }, select: { id: true } },
      },
    }),
  ])

  const accounts: AccountRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mfaEnabled: user.mfaCredentials.length > 0,
    lastLoginAt: user.lastLoginAt,
    lockedUntil: user.lockedUntil,
  }))

  return {
    sessions: sessions.map((session) => ({
      id: session.id,
      userName: session.user.name,
      userEmail: session.user.email,
      host: session.host,
      ip: session.ip,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      mfaSatisfied: session.mfaSatisfiedAt !== null,
      isCurrent: session.id === currentSessionId,
    })),
    recentAttempts,
    failedLast24h,
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      message: event.message,
      userName: event.user?.name ?? null,
      ip: event.ip,
      createdAt: event.createdAt,
    })),
    accounts,
    accountsWithoutMfa: accounts.filter((account) => !account.mfaEnabled).length,
  }
}

/**
 * Revokes another session. Requires step-up: an attacker who has taken over a
 * session should not be able to evict the real owner without the password.
 */
export async function revokeSessionById(
  actor: Actor,
  sessionId: string,
  challengeToken: string | null,
): Promise<void> {
  const { stepUpUsed } = await authorize(actor, 'session.revoke', {
    scope: 'security.settings',
    challengeToken,
  })

  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, user: { select: { name: true, email: true } } },
  })
  if (!session) throw notFound('Session not found.')

  await revokeSession(sessionId, 'revoked_by_admin')

  await Promise.all([
    recordAudit({
      actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
      action: 'security.session_revoked',
      entityType: 'USER',
      entityId: session.userId,
      entityLabel: session.user.email,
      context: {
        ip: 'ip' in actor ? actor.ip : null,
        requestId: actor.requestId,
        stepUpUsed,
      },
    }),
    recordSecurityEvent({
      type: 'SESSION_REVOKED',
      userId: session.userId,
      severity: 'warning',
      message: `Session revoked by ${actorLabel(actor)}.`,
      ip: 'ip' in actor ? actor.ip : null,
    }),
  ])
}
