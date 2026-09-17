'use client'

import { useLayoutEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { SITE_THEME_COOKIE, SITE_THEME_MAX_AGE, applyStoredTheme } from '@/lib/site-theme'

/**
 * Light/dark toggle for the public site.
 *
 * Entirely client-side, and deliberately so. The server never learns the
 * visitor's theme — reading the cookie during render would make every public
 * page dynamic and throw away the 5-minute cache the whole site depends on —
 * so this writes the cookie and flips the attribute itself. The bootstrap
 * script in the layout is what restores the choice on the next page load.
 *
 * Both icons are always rendered and the stylesheet hides one. Choosing in
 * JavaScript instead would mean the button renders on the server without
 * knowing the theme, which is a guaranteed hydration mismatch.
 *
 * It also re-applies the stored theme on every render. That is not belt and
 * braces: switching language changes a route segment, so React remounts the
 * layout that owns `<html>` and re-renders it without `data-theme`. Without
 * this the page would quietly revert to light on every language switch.
 */
export function SiteThemeSwitcher({ label }: { label: string }) {
  // Before paint, not after: a `useEffect` here would let one frame of the
  // wrong palette through every time somebody switches language.
  useLayoutEffect(() => {
    applyStoredTheme()
  })

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="theme-toggle inline-flex h-11 w-11 items-center justify-center rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      onClick={() => {
        const root = document.documentElement
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
        root.dataset.theme = next
        document.cookie = `${SITE_THEME_COOKIE}=${next}; path=/; max-age=${SITE_THEME_MAX_AGE}; samesite=lax`
      }}
    >
      <Moon className="theme-icon-dark h-4 w-4" aria-hidden="true" />
      <Sun className="theme-icon-light h-4 w-4" aria-hidden="true" />
    </button>
  )
}
