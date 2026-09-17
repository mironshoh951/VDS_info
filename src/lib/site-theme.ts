/**
 * The public site's light/dark theme.
 *
 * In `lib/` rather than `server/` on purpose: the toggle is a client component
 * and needs the cookie name as a value, and anything under `server/` drags its
 * dependencies into the browser bundle when a client component imports it.
 * There are no imports here at all, which is what makes that safe.
 *
 * The theme is applied by a tiny script that runs before first paint, not by
 * the server.
 *
 * The obvious alternative — read the cookie in the layout and stamp
 * `<html data-theme>` — is what the admin panel does, and it is right there
 * because the panel is `force-dynamic` anyway. The public site is not: every
 * page carries `revalidate = 300`, and a single `cookies()` call in the shared
 * layout opts the whole tree out of that cache and puts a database round trip
 * on every visit.
 *
 * So the choice is between a cached site with one blocking inline script, or an
 * uncached site with none. The script wins: it is 200 bytes, it runs before
 * anything paints so there is no flash, and it falls back to the visitor's
 * operating-system preference when they have never chosen.
 *
 * Because it is inline it needs a Content-Security-Policy allowance. A nonce is
 * not usable — reading the per-request nonce means `headers()`, which is a
 * dynamic API and loses exactly the caching this exists to preserve — so the
 * script is a constant and the policy carries its hash. That is why the string
 * below must not be edited casually: change one byte and the hash no longer
 * matches, the browser refuses to run it, and the site silently reverts to
 * light. `npm run theme:hash` recomputes it and the unit test fails loudly if
 * the two ever drift apart.
 */

export const SITE_THEME_COOKIE = 'vds_site_theme'
export const SITE_THEME_MAX_AGE = 60 * 60 * 24 * 365

export const SITE_THEMES = ['light', 'dark'] as const
export type SiteTheme = (typeof SITE_THEMES)[number]

export function isSiteTheme(value: string): value is SiteTheme {
  return (SITE_THEMES as readonly string[]).includes(value)
}

export const THEME_INIT_SCRIPT =
  "!function(){try{var c=document.cookie.match(/(?:^|;\\s*)vds_site_theme=(light|dark)/);document.documentElement.dataset.theme=c?c[1]:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}}()"

/**
 * SHA-256 of THEME_INIT_SCRIPT, base64, in CSP source form. Regenerate with
 * `npm run theme:hash` whenever the script changes.
 */
export const THEME_INIT_SCRIPT_HASH =
  "'sha256-eVj74rp52+3mw7rtLPF0/Pk8zp86fjid3kofDJ2g9IQ='"

/**
 * Re-applies the stored theme on the client.
 *
 * The pre-paint script above owns the first paint of a full page load. This
 * owns everything after it — specifically the moment a visitor switches
 * language, which changes a route segment and so remounts the layout that
 * carries `<html>`. React re-renders that element without `data-theme` and the
 * page silently reverts to light until the next reload.
 *
 * Kept deliberately equivalent to the script rather than shared with it: the
 * script has to be one constant string whose hash is in the
 * Content-Security-Policy, so it cannot call a function from here.
 */
export function applyStoredTheme(): void {
  try {
    // Switching language changes a route segment, so React remounts the layout
    // that owns <head> and inserts a fresh copy of the bootstrap script. React
    // never executes a script it creates on the client, so each copy is inert —
    // but they accumulate, one per switch, for the life of the page. The first
    // one is the live one; the rest are litter.
    const copies = document.head.querySelectorAll('script[data-theme-init]')
    for (let i = 1; i < copies.length; i += 1) copies[i]?.remove()

    const match = document.cookie.match(/(?:^|;\s*)vds_site_theme=(light|dark)/)
    const theme =
      match?.[1] ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    if (document.documentElement.dataset.theme !== theme) {
      document.documentElement.dataset.theme = theme
    }
  } catch {
    // Blocked cookies or a locked-down browser. Light is the honest fallback.
  }
}
