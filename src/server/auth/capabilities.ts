import type { UserRole } from '@/server/db/generated/enums'

/**
 * The permission model (§5, architecture §5).
 *
 * Two roles ship, but permissions are expressed as capabilities rather than
 * role checks scattered through the code. Every use-case names the capability
 * it needs; adding a third role later means adding one row to `ROLE_CAPABILITIES`,
 * not auditing hundreds of call sites.
 */

export const CAPABILITIES = [
  'content.read',
  'content.create',
  'content.update',
  'content.publish',
  'content.archive',
  'content.delete.soft',
  'content.delete.permanent',
  'content.restore',

  'translation.read',
  'translation.edit',
  'translation.approve',
  'translation.ai.run',

  'media.read',
  'media.upload',
  'media.delete',

  'menu.read',
  'menu.manage',

  'form.read',
  'form.manage',

  'inquiry.read',
  'inquiry.update',
  'inquiry.export',

  'analytics.read',
  'analytics.export',

  'user.read',
  'user.manage',

  'security.read',
  'security.manage',
  'session.revoke',

  'settings.read',
  'settings.manage',

  'ai.public.configure',
  'ai.admin.use',
  'ai.admin.write',
  'ai.usage.read',

  'audit.read',

  'import.run',
  'export.run',
  'bulk.run',

  'search.index.manage',
  'maintenance.manage',
] as const

export type Capability = (typeof CAPABILITIES)[number]

const VIEWER_CAPABILITIES: readonly Capability[] = [
  'content.read',
  'translation.read',
  'media.read',
  'menu.read',
  'form.read',
  'inquiry.read',
  'analytics.read',
  'settings.read',
]

export const ROLE_CAPABILITIES: Record<UserRole, ReadonlySet<Capability>> = {
  SUPER_ADMIN: new Set(CAPABILITIES),
  VIEWER: new Set(VIEWER_CAPABILITIES),
}

export function roleHasCapability(role: UserRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability)
}

export function capabilitiesFor(role: UserRole): Capability[] {
  return [...ROLE_CAPABILITIES[role]]
}

/**
 * Capabilities whose use-cases additionally require step-up re-authentication
 * (§7). Listing them here rather than at each call site means the set can be
 * reviewed in one place — and tested exhaustively.
 */
export const STEP_UP_CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  'content.delete.permanent',
  'user.manage',
  'security.manage',
  'session.revoke',
  'settings.manage',
  'ai.public.configure',
  'media.delete',
  'import.run',
  'maintenance.manage',
])

export function requiresStepUp(capability: Capability): boolean {
  return STEP_UP_CAPABILITIES.has(capability)
}

/**
 * Named action scopes for step-up challenges. A challenge proves the user
 * re-authenticated *for a particular kind of action* — a confirmation for
 * "delete a product" cannot be replayed to change security settings.
 */
export const STEP_UP_SCOPES = [
  'content.permanent-delete',
  'bulk.destructive',
  'user.manage',
  'security.settings',
  'api-keys',
  'ai.settings',
  'media.permanent-delete',
  'system.restore',
  'maintenance',
  'import.overwrite',
] as const

export type StepUpScope = (typeof STEP_UP_SCOPES)[number]
