'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import {
  exportResource,
  exportTemplate,
  importResource,
  type ImportReport,
} from '@/server/modules/admin/transfer'
import { RESOURCES, type ResourceKey } from '@/server/modules/admin/resources'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

/**
 * Import and export, as server actions rather than download endpoints.
 *
 * A file download would need its own authenticated route, and a second
 * authenticated surface is a second place for the capability check to be
 * forgotten. The action returns the text and the browser turns it into a file,
 * which keeps every admin write and read behind the one gate the workspace
 * layout already enforces.
 */

const RESOURCE = z.enum(Object.keys(RESOURCES) as [ResourceKey, ...ResourceKey[]])
const FORMAT = z.enum(['csv', 'json'])

/** An import file large enough to be a mistake rather than a catalogue. */
const MAX_IMPORT_BYTES = 8_000_000

export interface ExportActionResult {
  ok: boolean
  filename?: string
  mimeType?: string
  body?: string
  rowCount?: number
  message?: string
}

export async function exportResourceAction(input: {
  resourceKey: string
  format: string
  template?: boolean
}): Promise<ExportActionResult> {
  const parsed = z
    .object({
      resourceKey: RESOURCE,
      format: FORMAT,
      template: z.boolean().optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const file = parsed.data.template
      ? await exportTemplate(actor, parsed.data.resourceKey)
      : await exportResource(actor, {
          resourceKey: parsed.data.resourceKey,
          format: parsed.data.format,
        })

    return { ok: true, ...file }
  } catch (error) {
    if (isAppError(error)) return { ok: false, message: error.message }
    logger.error({ err: error }, 'export failed')
    return { ok: false, message: 'Something went wrong.' }
  }
}

export interface ImportActionResult {
  ok: boolean
  report?: ImportReport
  message?: string
}

export async function importResourceAction(input: {
  resourceKey: string
  format: string
  text: string
  dryRun: boolean
}): Promise<ImportActionResult> {
  const parsed = z
    .object({
      resourceKey: RESOURCE,
      format: FORMAT,
      text: z.string().min(1).max(MAX_IMPORT_BYTES),
      dryRun: z.boolean(),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Choose a file with content, under 8 MB.' }
  }

  try {
    const actor = await getActor()
    const report = await importResource(actor, parsed.data)

    // Only a real import changes what the lists show.
    if (!parsed.data.dryRun) {
      revalidatePath(`/admin/${RESOURCES[parsed.data.resourceKey].path}`)
    }

    return { ok: true, report }
  } catch (error) {
    if (isAppError(error)) return { ok: false, message: error.message }
    logger.error({ err: error }, 'import failed')
    return { ok: false, message: 'Something went wrong.' }
  }
}
