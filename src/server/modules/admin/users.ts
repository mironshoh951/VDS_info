import { db, dbRaw } from '@/server/db/client'
import { requireCapability, authorize } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { hashPassword, checkPasswordPolicy } from '@/server/auth/password'
import { revokeAllSessionsForUser } from '@/server/auth/session'
import { recordAudit } from '@/server/security/audit'
import { recordSecurityEvent } from '@/server/security/security-events'
import { conflict, notFound, validationFailed, AppError } from '@/lib/errors'
import type { UserRole, UserStatus } from '@/server/db/generated/enums'

/**
 * Account management (§5.1).
 *
 * Every mutating function here requires `user.manage`, which is in the step-up
 * set — so changing a role or deleting an account always costs a password
 * confirmation, and always leaves an audit entry naming who did it.
 *
 * Two invariants are enforced in code rather than left to discipline:
 *  - an installation can never be left without an active Super Admin;
 *  - nobody can demote, suspend or delete their own account.
 */

export interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  mfaEnabled: boolean
  lastLoginAt: Date | null
  createdAt: Date
  isSelf: boolean
}

export async function listUsers(actor: Actor): Promise<UserRow[]> {
  await requireCapability(actor, 'user.read')

  const rows = await db.user.findMany({
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      mfaCredentials: { where: { confirmedAt: { not: null } }, select: { id: true } },
    },
  })

  const selfId = actorId(actor)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    mfaEnabled: row.mfaCredentials.length > 0,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    isSelf: row.id === selfId,
  }))
}

async function activeSuperAdminCount(excludingId?: string): Promise<number> {
  return db.user.count({
    where: {
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      ...(excludingId ? { id: { not: excludingId } } : {}),
    },
  })
}

function assertNotSelf(actor: Actor, userId: string, action: string): void {
  if (actorId(actor) === userId) {
    throw new AppError('PRECONDITION_FAILED', `You cannot ${action} your own account.`)
  }
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: UserRole
  challengeToken?: string | null
}

export async function createUser(actor: Actor, input: CreateUserInput): Promise<string> {
  const { stepUpUsed } = await authorize(actor, 'user.manage', {
    scope: 'user.manage',
    challengeToken: input.challengeToken ?? null,
  })

  const email = input.email.trim().toLowerCase()

  const policy = checkPasswordPolicy(input.password, { email, name: input.name })
  if (!policy.ok) {
    throw validationFailed(
      policy.problems.map((message) => ({ field: 'password', code: 'weak', message })),
    )
  }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) throw conflict('An account with that email already exists.')

  const user = await db.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      status: 'ACTIVE',
    },
    select: { id: true, name: true, email: true, role: true },
  })

  await Promise.all([
    recordAudit({
      actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
      action: 'user.created',
      entityType: 'USER',
      entityId: user.id,
      entityLabel: user.email,
      after: { name: user.name, email: user.email, role: user.role },
      context: {
        ip: 'ip' in actor ? actor.ip : null,
        requestId: actor.requestId,
        stepUpUsed,
      },
    }),
    recordSecurityEvent({
      type: 'SETTINGS_CHANGED',
      userId: user.id,
      severity: 'warning',
      message: `Account created by ${actorLabel(actor)} with role ${user.role}.`,
      ip: 'ip' in actor ? actor.ip : null,
    }),
  ])

  return user.id
}

export async function changeUserRole(
  actor: Actor,
  userId: string,
  role: UserRole,
  challengeToken: string | null,
): Promise<void> {
  const { stepUpUsed } = await authorize(actor, 'user.manage', {
    scope: 'user.manage',
    challengeToken,
  })

  assertNotSelf(actor, userId, 'change the role of')

  const before = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true, status: true },
  })
  if (!before) throw notFound('Account not found.')

  if (before.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
    if ((await activeSuperAdminCount(userId)) === 0) {
      throw conflict(
        'This is the only active Super Admin. Promote another account first.',
      )
    }
  }

  await db.user.update({ where: { id: userId }, data: { role } })

  // A role change must not leave the old permissions live in an open session.
  await revokeAllSessionsForUser(userId, 'role_changed')

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'user.updated',
    entityType: 'USER',
    entityId: userId,
    entityLabel: before.email,
    before: { role: before.role },
    after: { role },
    context: {
      ip: 'ip' in actor ? actor.ip : null,
      requestId: actor.requestId,
      stepUpUsed,
    },
  })
}

export async function setUserStatus(
  actor: Actor,
  userId: string,
  status: UserStatus,
  challengeToken: string | null,
): Promise<void> {
  const { stepUpUsed } = await authorize(actor, 'user.manage', {
    scope: 'user.manage',
    challengeToken,
  })

  assertNotSelf(actor, userId, 'suspend')

  const before = await db.user.findUnique({
    where: { id: userId },
    select: { status: true, role: true, email: true },
  })
  if (!before) throw notFound('Account not found.')

  if (before.role === 'SUPER_ADMIN' && status !== 'ACTIVE') {
    if ((await activeSuperAdminCount(userId)) === 0) {
      throw conflict('This is the only active Super Admin.')
    }
  }

  await db.user.update({
    where: { id: userId },
    data: {
      status,
      ...(status === 'ACTIVE' ? { failedLoginCount: 0, lockedUntil: null } : {}),
    },
  })

  if (status !== 'ACTIVE') {
    await revokeAllSessionsForUser(userId, `status_${status.toLowerCase()}`)
  }

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'user.updated',
    entityType: 'USER',
    entityId: userId,
    entityLabel: before.email,
    before: { status: before.status },
    after: { status },
    context: {
      ip: 'ip' in actor ? actor.ip : null,
      requestId: actor.requestId,
      stepUpUsed,
    },
  })
}

export async function resetUserPassword(
  actor: Actor,
  userId: string,
  newPassword: string,
  challengeToken: string | null,
): Promise<void> {
  const { stepUpUsed } = await authorize(actor, 'user.manage', {
    scope: 'user.manage',
    challengeToken,
  })

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  })
  if (!user) throw notFound('Account not found.')

  const policy = checkPasswordPolicy(newPassword, { email: user.email, name: user.name })
  if (!policy.ok) {
    throw validationFailed(
      policy.problems.map((message) => ({ field: 'password', code: 'weak', message })),
    )
  }

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  })

  // Everything signed in with the old password is invalidated.
  await revokeAllSessionsForUser(userId, 'password_reset')

  await Promise.all([
    recordAudit({
      actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
      action: 'user.updated',
      entityType: 'USER',
      entityId: userId,
      entityLabel: user.email,
      after: { passwordReset: true },
      context: {
        ip: 'ip' in actor ? actor.ip : null,
        requestId: actor.requestId,
        stepUpUsed,
      },
    }),
    recordSecurityEvent({
      type: 'PASSWORD_CHANGED',
      userId,
      severity: 'warning',
      message: `Password reset by ${actorLabel(actor)}.`,
      ip: 'ip' in actor ? actor.ip : null,
    }),
  ])
}

export async function deleteUser(
  actor: Actor,
  userId: string,
  challengeToken: string | null,
): Promise<void> {
  const { stepUpUsed } = await authorize(actor, 'user.manage', {
    scope: 'user.manage',
    challengeToken,
  })

  assertNotSelf(actor, userId, 'delete')

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, name: true },
  })
  if (!user) throw notFound('Account not found.')

  if (user.role === 'SUPER_ADMIN' && (await activeSuperAdminCount(userId)) === 0) {
    throw conflict('This is the only active Super Admin.')
  }

  // Soft delete: the account's audit history references this row, and history
  // that points at a missing user is not history.
  await dbRaw.user.update({
    where: { id: userId },
    data: { deletedAt: new Date(), status: 'SUSPENDED' },
  })
  await revokeAllSessionsForUser(userId, 'account_deleted')

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'user.deleted',
    entityType: 'USER',
    entityId: userId,
    entityLabel: user.email,
    before: { name: user.name, email: user.email, role: user.role },
    context: {
      ip: 'ip' in actor ? actor.ip : null,
      requestId: actor.requestId,
      stepUpUsed,
    },
  })
}
