'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import {
  deleteMenuItem,
  moveMenuItem,
  saveMenu,
  saveMenuItem,
} from '@/server/modules/navigation/menu-admin'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface MenuActionResult {
  ok: boolean
  id?: string
  message?: string
  fieldErrors?: Record<string, string>
}

const TARGET = z.enum([
  'NONE',
  'ROUTE',
  'PAGE',
  'EXTERNAL_URL',
  'PRODUCT_CATEGORY',
  'PRODUCT',
  'SERVICE',
  'PARTNER',
  'BRAND',
  'EVENT',
  'ARTICLE',
])

function toResult(error: unknown, fallback: string): MenuActionResult {
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
  logger.error({ err: error }, fallback)
  return { ok: false, message: 'Something went wrong.' }
}

export async function saveMenuItemAction(input: {
  menuId: string
  id: string | null
  parentId: string | null
  target: string
  entityId: string | null
  routeKey: string | null
  externalUrl: string | null
  enabled: boolean
  openInNewTab: boolean
  highlight: boolean
  labels: Record<string, string>
}): Promise<MenuActionResult> {
  const parsed = z
    .object({
      menuId: z.string().uuid(),
      id: z.string().uuid().nullable(),
      parentId: z.string().uuid().nullable(),
      target: TARGET,
      entityId: z.string().uuid().nullable(),
      routeKey: z.string().max(80).nullable(),
      externalUrl: z.string().max(2000).nullable(),
      enabled: z.boolean(),
      openInNewTab: z.boolean(),
      highlight: z.boolean(),
      labels: z.record(z.string(), z.string().max(200)),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    const result = await saveMenuItem(actor, parsed.data)
    revalidatePath('/admin/menus')
    return { ok: true, id: result.id }
  } catch (error) {
    return toResult(error, 'menu item save failed')
  }
}

export async function deleteMenuItemAction(input: {
  id: string
}): Promise<MenuActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await deleteMenuItem(actor, parsed.data.id)
    revalidatePath('/admin/menus')
    return { ok: true }
  } catch (error) {
    return toResult(error, 'menu item delete failed')
  }
}

export async function moveMenuItemAction(input: {
  id: string
  direction: 'up' | 'down'
}): Promise<MenuActionResult> {
  const parsed = z
    .object({ id: z.string().uuid(), direction: z.enum(['up', 'down']) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await moveMenuItem(actor, parsed.data)
    revalidatePath('/admin/menus')
    return { ok: true }
  } catch (error) {
    return toResult(error, 'menu item move failed')
  }
}

export async function saveMenuAction(input: {
  id: string
  name: string
  enabled: boolean
}): Promise<MenuActionResult> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120),
      enabled: z.boolean(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await saveMenu(actor, parsed.data)
    revalidatePath('/admin/menus')
    return { ok: true }
  } catch (error) {
    return toResult(error, 'menu save failed')
  }
}
