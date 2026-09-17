'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import {
  CATEGORY_KINDS,
  deleteCategory,
  saveCategory,
  type CategoryKind,
} from '@/server/modules/catalog/categories'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface CategoryActionResult {
  ok: boolean
  id?: string
  message?: string
  fieldErrors?: Record<string, string>
}

const kindSchema = z.enum(CATEGORY_KINDS as unknown as [CategoryKind, ...CategoryKind[]])

export async function saveCategoryAction(input: {
  kind: string
  id: string | null
  slug: string
  parentId: string | null
  sortOrder: number
  enabled: boolean
  featured: boolean
  names: Record<string, string>
}): Promise<CategoryActionResult> {
  const parsed = z
    .object({
      kind: kindSchema,
      id: z.string().uuid().nullable(),
      slug: z.string().min(1).max(120),
      parentId: z.string().uuid().nullable(),
      sortOrder: z.number().int().min(0).max(9999),
      enabled: z.boolean(),
      featured: z.boolean(),
      names: z.record(z.string(), z.string().max(200)),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const result = await saveCategory(actor, parsed.data)
    revalidatePath('/admin/categories')
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
    logger.error({ err: error }, 'category save failed')
    return { ok: false, message: 'Something went wrong while saving.' }
  }
}

export async function deleteCategoryAction(input: {
  kind: string
  id: string
}): Promise<CategoryActionResult> {
  const parsed = z.object({ kind: kindSchema, id: z.string().uuid() }).safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await deleteCategory(actor, parsed.data)
    revalidatePath('/admin/categories')
    return { ok: true }
  } catch (error) {
    if (isAppError(error)) return { ok: false, message: error.message }
    logger.error({ err: error }, 'category delete failed')
    return { ok: false, message: 'Something went wrong while deleting.' }
  }
}
