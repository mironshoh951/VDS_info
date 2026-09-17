import { db } from '@/server/db/client'
import { authorize } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/security/audit'
import { notFound } from '@/lib/errors'
import { LOCALES, DEFAULT_LOCALE, type Locale } from '@/i18n/config'
import { blockDefinition, type EditorBlock } from '@/lib/blocks'

/**
 * Editing the blocks a page is made of (§32).
 *
 * Blocks are rows, not fields on the page, so they save on their own rather
 * than with the page form — the same reasoning as galleries. Someone who adds
 * three sections, reorders them, then navigates away should not lose the
 * arrangement because they missed a Save button at the bottom of a long page.
 *
 * Every write goes through `authorize` and leaves an audit entry against the
 * page, not the block: "someone changed the home page" is the sentence an
 * operator needs; which row id moved is detail the diff already carries.
 */

const TEXT_STATUS_WHEN_WRITTEN = 'HUMAN_DRAFT' as const

function auditActor(actor: Actor) {
  return { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) }
}

/**
 * Prisma types a JSON column as its own `InputJsonObject`, which a plain
 * `Record<string, unknown>` does not satisfy — `unknown` could be a function.
 * Everything written here came through a Zod schema in the action and is
 * JSON by construction, so the assertion states a fact the type system cannot
 * see rather than papering over a doubt.
 */
function asJson(value: Record<string, unknown>): object {
  return value as object
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function pageLabel(pageId: string): Promise<string> {
  const translation = await db.pageTranslation.findFirst({
    where: { pageId, locale: DEFAULT_LOCALE },
    select: { title: true },
  })
  return translation?.title ?? pageId
}

export async function listBlocks(actor: Actor, pageId: string): Promise<EditorBlock[]> {
  await authorize(actor, 'content.read')

  const rows = await db.pageBlock.findMany({
    where: { pageId },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      type: true,
      sortOrder: true,
      enabled: true,
      anchor: true,
      props: true,
      translations: { select: { locale: true, props: true } },
    },
  })

  return rows.map((row) => {
    const text: Record<string, Record<string, unknown>> = {}
    for (const locale of LOCALES) text[locale] = {}
    for (const translation of row.translations) {
      text[translation.locale] = asRecord(translation.props)
    }

    return {
      id: row.id,
      type: row.type,
      sortOrder: row.sortOrder,
      enabled: row.enabled,
      anchor: row.anchor,
      config: asRecord(row.props),
      text,
    }
  })
}

export async function addBlock(
  actor: Actor,
  input: { pageId: string; type: string },
): Promise<void> {
  await authorize(actor, 'content.update', { entityType: 'PAGE', entityId: input.pageId })

  if (!blockDefinition(input.type)) {
    throw notFound('That block type is not registered.')
  }

  const page = await db.page.findFirst({
    where: { id: input.pageId, deletedAt: null },
    select: { id: true },
  })
  if (!page) throw notFound('Page not found.')

  // Appended rather than inserted: a new section arriving in the middle of a
  // page someone is part-way through arranging is never what they meant.
  const last = await db.pageBlock.findFirst({
    where: { pageId: input.pageId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const block = await db.pageBlock.create({
    data: {
      pageId: input.pageId,
      type: input.type,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      enabled: true,
      props: {},
      translations: {
        create: LOCALES.map((locale) => ({
          locale,
          props: {},
          status: 'MISSING' as const,
        })),
      },
    },
    select: { id: true },
  })

  await recordAudit({
    actor: auditActor(actor),
    action: 'page.updated',
    entityType: 'PAGE',
    entityId: input.pageId,
    entityLabel: await pageLabel(input.pageId),
    after: { addedBlock: { id: block.id, type: input.type } },
  })
}

export async function removeBlock(
  actor: Actor,
  input: { pageId: string; id: string },
): Promise<void> {
  await authorize(actor, 'content.update', { entityType: 'PAGE', entityId: input.pageId })

  const block = await db.pageBlock.findFirst({
    where: { id: input.id, pageId: input.pageId },
    select: { id: true, type: true, props: true },
  })
  if (!block) throw notFound('Block not found.')

  // A hard delete, unlike content rows. A block carries no address of its own —
  // nothing links to it, nothing can cite it — so there is nothing for a soft
  // delete to preserve, and the audit entry keeps what it held.
  await db.pageBlock.delete({ where: { id: block.id } })

  await recordAudit({
    actor: auditActor(actor),
    action: 'page.updated',
    entityType: 'PAGE',
    entityId: input.pageId,
    entityLabel: await pageLabel(input.pageId),
    before: { removedBlock: { id: block.id, type: block.type, props: block.props } },
  })
}

export async function moveBlock(
  actor: Actor,
  input: { pageId: string; id: string; direction: 'up' | 'down' },
): Promise<void> {
  await authorize(actor, 'content.update', { entityType: 'PAGE', entityId: input.pageId })

  const blocks = await db.pageBlock.findMany({
    where: { pageId: input.pageId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  })

  const index = blocks.findIndex((block) => block.id === input.id)
  if (index === -1) throw notFound('Block not found.')

  const target = input.direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= blocks.length) return

  const a = blocks[index]!
  const b = blocks[target]!

  // Rewritten from the array rather than swapping the two stored values: seed
  // data and older edits can leave duplicate or gapped sort orders, and a plain
  // swap on those does nothing visible, which reads as a broken button.
  const reordered = [...blocks]
  reordered[index] = b
  reordered[target] = a

  await db.$transaction(
    reordered.map((block, order) =>
      db.pageBlock.update({ where: { id: block.id }, data: { sortOrder: order } }),
    ),
  )

  await recordAudit({
    actor: auditActor(actor),
    action: 'page.reordered',
    entityType: 'PAGE',
    entityId: input.pageId,
    entityLabel: await pageLabel(input.pageId),
    after: { movedBlock: a.id, direction: input.direction },
  })
}

export async function setBlockEnabled(
  actor: Actor,
  input: { pageId: string; id: string; enabled: boolean },
): Promise<void> {
  await authorize(actor, 'content.update', { entityType: 'PAGE', entityId: input.pageId })

  const block = await db.pageBlock.findFirst({
    where: { id: input.id, pageId: input.pageId },
    select: { id: true, enabled: true, type: true },
  })
  if (!block) throw notFound('Block not found.')

  await db.pageBlock.update({
    where: { id: block.id },
    data: { enabled: input.enabled },
  })

  await recordAudit({
    actor: auditActor(actor),
    action: 'page.updated',
    entityType: 'PAGE',
    entityId: input.pageId,
    entityLabel: await pageLabel(input.pageId),
    before: { block: block.type, enabled: block.enabled },
    after: { block: block.type, enabled: input.enabled },
  })
}

export async function saveBlock(
  actor: Actor,
  input: {
    pageId: string
    id: string
    anchor: string | null
    config: Record<string, unknown>
    text: Record<string, Record<string, unknown>>
  },
): Promise<void> {
  await authorize(actor, 'content.update', { entityType: 'PAGE', entityId: input.pageId })

  const block = await db.pageBlock.findFirst({
    where: { id: input.id, pageId: input.pageId },
    select: { id: true, type: true, props: true, anchor: true },
  })
  if (!block) throw notFound('Block not found.')

  const definition = blockDefinition(block.type)
  if (!definition) throw notFound('That block type is not registered.')

  // Only declared fields are written. Props are free-form JSON, so without this
  // the editor would be a channel for putting arbitrary keys into a column the
  // renderer reads — and stale keys from a block that was retyped would linger
  // for ever.
  const configFields = definition.fields.filter((field) => !field.localized)
  const textFields = definition.fields.filter((field) => field.localized)

  const config: Record<string, unknown> = {}
  for (const field of configFields) {
    const value = input.config[field.name]
    if (value !== undefined && value !== null && value !== '') config[field.name] = value
  }

  await db.$transaction(async (tx) => {
    await tx.pageBlock.update({
      where: { id: block.id },
      data: {
        props: asJson(config),
        anchor: input.anchor && input.anchor.trim() ? input.anchor.trim() : null,
      },
    })

    for (const locale of LOCALES) {
      const incoming = input.text[locale] ?? {}
      const props: Record<string, unknown> = {}
      for (const field of textFields) {
        const value = incoming[field.name]
        if (value !== undefined && value !== null && value !== '') {
          props[field.name] = value
        }
      }

      const filled = Object.keys(props).length > 0

      await tx.pageBlockTranslation.upsert({
        where: { blockId_locale: { blockId: block.id, locale } },
        create: {
          blockId: block.id,
          locale,
          props: asJson(props),
          // An empty translation is MISSING, not a draft — otherwise the
          // completeness matrix would report a page as translated the moment
          // somebody opened it.
          status: filled ? TEXT_STATUS_WHEN_WRITTEN : 'MISSING',
          origin: 'HUMAN',
        },
        update: {
          props: asJson(props),
          status: filled ? TEXT_STATUS_WHEN_WRITTEN : 'MISSING',
          origin: 'HUMAN',
        },
      })
    }
  })

  await recordAudit({
    actor: auditActor(actor),
    action: 'page.updated',
    entityType: 'PAGE',
    entityId: input.pageId,
    entityLabel: await pageLabel(input.pageId),
    before: { block: block.type, props: block.props, anchor: block.anchor },
    after: { block: block.type, props: config, anchor: input.anchor },
  })
}

export type { Locale }
