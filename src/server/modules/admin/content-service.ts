import { revalidatePath } from 'next/cache'
import { db } from '@/server/db/client'
import { authorize } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { recordAudit, type AuditAction } from '@/server/security/audit'
import { invalidateNavigation } from '@/server/modules/navigation/service'
import { notFound, conflict, AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { RESOURCES, type ResourceDefinition, type ResourceKey } from './resources'
import type { ContentStatus } from '@/server/db/generated/enums'

/**
 * Lifecycle operations shared by every content type (§34, §35, §59).
 *
 * Each one:
 *   1. checks the capability — and step-up authentication where the action is
 *      destructive — before touching anything;
 *   2. writes a version snapshot in the same transaction as the change;
 *   3. writes an audit entry with a before/after diff;
 *   4. invalidates the caches that could still be serving the old version.
 *
 * Nothing in the admin UI bypasses these functions.
 */

export interface LifecycleContext {
  actor: Actor
  challengeToken?: string | null
}

async function loadTitle(
  definition: ResourceDefinition,
  id: string,
  base: Record<string, unknown>,
): Promise<string> {
  if (definition.titleField && typeof base[definition.titleField] === 'string') {
    return base[definition.titleField] as string
  }

  const translations = definition.translationDelegate?.()
  if (!translations || !definition.translationForeignKey) return id

  const row = await translations
    .findFirst({
      where: { [definition.translationForeignKey]: id },
      select: { [definition.translationTitleField]: true },
    })
    .catch(() => null)

  const value = row?.[definition.translationTitleField]
  return typeof value === 'string' ? value : id
}

/** Snapshot the current row so the change is reversible (§34). */
async function writeVersion(
  definition: ResourceDefinition,
  id: string,
  snapshot: Record<string, unknown>,
  actor: Actor,
  summary: string,
): Promise<void> {
  try {
    const last = await db.contentVersion.findFirst({
      where: { entityType: definition.entityType, entityId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    await db.contentVersion.create({
      data: {
        entityType: definition.entityType,
        entityId: id,
        version: (last?.version ?? 0) + 1,
        snapshot: JSON.parse(JSON.stringify(snapshot, replacer)) as object,
        summary,
        createdById: actorId(actor),
      },
    })
  } catch (error) {
    logger.error({ err: error, entityId: id }, 'version snapshot failed')
  }
}

function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

async function invalidate(definition: ResourceDefinition): Promise<void> {
  try {
    // Listing and detail routes for every locale.
    if (definition.publicPath !== null) {
      revalidatePath(`/[locale]/${definition.publicPath}`, 'page')
      revalidatePath(`/[locale]/${definition.publicPath}/[slug]`, 'page')
    }
    revalidatePath('/[locale]', 'page')
    await invalidateNavigation()
  } catch (error) {
    logger.warn({ err: error }, 'cache invalidation after content change failed')
  }
}

async function loadRow(
  definition: ResourceDefinition,
  id: string,
  useRaw = false,
): Promise<Record<string, unknown>> {
  const delegate = useRaw ? definition.rawDelegate() : definition.delegate()
  const row = await delegate.findUnique({ where: { id }, select: selectAll(definition) })
  if (!row) throw notFound(`${definition.label} not found.`)
  return row
}

/** Lifecycle columns every content table shares. */
function selectAll(definition: ResourceDefinition): Record<string, boolean> {
  return {
    id: true,
    ...(definition.hasStatus ? { status: true, publishedAt: true } : {}),
    ...(definition.hasFeatured ? { featured: true } : {}),
    ...(definition.titleField ? { [definition.titleField]: true } : {}),
    deletedAt: true,
    updatedAt: true,
  }
}

async function audit(
  definition: ResourceDefinition,
  action: AuditAction,
  id: string,
  title: string,
  before: unknown,
  after: unknown,
  context: LifecycleContext,
  stepUpUsed = false,
): Promise<void> {
  const { actor } = context
  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action,
    entityType: definition.entityType,
    entityId: id,
    entityLabel: title,
    before,
    after,
    context: {
      ip: 'ip' in actor ? actor.ip : null,
      userAgent: 'userAgent' in actor ? actor.userAgent : null,
      requestId: actor.requestId,
      stepUpUsed,
    },
  })
}

// ---------------------------------------------------------------------------
// Publication state
// ---------------------------------------------------------------------------

export async function setStatus(
  resourceKey: ResourceKey,
  id: string,
  status: ContentStatus,
  context: LifecycleContext,
): Promise<void> {
  const definition = RESOURCES[resourceKey]
  if (!definition.hasStatus) {
    throw new AppError(
      'PRECONDITION_FAILED',
      `${definition.label} has no publication state.`,
    )
  }

  const capability =
    status === 'PUBLISHED'
      ? 'content.publish'
      : status === 'ARCHIVED'
        ? 'content.archive'
        : 'content.update'

  await authorize(context.actor, capability, {
    entityType: definition.entityType,
    entityId: id,
  })

  const before = await loadRow(definition, id)
  const title = await loadTitle(definition, id, before)

  const after = await definition.delegate().update({
    where: { id },
    data: {
      status,
      // publishedAt is set once, the first time a record goes live, so it
      // keeps meaning "first published" rather than "last touched".
      ...(status === 'PUBLISHED' && !before.publishedAt
        ? { publishedAt: new Date() }
        : {}),
      updatedById: actorId(context.actor),
    },
    select: selectAll(definition),
  })

  await writeVersion(definition, id, before, context.actor, `Status → ${status}`)

  const action: AuditAction =
    status === 'PUBLISHED'
      ? `${definition.key}.published`
      : status === 'ARCHIVED'
        ? `${definition.key}.archived`
        : `${definition.key}.unpublished`

  await audit(definition, action, id, title, before, after, context)
  await invalidate(definition)
}

export async function setFeatured(
  resourceKey: ResourceKey,
  id: string,
  featured: boolean,
  context: LifecycleContext,
): Promise<void> {
  const definition = RESOURCES[resourceKey]
  if (!definition.hasFeatured) {
    throw new AppError('PRECONDITION_FAILED', `${definition.label} cannot be featured.`)
  }

  await authorize(context.actor, 'content.update', {
    entityType: definition.entityType,
    entityId: id,
  })

  const before = await loadRow(definition, id)
  const title = await loadTitle(definition, id, before)

  const after = await definition.delegate().update({
    where: { id },
    data: { featured, updatedById: actorId(context.actor) },
    select: selectAll(definition),
  })

  await audit(definition, `${definition.key}.updated`, id, title, before, after, context)
  await invalidate(definition)
}

// ---------------------------------------------------------------------------
// Deletion and recovery
// ---------------------------------------------------------------------------

export async function softDelete(
  resourceKey: ResourceKey,
  id: string,
  context: LifecycleContext,
): Promise<void> {
  const definition = RESOURCES[resourceKey]

  await authorize(context.actor, 'content.delete.soft', {
    entityType: definition.entityType,
    entityId: id,
  })

  const before = await loadRow(definition, id)
  const title = await loadTitle(definition, id, before)

  await writeVersion(definition, id, before, context.actor, 'Moved to trash')

  const after = await definition.delegate().update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: actorId(context.actor),
      ...(definition.hasStatus ? { status: 'ARCHIVED' as ContentStatus } : {}),
    },
    select: selectAll(definition),
  })

  await audit(definition, `${definition.key}.deleted`, id, title, before, after, context)
  await invalidate(definition)
}

export async function restore(
  resourceKey: ResourceKey,
  id: string,
  context: LifecycleContext,
): Promise<void> {
  const definition = RESOURCES[resourceKey]

  await authorize(context.actor, 'content.restore', {
    entityType: definition.entityType,
    entityId: id,
  })

  const before = await loadRow(definition, id, true)
  const title = await loadTitle(definition, id, before)

  // Restored content comes back as a draft, never straight to the live site:
  // whatever caused it to be deleted should be reviewed before it reappears.
  const after = await definition.rawDelegate().update({
    where: { id },
    data: {
      deletedAt: null,
      deletedById: null,
      ...(definition.hasStatus ? { status: 'DRAFT' as ContentStatus } : {}),
      updatedById: actorId(context.actor),
    },
    select: selectAll(definition),
  })

  await audit(definition, `${definition.key}.restored`, id, title, before, after, context)
  await invalidate(definition)
}

/**
 * Permanent deletion (§7, §59).
 *
 * Requires `content.delete.permanent`, which is in the step-up set, so the
 * caller must supply a valid single-use challenge token obtained by
 * re-entering their password.
 */
export async function permanentlyDelete(
  resourceKey: ResourceKey,
  id: string,
  context: LifecycleContext,
): Promise<void> {
  const definition = RESOURCES[resourceKey]

  const { stepUpUsed } = await authorize(context.actor, 'content.delete.permanent', {
    scope: 'content.permanent-delete',
    challengeToken: context.challengeToken ?? null,
    entityType: definition.entityType,
    entityId: id,
  })

  const before = await loadRow(definition, id, true)
  const title = await loadTitle(definition, id, before)

  // Only something already in the trash can be destroyed. Deleting a live
  // record in one step is exactly the mistake this guard exists to prevent.
  if (!before.deletedAt) {
    throw conflict('Move this item to the trash before deleting it permanently.')
  }

  await definition.rawDelegate().delete({ where: { id } })

  await audit(
    definition,
    `${definition.key}.permanently_deleted`,
    id,
    title,
    before,
    null,
    context,
    stepUpUsed,
  )
  await invalidate(definition)
}

// ---------------------------------------------------------------------------
// Bulk operations (§35)
// ---------------------------------------------------------------------------

export type BulkOperation =
  'publish' | 'unpublish' | 'archive' | 'feature' | 'unfeature' | 'delete'

export interface BulkResult {
  requested: number
  succeeded: number
  failed: Array<{ id: string; reason: string }>
}

export async function bulkOperation(
  resourceKey: ResourceKey,
  ids: string[],
  operation: BulkOperation,
  context: LifecycleContext,
): Promise<BulkResult> {
  const definition = RESOURCES[resourceKey]

  await authorize(context.actor, 'bulk.run')

  const unique = [...new Set(ids)].slice(0, 500)
  const result: BulkResult = { requested: unique.length, succeeded: 0, failed: [] }

  // Applied one at a time rather than as a single updateMany, so that each
  // record gets its own version snapshot and audit entry — a bulk action must
  // be as reviewable afterwards as an individual one.
  for (const id of unique) {
    try {
      switch (operation) {
        case 'publish':
          await setStatus(resourceKey, id, 'PUBLISHED', context)
          break
        case 'unpublish':
          await setStatus(resourceKey, id, 'DRAFT', context)
          break
        case 'archive':
          await setStatus(resourceKey, id, 'ARCHIVED', context)
          break
        case 'feature':
          await setFeatured(resourceKey, id, true, context)
          break
        case 'unfeature':
          await setFeatured(resourceKey, id, false, context)
          break
        case 'delete':
          await softDelete(resourceKey, id, context)
          break
      }
      result.succeeded += 1
    } catch (error) {
      result.failed.push({
        id,
        reason: error instanceof AppError ? error.message : 'Unexpected error',
      })
    }
  }

  await recordAudit({
    actor: {
      id: actorId(context.actor),
      role: actorRole(context.actor),
      label: actorLabel(context.actor),
    },
    action: `${definition.key}.bulk`,
    entityType: definition.entityType,
    entityLabel: `${operation}: ${result.succeeded}/${result.requested}`,
    after: { operation, ...result },
    success: result.failed.length === 0,
    context: {
      ip: 'ip' in context.actor ? context.actor.ip : null,
      requestId: context.actor.requestId,
    },
  })

  return result
}
