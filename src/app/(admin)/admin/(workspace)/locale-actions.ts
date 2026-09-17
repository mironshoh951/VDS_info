'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { isLocale } from '@/i18n/config'
import { ADMIN_LOCALE_COOKIE, ADMIN_LOCALE_MAX_AGE } from '@/server/admin/locale'

/**
 * Stores the admin interface language.
 *
 * Nothing about this is privileged — it changes wording, not access — so it
 * carries no capability check. An unrecognised value is ignored rather than
 * written, so the cookie can only ever hold a supported locale.
 */
export async function setAdminLocaleAction(formData: FormData): Promise<void> {
  const requested = String(formData.get('locale') ?? '')
  if (!isLocale(requested)) return

  const store = await cookies()
  store.set(ADMIN_LOCALE_COOKIE, requested, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_LOCALE_MAX_AGE,
  })

  revalidatePath('/admin', 'layout')
}
