import { db } from '@/server/db/client'
import { mediaStorage } from '@/server/media/storage'
import { fallbackChain, type Locale } from '@/i18n/config'

/**
 * Reading images for the public site.
 *
 * Separate from the admin media service on purpose. That one takes an actor and
 * enforces capabilities because it lists everything, including drafts and
 * private files; this one is called while rendering a page for an anonymous
 * visitor and must never be able to return either. The filter is in the query,
 * not in a caller's discipline.
 */

export interface PublicImage {
  id: string
  url: string
  /** A smaller derivative, where one exists. Used for grids and thumbnails. */
  thumbnailUrl: string | null
  width: number | null
  height: number | null
  /** Used as a placeholder tint while the image loads. */
  dominantColor: string | null
  alt: string
  caption: string | null
}

/**
 * Resolves asset ids to renderable images, keyed by id.
 *
 * A Map rather than an array because the caller knows the order it wants — the
 * order the editor arranged, not the order the database happened to return —
 * and because a missing or since-deleted id must simply be absent rather than
 * shifting everything after it.
 */
export async function publicImages(
  ids: readonly string[],
  locale: Locale,
): Promise<Map<string, PublicImage>> {
  const wanted = [...new Set(ids.filter(Boolean))]
  if (wanted.length === 0) return new Map()

  const rows = await db.mediaAsset.findMany({
    where: {
      id: { in: wanted },
      deletedAt: null,
      kind: 'IMAGE',
      // A private asset is private on the public site whatever a page says.
      visibility: 'PUBLIC',
    },
    select: {
      id: true,
      storageKey: true,
      width: true,
      height: true,
      dominantColor: true,
      variants: { select: { label: true, storageKey: true } },
      translations: { select: { locale: true, alt: true, caption: true } },
    },
  })

  const storage = mediaStorage()
  const chain = fallbackChain(locale)

  return new Map(
    rows.map((row) => {
      // Alt text follows the same per-field fallback as any other translation:
      // an image described in one language is better than an undescribed image.
      const text = chain
        .map((code) => row.translations.find((t) => t.locale === code))
        .find((t) => t?.alt || t?.caption)

      const thumb = row.variants.find((variant) => variant.label === 'thumb')

      return [
        row.id,
        {
          id: row.id,
          url: storage.urlFor(row.storageKey),
          thumbnailUrl: thumb ? storage.urlFor(thumb.storageKey) : null,
          width: row.width,
          height: row.height,
          dominantColor: row.dominantColor,
          // Empty, not a filename: a decorative image with no description is
          // better announced as decorative than as "IMG_4821.jpg".
          alt: text?.alt ?? '',
          caption: text?.caption ?? null,
        },
      ]
    }),
  )
}

/** Convenience for the common case of a single image. */
export async function publicImage(
  id: string | null | undefined,
  locale: Locale,
): Promise<PublicImage | null> {
  if (!id) return null
  const map = await publicImages([id], locale)
  return map.get(id) ?? null
}

/** Resolves an ordered list, dropping ids that no longer resolve. */
export async function publicImageList(
  ids: readonly string[],
  locale: Locale,
): Promise<PublicImage[]> {
  const map = await publicImages(ids, locale)
  return ids
    .map((id) => map.get(id))
    .filter((image): image is PublicImage => Boolean(image))
}
