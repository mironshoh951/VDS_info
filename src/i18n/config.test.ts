import { describe, expect, it } from 'vitest'
import {
  fallbackChain,
  negotiateLocale,
  isLocale,
  LOCALES,
  LOCALE_ORDER,
  DEFAULT_LOCALE,
} from './config'

describe('locale guards', () => {
  it('recognises exactly the four supported locales', () => {
    expect([...LOCALES]).toEqual(['en', 'ru', 'uz', 'zh'])
    expect(isLocale('de')).toBe(false)
    expect(isLocale('zh')).toBe(true)
  })
})

describe('fallback chain', () => {
  it('starts with the requested locale, then the default, then the rest', () => {
    expect(fallbackChain('uz', 'ru')).toEqual(['uz', 'ru', 'en', 'zh'])
  })

  it('does not repeat the requested locale when it is also the default', () => {
    const chain = fallbackChain('en', 'en')
    expect(chain[0]).toBe('en')
    expect(chain.filter((l) => l === 'en')).toHaveLength(1)
  })
})

describe('Accept-Language negotiation', () => {
  const enabled = ['en', 'ru', 'uz', 'zh'] as const

  it('honours quality ordering rather than header order', () => {
    expect(negotiateLocale('en;q=0.4, ru;q=0.9', enabled, 'en')).toBe('ru')
  })

  it('maps regional Chinese tags to the single zh locale', () => {
    expect(negotiateLocale('zh-CN,zh;q=0.9', enabled, 'en')).toBe('zh')
    expect(negotiateLocale('zh-Hans-SG', enabled, 'en')).toBe('zh')
  })

  it('skips languages that are disabled in admin settings', () => {
    expect(negotiateLocale('ru,en;q=0.8', ['en', 'uz'], 'en')).toBe('en')
  })

  it('falls back to the site default for unknown languages', () => {
    expect(negotiateLocale('de-DE,fr;q=0.7', enabled, 'ru')).toBe('ru')
    expect(negotiateLocale(null, enabled, 'uz')).toBe('uz')
  })
})

describe('source language', () => {
  it('orders the editor tabs with the source language first', () => {
    // The source language is the one that has to be filled in; the rest are
    // translations of it, so it leads.
    expect(LOCALE_ORDER[0]).toBe(DEFAULT_LOCALE)
  })

  it('offers every locale exactly once in the tab order', () => {
    // A locale missing here would be unreachable in the editor while still
    // being served on the public site — an invisible content gap.
    expect([...LOCALE_ORDER].sort()).toEqual([...LOCALES].sort())
  })

  it('agrees with the stored default-locale setting', async () => {
    // Two different things answer "what is the default language": this
    // constant, which the editor and the completeness matrix use, and the
    // `site.i18n.defaultLocale` setting, which the public site falls back to.
    // They have to start out the same, or a fresh install writes content in
    // one language and serves fallbacks in another.
    const { settingsRegistry } = await import('@/server/modules/settings/registry')
    expect(settingsRegistry['site.i18n'].defaultLocale.default).toBe(DEFAULT_LOCALE)
  })
})
