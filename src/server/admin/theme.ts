import { cookies } from 'next/headers'

/**
 * Light or dark for the administration panel.
 *
 * Stored in a cookie and read on the server so the correct theme is in the
 * very first HTML the browser parses. A theme applied later, from JavaScript,
 * shows the wrong one for a frame — and on a panel someone opens fifty times a
 * day that flash is the difference between a considered interface and a cheap
 * one.
 *
 * Two explicit choices rather than three: "follow the system" needs the same
 * palette declared a second time inside a media query, and two copies of a
 * palette drift. A person who wants dark can say so.
 */

export const ADMIN_THEME_COOKIE = 'vds_admin_theme'
export const ADMIN_THEME_MAX_AGE = 60 * 60 * 24 * 365

export const ADMIN_THEMES = ['light', 'dark'] as const
export type AdminTheme = (typeof ADMIN_THEMES)[number]

export function isAdminTheme(value: string): value is AdminTheme {
  return (ADMIN_THEMES as readonly string[]).includes(value)
}

export async function getAdminTheme(): Promise<AdminTheme> {
  const store = await cookies()
  const value = store.get(ADMIN_THEME_COOKIE)?.value
  return value && isAdminTheme(value) ? value : 'light'
}
