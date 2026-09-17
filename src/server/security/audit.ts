import { db } from '@/server/db/client'
import { logger } from '@/lib/logger'
import type { EntityType, UserRole } from '@/server/db/generated/enums'
import type { DbTransaction } from '@/server/db/client'

/**
 * Audit logging (§48).
 *
 * The write happens inside the caller's transaction, so an audited mutation
 * cannot commit without its log entry. Nothing in the application deletes from
 * this table — there is no delete function here, and none elsewhere.
 *
 * Failed authorization attempts are logged too. Those are the early-warning
 * signal that something is probing the admin surface.
 */

export type AuditAction =
  | `${string}.created`
  | `${string}.updated`
  | `${string}.published`
  | `${string}.unpublished`
  | `${string}.archived`
  | `${string}.restored`
  | `${string}.deleted`
  | `${string}.permanently_deleted`
  | `${string}.translated`
  | `${string}.translation_approved`
  | `${string}.reordered`
  | `${string}.bulk`
  | `auth.${string}`
  | `user.${string}`
  | `security.${string}`
  | `ai.${string}`
  | `settings.${string}`
  | `import.${string}`
  | `export.${string}`

export interface AuditActor {
  id: string | null
  role: UserRole | null
  label: string | null
}

export interface AuditContext {
  ip?: string | null
  userAgent?: string | null
  requestId?: string | null
  locale?: string | null
  stepUpUsed?: boolean
}

export interface AuditEntry {
  actor: AuditActor
  action: AuditAction
  entityType?: EntityType
  entityId?: string
  entityLabel?: string
  before?: unknown
  after?: unknown
  success?: boolean
  failureReason?: string
  context?: AuditContext
}

/** Fields that must never be written into an audit snapshot. */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'secretEnc',
  'tokenHash',
  'codeHash',
  'keyHash',
  'confirmTokenHash',
  'unsubscribeTokenHash',
])

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (depth > 6) return '[depth-limited]'
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => sanitize(item, depth + 1))
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key) ? '[redacted]' : sanitize(inner, depth + 1)
    }
    return out
  }
  if (typeof value === 'bigint') return value.toString()
  return value
}

/**
 * Field-level diff, so the admin UI can show "what changed" rather than two
 * blobs the reader has to compare by eye.
 */
export function computeDiff(
  before: unknown,
  after: unknown,
): Record<string, { from: unknown; to: unknown }> | undefined {
  if (
    typeof before !== 'object' ||
    typeof after !== 'object' ||
    before === null ||
    after === null ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    return undefined
  }

  const diff: Record<string, { from: unknown; to: unknown }> = {}
  const beforeRecord = before as Record<string, unknown>
  const afterRecord = after as Record<string, unknown>

  for (const key of new Set([
    ...Object.keys(beforeRecord),
    ...Object.keys(afterRecord),
  ])) {
    if (SENSITIVE_KEYS.has(key)) continue
    const from = beforeRecord[key]
    const to = afterRecord[key]
    if (JSON.stringify(sanitize(from)) !== JSON.stringify(sanitize(to))) {
      diff[key] = { from: sanitize(from), to: sanitize(to) }
    }
  }

  return Object.keys(diff).length > 0 ? diff : undefined
}

type AuditClient = Pick<DbTransaction, 'auditLog'> | typeof db

export async function recordAudit(
  entry: AuditEntry,
  client: AuditClient = db,
): Promise<void> {
  const diff =
    entry.before !== undefined && entry.after !== undefined
      ? computeDiff(entry.before, entry.after)
      : undefined

  try {
    await client.auditLog.create({
      data: {
        actorId: entry.actor.id,
        actorRole: entry.actor.role,
        actorLabel: entry.actor.label,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        entityLabel: entry.entityLabel ?? null,
        before:
          entry.before === undefined ? undefined : (sanitize(entry.before) as object),
        after: entry.after === undefined ? undefined : (sanitize(entry.after) as object),
        diff: diff as object | undefined,
        ip: entry.context?.ip ?? null,
        userAgent: entry.context?.userAgent ?? null,
        requestId: entry.context?.requestId ?? null,
        locale: entry.context?.locale ?? null,
        stepUpUsed: entry.context?.stepUpUsed ?? false,
        success: entry.success ?? true,
        failureReason: entry.failureReason ?? null,
      },
    })
  } catch (error) {
    // An audit write must never be the reason a legitimate action fails, but a
    // failure here is a serious operational signal.
    logger.error({ err: error, action: entry.action }, 'AUDIT WRITE FAILED')
  }
}
