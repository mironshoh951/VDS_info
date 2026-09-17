'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import {
  ADMIN_THEME_COOKIE,
  ADMIN_THEME_MAX_AGE,
  isAdminTheme,
} from '@/server/admin/theme'

/**
 * Stores the panel's light/dark choice.
 *
 * Like the language, this changes appearance and nothing else, so it carries
 * no capability check. An unrecognised value is ignored rather than written.
 */
export async function setAdminThemeAction(formData: FormData): Promise<void> {
  const requested = String(formData.get('theme') ?? '')
  if (!isAdminTheme(requested)) return

  const store = await cookies()
  store.set(ADMIN_THEME_COOKIE, requested, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_THEME_MAX_AGE,
  })

  revalidatePath('/admin', 'layout')
}
