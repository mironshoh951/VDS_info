'use server'

import { cookies } from 'next/headers'
import {
  SITE_THEME_COOKIE,
  SITE_THEME_MAX_AGE,
  isSiteTheme,
} from './theme'

/**
 * Stores a visitor's light/dark choice.
 *
 * Not `httpOnly`: unlike a session, this value is not a secret, and leaving it
 * readable lets client code avoid a round trip if it ever needs to. An
 * unrecognised value is ignored rather than written, so the cookie can only
 * ever hold a theme the stylesheet knows about.
 */
export async function setSiteThemeAction(formData: FormData): Promise<void> {
  const requested = String(formData.get('theme') ?? '')
  if (!isSiteTheme(requested)) return

  const store = await cookies()
  store.set(SITE_THEME_COOKIE, requested, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SITE_THEME_MAX_AGE,
  })
}
