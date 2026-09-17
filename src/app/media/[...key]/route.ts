import { db } from '@/server/db/client'
import { getActor } from '@/server/auth/context'
import { isSafeStorageKey, mediaStorage } from '@/server/media/storage'

/**
 * Serves stored media.
 *
 * Files deliberately live outside `public/`. Anything in `public/` is world-
 * readable and fixed at build time, which would make PRIVATE assets a lie and
 * would lose every upload made after a deployment. Going through a handler
 * costs a database lookup and buys both.
 */

const NOT_FOUND = new Response('Not found', { status: 404 })

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key: segments } = await context.params
  const key = segments.join('/')

  if (!isSafeStorageKey(key)) return NOT_FOUND

  // The key may name an original or one of its derived sizes.
  const asset = await db.mediaAsset.findFirst({
    where: { storageKey: key, deletedAt: null },
    select: { mimeType: true, visibility: true },
  })

  let mimeType: string
  let isPrivate: boolean

  if (asset) {
    mimeType = asset.mimeType
    isPrivate = asset.visibility === 'PRIVATE'
  } else {
    const variant = await db.mediaVariant.findUnique({
      where: { storageKey: key },
      select: {
        format: true,
        asset: { select: { visibility: true, deletedAt: true } },
      },
    })
    if (!variant || variant.asset.deletedAt) return NOT_FOUND
    mimeType = `image/${variant.format}`
    isPrivate = variant.asset.visibility === 'PRIVATE'
  }

  if (isPrivate) {
    const actor = await getActor()
    if (actor.kind !== 'user') return NOT_FOUND
  }

  let body: Buffer
  try {
    body = await mediaStorage().get(key)
  } catch {
    // The row exists but the object does not — a half-finished upload or a
    // storage directory that was cleared. A 404 is the honest answer.
    return NOT_FOUND
  }

  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(body.byteLength),
      'X-Content-Type-Options': 'nosniff',
      // Storage keys are random and never reused, so a cached copy can never
      // become the wrong file.
      'Cache-Control': isPrivate
        ? 'private, no-store'
        : 'public, max-age=31536000, immutable',
    },
  })
}
