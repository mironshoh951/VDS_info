'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import { getAdminLocale } from '@/server/admin/locale'
import {
  deleteMedia,
  listMedia,
  updateMediaText,
  uploadMedia,
  type MediaListResult,
} from '@/server/modules/media/service'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface MediaActionResult {
  ok: boolean
  message?: string
}

/**
 * Accepts one or more files.
 *
 * Each file is handled independently and the result reports how many landed:
 * a person selecting twenty images should not lose nineteen of them because
 * the twentieth was a .exe.
 */
export async function uploadMediaAction(
  formData: FormData,
): Promise<MediaActionResult & { uploaded: number; failed: number }> {
  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File)

  if (files.length === 0) {
    return { ok: false, uploaded: 0, failed: 0, message: 'No file was selected.' }
  }

  const actor = await getActor()
  let uploaded = 0
  let failed = 0
  let firstMessage: string | undefined

  for (const file of files) {
    try {
      const body = Buffer.from(await file.arrayBuffer())
      await uploadMedia(actor, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        body,
      })
      uploaded += 1
    } catch (error) {
      failed += 1
      if (!firstMessage) {
        firstMessage = isAppError(error)
          ? error.message
          : 'That file could not be uploaded.'
      }
      if (!isAppError(error)) logger.error({ err: error }, 'media upload failed')
    }
  }

  revalidatePath('/admin/media')
  return {
    ok: uploaded > 0,
    uploaded,
    failed,
    ...(firstMessage ? { message: firstMessage } : {}),
  }
}

export async function updateMediaTextAction(input: {
  assetId: string
  alt: string
  caption: string
  title: string
}): Promise<MediaActionResult> {
  const parsed = z
    .object({
      assetId: z.string().uuid(),
      alt: z.string().max(300),
      caption: z.string().max(1000),
      title: z.string().max(300),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const locale = await getAdminLocale()
    await updateMediaText(actor, { ...parsed.data, locale })
    revalidatePath('/admin/media')
    return { ok: true }
  } catch (error) {
    if (isAppError(error)) return { ok: false, message: error.message }
    logger.error({ err: error }, 'media metadata update failed')
    return { ok: false, message: 'Something went wrong while saving.' }
  }
}

export async function deleteMediaAction(input: {
  assetId: string
  challengeToken: string
}): Promise<MediaActionResult> {
  const parsed = z
    .object({ assetId: z.string().uuid(), challengeToken: z.string().min(1) })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const { usages } = await deleteMedia(actor, parsed.data)
    revalidatePath('/admin/media')
    return {
      ok: true,
      ...(usages > 0
        ? {
            message: `Removed from the library. It was still used in ${usages} place(s).`,
          }
        : {}),
    }
  } catch (error) {
    if (isAppError(error)) return { ok: false, message: error.message }
    logger.error({ err: error }, 'media delete failed')
    return { ok: false, message: 'Something went wrong while deleting.' }
  }
}

/**
 * Backs the picker used inside the content editor.
 *
 * The editor holds only an id, so the picker has to ask what that id is before
 * it can show a thumbnail — which is why `ids` exists alongside the search.
 */
export async function browseMediaAction(input: {
  query?: string
  kind?: string
  ids?: string[]
}): Promise<{ ok: boolean; result?: MediaListResult; message?: string }> {
  const parsed = z
    .object({
      query: z.string().max(200).optional(),
      kind: z.string().max(20).optional(),
      ids: z.array(z.string().uuid()).max(50).optional(),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const locale = await getAdminLocale()
    const result = await listMedia(actor, { ...parsed.data, locale })
    return { ok: true, result }
  } catch (error) {
    if (isAppError(error)) return { ok: false, message: error.message }
    logger.error({ err: error }, 'media browse failed')
    return { ok: false, message: 'Could not load the media library.' }
  }
}
