'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import {
  addBlock,
  listBlocks,
  moveBlock,
  removeBlock,
  saveBlock,
  setBlockEnabled,
} from '@/server/modules/pages/block-admin'
import { BLOCK_TYPES, type EditorBlock } from '@/lib/blocks'
import { LOCALES } from '@/i18n/config'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface BlockActionResult {
  ok: boolean
  blocks?: EditorBlock[]
  message?: string
}

const PAGE_ID = z.string().uuid()

/**
 * Block props are free-form JSON by design, but "free-form" is not "anything":
 * this bounds the shape so a crafted request cannot store a deeply nested
 * structure that the renderer will later walk. Depth is capped at one level of
 * objects inside an array, which is exactly what the `items` field needs and
 * nothing more.
 */
const JSON_LEAF = z.union([z.string().max(20_000), z.number(), z.boolean()])
const JSON_VALUE: z.ZodType<unknown> = z.union([
  JSON_LEAF,
  z.array(z.union([JSON_LEAF, z.record(z.string(), JSON_LEAF)])).max(50),
  // The rich-text document, which is validated properly by the renderer.
  z.record(z.string(), z.unknown()),
])

const PROPS = z.record(z.string(), JSON_VALUE)

function failed(error: unknown, context: string): BlockActionResult {
  if (isAppError(error)) return { ok: false, message: error.message }
  logger.error({ err: error }, context)
  return { ok: false, message: 'Something went wrong.' }
}

/**
 * Every mutation answers with the whole list.
 *
 * On a screen whose purpose is arranging sections, a write followed by a
 * separate read shows the old order for a moment after each move, which reads
 * as the button not having worked.
 */
async function respond(pageId: string): Promise<BlockActionResult> {
  const actor = await getActor()
  const blocks = await listBlocks(actor, pageId)
  revalidatePath('/admin/pages')
  revalidatePath(`/admin/pages/${pageId}`)
  return { ok: true, blocks }
}

export async function listBlocksAction(input: {
  pageId: string
}): Promise<BlockActionResult> {
  const parsed = z.object({ pageId: PAGE_ID }).safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const blocks = await listBlocks(actor, parsed.data.pageId)
    return { ok: true, blocks }
  } catch (error) {
    return failed(error, 'block list failed')
  }
}

export async function addBlockAction(input: {
  pageId: string
  type: string
}): Promise<BlockActionResult> {
  const parsed = z
    .object({
      pageId: PAGE_ID,
      type: z.enum(BLOCK_TYPES as [string, ...string[]]),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await addBlock(actor, parsed.data)
    return respond(parsed.data.pageId)
  } catch (error) {
    return failed(error, 'block add failed')
  }
}

export async function removeBlockAction(input: {
  pageId: string
  id: string
}): Promise<BlockActionResult> {
  const parsed = z.object({ pageId: PAGE_ID, id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await removeBlock(actor, parsed.data)
    return respond(parsed.data.pageId)
  } catch (error) {
    return failed(error, 'block remove failed')
  }
}

export async function moveBlockAction(input: {
  pageId: string
  id: string
  direction: 'up' | 'down'
}): Promise<BlockActionResult> {
  const parsed = z
    .object({
      pageId: PAGE_ID,
      id: z.string().uuid(),
      direction: z.enum(['up', 'down']),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await moveBlock(actor, parsed.data)
    return respond(parsed.data.pageId)
  } catch (error) {
    return failed(error, 'block move failed')
  }
}

export async function setBlockEnabledAction(input: {
  pageId: string
  id: string
  enabled: boolean
}): Promise<BlockActionResult> {
  const parsed = z
    .object({ pageId: PAGE_ID, id: z.string().uuid(), enabled: z.boolean() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await setBlockEnabled(actor, parsed.data)
    return respond(parsed.data.pageId)
  } catch (error) {
    return failed(error, 'block visibility failed')
  }
}

export async function saveBlockAction(input: {
  pageId: string
  id: string
  anchor: string | null
  config: Record<string, unknown>
  text: Record<string, Record<string, unknown>>
}): Promise<BlockActionResult> {
  const parsed = z
    .object({
      pageId: PAGE_ID,
      id: z.string().uuid(),
      anchor: z
        .string()
        // An anchor becomes a URL fragment, so it is restricted to what can
        // appear in one rather than trusted to be sensible.
        .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers and hyphens.')
        .max(64)
        .nullable(),
      config: PROPS,
      text: z.record(z.enum(LOCALES), PROPS),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid request.' }
  }

  try {
    const actor = await getActor()
    await saveBlock(actor, parsed.data)
    return respond(parsed.data.pageId)
  } catch (error) {
    return failed(error, 'block save failed')
  }
}
