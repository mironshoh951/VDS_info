import { db } from '@/server/db/client'
import { authorize } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/security/audit'
import { conflict, notFound } from '@/lib/errors'
import { DEFAULT_LOCALE } from '@/i18n/config'
import { mediaStorage } from '@/server/media/storage'
import type { GalleryItem, GalleryOwner } from '@/lib/gallery'
import type { EntityType } from '@/server/db/generated/enums'

/**
 * Galleries — the many-images side of media (§21).
 *
 * Products, partners and events each keep their images in a join table of the
 * same shape, so this is one implementation rather than three. The delegates
 * are switched on explicitly rather than looked up by string: Prisma's types
 * are what catch a typo in a column name here, and a dynamic lookup throws
 * that away for the sake of a few saved lines.
 */

// Re-exported so server callers keep a single import site, while the editor
// takes them straight from `@/lib/gallery` — see that file for why the split
// exists.
export {
  GALLERY_OWNERS,
  isGalleryOwner,
  type GalleryItem,
  type GalleryOwner,
} from '@/lib/gallery'

const ENTITY_TYPE: Record<GalleryOwner, EntityType> = {
  product: 'PRODUCT',
  partner: 'PARTNER',
  event: 'EVENT',
}

const ASSET_SELECT = {
  id: true,
  originalName: true,
  storageKey: true,
  variants: { select: { label: true, storageKey: true } },
  translations: {
    where: { locale: DEFAULT_LOCALE },
    select: { alt: true },
    take: 1,
  },
} as const

type AssetRow = {
  id: string
  originalName: string
  storageKey: string
  variants: { label: string; storageKey: string }[]
  translations: { alt: string | null }[]
}

function toItem(row: {
  id: string
  assetId: string
  role: string
  sortOrder: number
  asset: AssetRow
}): GalleryItem {
  const storage = mediaStorage()
  const thumb = row.asset.variants.find((variant) => variant.label === 'thumb')
  return {
    id: row.id,
    assetId: row.assetId,
    role: row.role,
    sortOrder: row.sortOrder,
    name: row.asset.originalName,
    url: storage.urlFor(row.asset.storageKey),
    thumbnailUrl: thumb ? storage.urlFor(thumb.storageKey) : null,
    alt: row.asset.translations[0]?.alt ?? null,
  }
}

export async function listGallery(
  actor: Actor,
  owner: GalleryOwner,
  ownerId: string,
): Promise<GalleryItem[]> {
  await authorize(actor, 'content.read')

  const order = [{ sortOrder: 'asc' as const }]

  if (owner === 'product') {
    const rows = await db.productMedia.findMany({
      where: { productId: ownerId },
      orderBy: order,
      select: {
        id: true,
        assetId: true,
        role: true,
        sortOrder: true,
        asset: { select: ASSET_SELECT },
      },
    })
    return rows.map(toItem)
  }

  if (owner === 'partner') {
    const rows = await db.partnerMedia.findMany({
      where: { partnerId: ownerId },
      orderBy: order,
      select: {
        id: true,
        assetId: true,
        role: true,
        sortOrder: true,
        asset: { select: ASSET_SELECT },
      },
    })
    return rows.map(toItem)
  }

  const rows = await db.eventMedia.findMany({
    where: { eventId: ownerId },
    orderBy: order,
    select: {
      id: true,
      assetId: true,
      role: true,
      sortOrder: true,
      asset: { select: ASSET_SELECT },
    },
  })
  return rows.map(toItem)
}

export async function addToGallery(
  actor: Actor,
  input: { owner: GalleryOwner; ownerId: string; assetIds: string[] },
): Promise<{ added: number }> {
  await authorize(actor, 'content.update', {
    entityType: ENTITY_TYPE[input.owner],
    entityId: input.ownerId,
  })

  const existing = await listGallery(actor, input.owner, input.ownerId)
  const already = new Set(existing.map((item) => item.assetId))
  const fresh = input.assetIds.filter((id) => !already.has(id))
  if (fresh.length === 0) return { added: 0 }

  let order = existing.reduce((peak, item) => Math.max(peak, item.sortOrder + 1), 0)

  for (const assetId of fresh) {
    const data = { assetId, role: 'gallery', sortOrder: order }
    if (input.owner === 'product') {
      await db.productMedia.create({ data: { ...data, productId: input.ownerId } })
    } else if (input.owner === 'partner') {
      await db.partnerMedia.create({ data: { ...data, partnerId: input.ownerId } })
    } else {
      await db.eventMedia.create({ data: { ...data, eventId: input.ownerId } })
    }
    order += 1
  }

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: `${input.owner}.updated`,
    entityType: ENTITY_TYPE[input.owner],
    entityId: input.ownerId,
    entityLabel: `gallery: +${fresh.length}`,
    after: { added: fresh },
  })

  return { added: fresh.length }
}

export async function removeFromGallery(
  actor: Actor,
  input: { owner: GalleryOwner; id: string },
): Promise<void> {
  await authorize(actor, 'content.update')

  if (input.owner === 'product') {
    await db.productMedia.delete({ where: { id: input.id } })
  } else if (input.owner === 'partner') {
    await db.partnerMedia.delete({ where: { id: input.id } })
  } else {
    await db.eventMedia.delete({ where: { id: input.id } })
  }

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: `${input.owner}.updated`,
    entityType: ENTITY_TYPE[input.owner],
    entityId: input.id,
    entityLabel: 'gallery: removed one image',
  })
}

/**
 * Swaps an image with its neighbour. The first image is what the catalogue
 * shows, so ordering is not decoration here — it decides which picture
 * represents the product everywhere it appears.
 */
export async function moveGalleryItem(
  actor: Actor,
  input: { owner: GalleryOwner; ownerId: string; id: string; direction: 'up' | 'down' },
): Promise<void> {
  await authorize(actor, 'content.update')

  const items = await listGallery(actor, input.owner, input.ownerId)
  const index = items.findIndex((item) => item.id === input.id)
  if (index < 0) throw notFound('That image is no longer in this gallery.')

  const swapWith = input.direction === 'up' ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= items.length) return

  const a = items[index] as GalleryItem
  const b = items[swapWith] as GalleryItem

  const update = async (id: string, sortOrder: number) => {
    if (input.owner === 'product') {
      await db.productMedia.update({ where: { id }, data: { sortOrder } })
    } else if (input.owner === 'partner') {
      await db.partnerMedia.update({ where: { id }, data: { sortOrder } })
    } else {
      await db.eventMedia.update({ where: { id }, data: { sortOrder } })
    }
  }

  await update(a.id, b.sortOrder)
  await update(b.id, a.sortOrder)
}

/**
 * Marks one product image as the primary one. Only products carry the
 * distinction; the others show their gallery in order.
 */
export async function setPrimaryImage(
  actor: Actor,
  input: { ownerId: string; id: string },
): Promise<void> {
  await authorize(actor, 'content.update', {
    entityType: 'PRODUCT',
    entityId: input.ownerId,
  })

  const target = await db.productMedia.findFirst({
    where: { id: input.id, productId: input.ownerId },
    select: { id: true, assetId: true },
  })
  if (!target) throw notFound('That image is no longer in this gallery.')

  const clash = await db.productMedia.findFirst({
    where: { productId: input.ownerId, assetId: target.assetId, role: 'primary' },
    select: { id: true },
  })
  if (clash && clash.id !== target.id) {
    throw conflict('That image is already the primary one.')
  }

  await db.productMedia.updateMany({
    where: { productId: input.ownerId, role: 'primary' },
    data: { role: 'gallery' },
  })
  await db.productMedia.update({
    where: { id: target.id },
    data: { role: 'primary', sortOrder: -1 },
  })

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'product.updated',
    entityType: 'PRODUCT',
    entityId: input.ownerId,
    entityLabel: 'gallery: primary image changed',
  })
}
