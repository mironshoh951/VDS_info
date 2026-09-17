import { cookies } from 'next/headers'

/**
 * Light or dark for the public website.
 *
 * Deliberately a separate cookie from the admin panel's. They are different
 * surfaces used in different conditions — a catalogue read in daylight, a panel
 * worked in all evening — and an operator who wants the panel dark has not
 * thereby asked for the public site to be dark on the same machine.
 *
 * Read on the server so the right palette is in the first HTML the browser
 * parses. A theme applied afterwards from JavaScript paints one frame of the
 * wrong one, and that flash is what makes a site feel cheap.
 */

export const SITE_THEME_COOKIE = 'vds_site_theme'
export const SITE_THEME_MAX_AGE = 60 * 60 * 24 * 365

export const SITE_THEMES = ['light', 'dark'] as const
export type SiteTheme = (typeof SITE_THEMES)[number]

export function isSiteTheme(value: string): value is SiteTheme {
  return (SITE_THEMES as readonly string[]).includes(value)
}

export async function getSiteTheme(): Promise<SiteTheme> {
  const store = await cookies()
  const value = store.get(SITE_THEME_COOKIE)?.value
  return value && isSiteTheme(value) ? value : 'light'
}
