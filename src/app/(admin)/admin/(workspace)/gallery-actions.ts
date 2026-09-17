'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import {
  GALLERY_OWNERS,
  addToGallery,
  listGallery,
  moveGalleryItem,
  removeFromGallery,
  setPrimaryImage,
  type GalleryItem,
  type GalleryOwner,
} from '@/server/modules/media/gallery'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface GalleryActionResult {
  ok: boolean
  items?: GalleryItem[]
  message?: string
}

const OWNER = z.enum(GALLERY_OWNERS as unknown as [GalleryOwner, ...GalleryOwner[]])

function failed(error: unknown, context: string): GalleryActionResult {
  if (isAppError(error)) return { ok: false, message: error.message }
  logger.error({ err: error }, context)
  return { ok: false, message: 'Something went wrong.' }
}

/**
 * Every mutation answers with the new list.
 *
 * The alternative is a write followed by a read from the client, which shows
 * the old order for a moment after every reorder — on a screen whose whole
 * purpose is arranging things, that lag reads as the button not having worked.
 */
async function respond(
  owner: GalleryOwner,
  ownerId: string,
): Promise<GalleryActionResult> {
  const actor = await getActor()
  const items = await listGallery(actor, owner, ownerId)
  revalidatePath(`/admin/${owner}s`)
  return { ok: true, items }
}

export async function listGalleryAction(input: {
  owner: string
  ownerId: string
}): Promise<GalleryActionResult> {
  const parsed = z.object({ owner: OWNER, ownerId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const items = await listGallery(actor, parsed.data.owner, parsed.data.ownerId)
    return { ok: true, items }
  } catch (error) {
    return failed(error, 'gallery list failed')
  }
}

export async function addGalleryImagesAction(input: {
  owner: string
  ownerId: string
  assetIds: string[]
}): Promise<GalleryActionResult> {
  const parsed = z
    .object({
      owner: OWNER,
      ownerId: z.string().uuid(),
      assetIds: z.array(z.string().uuid()).min(1).max(50),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await addToGallery(actor, parsed.data)
    return respond(parsed.data.owner, parsed.data.ownerId)
  } catch (error) {
    return failed(error, 'gallery add failed')
  }
}

export async function removeGalleryImageAction(input: {
  owner: string
  ownerId: string
  id: string
}): Promise<GalleryActionResult> {
  const parsed = z
    .object({ owner: OWNER, ownerId: z.string().uuid(), id: z.string().uuid() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await removeFromGallery(actor, { owner: parsed.data.owner, id: parsed.data.id })
    return respond(parsed.data.owner, parsed.data.ownerId)
  } catch (error) {
    return failed(error, 'gallery remove failed')
  }
}

export async function moveGalleryImageAction(input: {
  owner: string
  ownerId: string
  id: string
  direction: 'up' | 'down'
}): Promise<GalleryActionResult> {
  const parsed = z
    .object({
      owner: OWNER,
      ownerId: z.string().uuid(),
      id: z.string().uuid(),
      direction: z.enum(['up', 'down']),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await moveGalleryItem(actor, parsed.data)
    return respond(parsed.data.owner, parsed.data.ownerId)
  } catch (error) {
    return failed(error, 'gallery move failed')
  }
}

export async function setPrimaryImageAction(input: {
  ownerId: string
  id: string
}): Promise<GalleryActionResult> {
  const parsed = z
    .object({ ownerId: z.string().uuid(), id: z.string().uuid() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await setPrimaryImage(actor, parsed.data)
    return respond('product', parsed.data.ownerId)
  } catch (error) {
    return failed(error, 'gallery primary failed')
  }
}
