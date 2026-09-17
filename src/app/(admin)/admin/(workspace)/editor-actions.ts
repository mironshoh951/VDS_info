'use server'

import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import { saveRecord } from '@/server/modules/admin/editor-service'
import { RESOURCE_KEYS, type ResourceKey } from '@/server/modules/admin/resources'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface SaveResult {
  ok: boolean
  id?: string
  message?: string
  fieldErrors?: Record<string, string>
}

/**
 * Saves an edited record.
 *
 * The payload is deliberately loose (`unknown` values) because the field set
 * is driven by the form schema; coercion and validation happen in the service,
 * against that schema, so a crafted request cannot introduce a field the
 * content type does not have.
 */
export async function saveRecordAction(input: {
  resource: string
  id: string | null
  base: Record<string, unknown>
  translations: Record<string, Record<string, unknown>>
}): Promise<SaveResult> {
  const parsed = z
    .object({
      resource: z.enum(RESOURCE_KEYS as [ResourceKey, ...ResourceKey[]]),
      id: z.string().uuid().nullable(),
      base: z.record(z.string(), z.unknown()),
      translations: z.record(z.string(), z.record(z.string(), z.unknown())),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const result = await saveRecord(actor, {
      resourceKey: parsed.data.resource,
      id: parsed.data.id,
      base: parsed.data.base,
      translations: parsed.data.translations,
    })
    return { ok: true, id: result.id }
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === 'VALIDATION_FAILED' && error.details) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of error.details) {
          fieldErrors[issue.field] = issue.message ?? issue.code
        }
        return { ok: false, message: error.message, fieldErrors }
      }
      return { ok: false, message: error.message }
    }
    logger.error({ err: error }, 'record save failed')
    return { ok: false, message: 'Something went wrong while saving.' }
  }
}
