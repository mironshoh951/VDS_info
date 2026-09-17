import sharp from 'sharp'
import { db } from '@/server/db/client'
import { authorize } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/security/audit'
import { validationFailed, notFound } from '@/lib/errors'
import { getEnv } from '@/lib/env'
import { logger } from '@/lib/logger'
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config'
import type { MediaKind } from '@/server/db/generated/enums'
import { mediaStorage, newStorageKey } from '@/server/media/storage'

/**
 * Media library (§21).
 *
 * Uploads are processed inline rather than queued: a library is only useful if
 * the thumbnail is there when the grid re-renders, and the work is a few
 * hundred milliseconds for the sizes accepted here. If that stops being true,
 * the place to move it is this function — nothing else knows how an asset is
 * made ready.
 */

/** What may be uploaded. Anything outside this list is refused by type. */
const ACCEPTED_MIME_TYPES: Readonly<Record<string, MediaKind>> = {
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/webp': 'IMAGE',
  'image/avif': 'IMAGE',
  'image/gif': 'IMAGE',
  'application/pdf': 'DOCUMENT',
  'application/msword': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCUMENT',
  'application/vnd.ms-excel': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'DOCUMENT',
  'text/plain': 'DOCUMENT',
  'text/csv': 'DOCUMENT',
  'video/mp4': 'VIDEO',
  'video/webm': 'VIDEO',
  'audio/mpeg': 'AUDIO',
  'audio/ogg': 'AUDIO',
}

/**
 * Derived sizes. A grid of originals downloads megabytes to show thumbnails,
 * which is the difference between a library that is pleasant to browse and one
 * nobody opens twice.
 */
const VARIANTS = [
  { label: 'thumb', width: 320 },
  { label: 'medium', width: 1024 },
] as const

export interface MediaListItem {
  id: string
  kind: MediaKind
  status: string
  originalName: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  dominantColor: string | null
  createdAt: string
  url: string
  thumbnailUrl: string | null
  alt: string | null
  caption: string | null
  title: string | null
}

export interface MediaListResult {
  items: MediaListItem[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 40

const ACCEPTED_KINDS: Readonly<Record<string, true>> = {
  IMAGE: true,
  VIDEO: true,
  DOCUMENT: true,
  AUDIO: true,
  OTHER: true,
}

export async function listMedia(
  actor: Actor,
  params: {
    query?: string
    kind?: string
    page?: number
    locale?: string
    /** Resolve specific assets — used by the picker to show what is selected. */
    ids?: string[]
  } = {},
): Promise<MediaListResult> {
  await authorize(actor, 'media.read')

  const locale = params.locale && isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
  const page = Math.max(1, params.page ?? 1)
  const kind =
    params.kind && params.kind in ACCEPTED_KINDS ? (params.kind as MediaKind) : undefined
  const query = params.query?.trim()

  const where = {
    deletedAt: null,
    ...(kind ? { kind } : {}),
    ...(params.ids && params.ids.length > 0 ? { id: { in: params.ids } } : {}),
    ...(query ? { originalName: { contains: query, mode: 'insensitive' as const } } : {}),
  }

  const [total, rows] = await Promise.all([
    db.mediaAsset.count({ where }),
    db.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        kind: true,
        status: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        width: true,
        height: true,
        dominantColor: true,
        storageKey: true,
        createdAt: true,
        variants: { select: { label: true, storageKey: true } },
        translations: {
          where: { locale },
          select: { alt: true, caption: true, title: true },
          take: 1,
        },
      },
    }),
  ])

  const storage = mediaStorage()

  const items: MediaListItem[] = rows.map((row) => {
    const thumb = row.variants.find((variant) => variant.label === 'thumb')
    const translation = row.translations[0]
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      width: row.width,
      height: row.height,
      dominantColor: row.dominantColor,
      createdAt: row.createdAt.toISOString(),
      url: storage.urlFor(row.storageKey),
      thumbnailUrl: thumb ? storage.urlFor(thumb.storageKey) : null,
      alt: translation?.alt ?? null,
      caption: translation?.caption ?? null,
      title: translation?.title ?? null,
    }
  })

  return { items, total, page, pageSize: PAGE_SIZE }
}

export async function uploadMedia(
  actor: Actor,
  input: { fileName: string; mimeType: string; body: Buffer },
): Promise<{ id: string }> {
  await authorize(actor, 'media.upload')

  const kind = ACCEPTED_MIME_TYPES[input.mimeType]
  if (!kind) {
    throw validationFailed([
      {
        field: 'file',
        code: 'unsupported_type',
        message: 'That file type is not accepted.',
      },
    ])
  }

  const maxBytes = getEnv().MEDIA_MAX_UPLOAD_MB * 1024 * 1024
  if (input.body.byteLength > maxBytes) {
    throw validationFailed([
      {
        field: 'file',
        code: 'too_large',
        message: `Files must be ${getEnv().MEDIA_MAX_UPLOAD_MB} MB or smaller.`,
      },
    ])
  }

  const storage = mediaStorage()
  const storageKey = newStorageKey(input.mimeType)
  await storage.put(storageKey, input.body, input.mimeType)

  let width: number | null = null
  let height: number | null = null
  let dominantColor: string | null = null
  let processingError: string | null = null
  const variantRows: {
    label: string
    format: string
    width: number
    height: number
    sizeBytes: number
    storageKey: string
  }[] = []

  if (kind === 'IMAGE') {
    try {
      const image = sharp(input.body, { failOn: 'none' })
      const metadata = await image.metadata()
      width = metadata.width ?? null
      height = metadata.height ?? null

      const stats = await image.stats()
      const { r, g, b } = stats.dominant
      dominantColor = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`

      for (const variant of VARIANTS) {
        // Never upscale: a 200px logo blown up to 1024 is a bigger file that
        // looks worse than the original.
        if (width !== null && width <= variant.width) continue

        const buffer = await sharp(input.body, { failOn: 'none' })
          .resize({ width: variant.width, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true })

        const key = newStorageKey('image/webp', variant.label)
        await storage.put(key, buffer.data, 'image/webp')
        variantRows.push({
          label: variant.label,
          format: 'webp',
          width: buffer.info.width,
          height: buffer.info.height,
          sizeBytes: buffer.info.size,
          storageKey: key,
        })
      }
    } catch (error) {
      // The original is already stored and still usable; only the derived
      // sizes are missing, so the asset is kept and the reason recorded.
      processingError = error instanceof Error ? error.message : String(error)
      logger.warn({ err: error, storageKey }, 'media image processing failed')
    }
  }

  const asset = await db.mediaAsset.create({
    data: {
      kind,
      status: processingError ? 'FAILED' : 'READY',
      storageKey,
      originalName: input.fileName.slice(0, 255),
      mimeType: input.mimeType,
      sizeBytes: input.body.byteLength,
      width,
      height,
      dominantColor,
      processingError,
      uploadedById: actorId(actor),
      variants: variantRows.length > 0 ? { create: variantRows } : undefined,
    },
    select: { id: true, originalName: true },
  })

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'media.created',
    entityType: 'MEDIA_ASSET',
    entityId: asset.id,
    entityLabel: asset.originalName,
    after: { mimeType: input.mimeType, sizeBytes: input.body.byteLength, kind },
  })

  return { id: asset.id }
}

export async function updateMediaText(
  actor: Actor,
  input: {
    assetId: string
    locale: string
    alt: string | null
    caption: string | null
    title: string | null
  },
): Promise<void> {
  await authorize(actor, 'media.upload')

  const locale = isLocale(input.locale) ? input.locale : DEFAULT_LOCALE
  const asset = await db.mediaAsset.findFirst({
    where: { id: input.assetId, deletedAt: null },
    select: { id: true, originalName: true },
  })
  if (!asset) throw notFound('That file no longer exists.')

  const before = await db.mediaAssetTranslation.findUnique({
    where: { assetId_locale: { assetId: asset.id, locale } },
    select: { alt: true, caption: true, title: true },
  })

  const data = {
    alt: input.alt?.trim() || null,
    caption: input.caption?.trim() || null,
    title: input.title?.trim() || null,
  }

  await db.mediaAssetTranslation.upsert({
    where: { assetId_locale: { assetId: asset.id, locale } },
    create: { assetId: asset.id, locale, ...data, status: 'APPROVED', origin: 'HUMAN' },
    update: { ...data, status: 'APPROVED' },
  })

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'media.updated',
    entityType: 'MEDIA_ASSET',
    entityId: asset.id,
    entityLabel: asset.originalName,
    before: before ?? null,
    after: { locale, ...data },
  })
}

/**
 * Soft delete. The files stay on disk: an asset is referenced from a dozen
 * tables, and a library that erases bytes the moment someone tidies up turns
 * one careless click into broken pages everywhere it was used.
 */
export async function deleteMedia(
  actor: Actor,
  input: { assetId: string; challengeToken?: string | null },
): Promise<{ usages: number }> {
  await authorize(actor, 'media.delete', {
    scope: 'media.permanent-delete',
    challengeToken: input.challengeToken ?? null,
    entityType: 'MEDIA_ASSET',
    entityId: input.assetId,
  })

  const asset = await db.mediaAsset.findFirst({
    where: { id: input.assetId, deletedAt: null },
    select: { id: true, originalName: true, _count: { select: { usages: true } } },
  })
  if (!asset) throw notFound('That file no longer exists.')

  await db.mediaAsset.update({
    where: { id: asset.id },
    data: { deletedAt: new Date() },
  })

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'media.deleted',
    entityType: 'MEDIA_ASSET',
    entityId: asset.id,
    entityLabel: asset.originalName,
    before: { usages: asset._count.usages },
  })

  return { usages: asset._count.usages }
}
