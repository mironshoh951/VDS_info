import type { UserRole } from '@/server/db/generated/enums'
import type { Capability } from './capabilities'
import { ROLE_CAPABILITIES } from './capabilities'

/**
 * The authenticated subject of an operation.
 *
 * Every use-case takes an `Actor` as its first argument. That makes
 * authorization a parameter of the function rather than an ambient lookup, so
 * a use-case cannot be called "as nobody" by accident, and tests can exercise
 * a Viewer without mocking cookies.
 */

export interface UserActor {
  kind: 'user'
  userId: string
  role: UserRole
  email: string
  name: string
  sessionId: string
  mfaSatisfied: boolean
  capabilities: ReadonlySet<Capability>
  ip: string | null
  userAgent: string | null
  requestId: string | null
  locale: string | null
}

/**
 * Background jobs and the seeder. A system actor has full capability but is
 * never reachable from an HTTP request — it is constructed only inside the
 * worker process and the seed script.
 */
export interface SystemActor {
  kind: 'system'
  label: string
  capabilities: ReadonlySet<Capability>
  requestId: string | null
}

export interface AnonymousActor {
  kind: 'anonymous'
  capabilities: ReadonlySet<Capability>
  ip: string | null
  userAgent: string | null
  requestId: string | null
  locale: string | null
}

export type Actor = UserActor | SystemActor | AnonymousActor

export function systemActor(label: string, requestId: string | null = null): SystemActor {
  return {
    kind: 'system',
    label,
    capabilities: ROLE_CAPABILITIES.SUPER_ADMIN,
    requestId,
  }
}

export function anonymousActor(input: {
  ip?: string | null
  userAgent?: string | null
  requestId?: string | null
  locale?: string | null
}): AnonymousActor {
  return {
    kind: 'anonymous',
    capabilities: new Set<Capability>(),
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    requestId: input.requestId ?? null,
    locale: input.locale ?? null,
  }
}

export function actorLabel(actor: Actor): string {
  switch (actor.kind) {
    case 'user':
      return `${actor.name} <${actor.email}>`
    case 'system':
      return `system:${actor.label}`
    case 'anonymous':
      return 'anonymous'
  }
}

export function actorRole(actor: Actor): UserRole | null {
  return actor.kind === 'user'
    ? actor.role
    : actor.kind === 'system'
      ? 'SUPER_ADMIN'
      : null
}

export function actorId(actor: Actor): string | null {
  return actor.kind === 'user' ? actor.userId : null
}

export function isSuperAdmin(actor: Actor): boolean {
  return (
    actor.kind === 'system' || (actor.kind === 'user' && actor.role === 'SUPER_ADMIN')
  )
}
