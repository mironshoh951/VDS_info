import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { THEME_INIT_SCRIPT, THEME_INIT_SCRIPT_HASH, isSiteTheme } from './site-theme'

describe('public theme bootstrap', () => {
  it('carries a CSP hash that matches the script', () => {
    // If this fails the script was edited without running `npm run theme:hash`.
    // The browser would refuse to execute it and the site would be stuck on
    // light with nothing in the UI to say why — so it is worth a hard failure.
    const hash = createHash('sha256').update(THEME_INIT_SCRIPT, 'utf8').digest('base64')
    expect(THEME_INIT_SCRIPT_HASH).toBe(`'sha256-${hash}'`)
  })

  it('reads only the values the stylesheet knows about', () => {
    expect(THEME_INIT_SCRIPT).toContain('vds_site_theme')
    expect(THEME_INIT_SCRIPT).toContain('light|dark')
  })

  it('never throws, so a blocked cookie cannot stop the page rendering', () => {
    expect(THEME_INIT_SCRIPT).toContain('try{')
    expect(THEME_INIT_SCRIPT).toContain('catch')
  })

  it('accepts only known themes', () => {
    expect(isSiteTheme('dark')).toBe(true)
    expect(isSiteTheme('light')).toBe(true)
    expect(isSiteTheme('sepia')).toBe(false)
    expect(isSiteTheme('')).toBe(false)
  })
})
