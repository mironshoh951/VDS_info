/**
 * Supported locales.
 *
 * The *set* of shippable locales is a compile-time constant because routing,
 * message catalogues and type-safety depend on it. Which of them are
 * **enabled**, and which is **default**, is runtime configuration held in the
 * `Locale` table and editable by a Super Admin (§2.1).
 *
 * Adding a fifth language later means adding it here plus a catalogue — the
 * architecture does not otherwise resist it.
 */

export const LOCALES = ['en', 'ru', 'uz', 'zh'] as const
export type Locale = (typeof LOCALES)[number]

/**
 * The source language.
 *
 * This is the language content is *written* in, not merely one of four: it is
 * what the translation completeness matrix measures against, what `sourceHash`
 * is computed from, what a record falls back to when a translation is missing,
 * and the one title the editor insists on. The people filling this catalogue
 * work in Uzbek, so that is the source.
 *
 * Changing it is a content decision with a visible consequence: every existing
 * translation was hashed against the previous source, so the first save of a
 * record after the change marks the others outdated. That is correct — they
 * were approved against text that is no longer the reference.
 */
export const DEFAULT_LOCALE: Locale = 'uz'

/**
 * Tab order in the editor. The source language comes first because it is the
 * one that has to be filled in; the rest are translations of it.
 */
export const LOCALE_ORDER: readonly Locale[] = ['uz', 'ru', 'en', 'zh']

export interface LocaleDescriptor {
  code: Locale
  /** BCP-47 tag for Intl formatting. */
  bcp47: string
  nativeName: string
  englishName: string
  direction: 'ltr' | 'rtl'
  flagEmoji: string
}

export const LOCALE_DESCRIPTORS: Record<Locale, LocaleDescriptor> = {
  en: {
    code: 'en',
    bcp47: 'en',
    nativeName: 'English',
    englishName: 'English',
    direction: 'ltr',
    flagEmoji: '🇬🇧',
  },
  ru: {
    code: 'ru',
    bcp47: 'ru',
    nativeName: 'Русский',
    englishName: 'Russian',
    direction: 'ltr',
    flagEmoji: '🇷🇺',
  },
  uz: {
    code: 'uz',
    bcp47: 'uz-Latn',
    nativeName: "O'zbekcha",
    englishName: 'Uzbek',
    direction: 'ltr',
    flagEmoji: '🇺🇿',
  },
  zh: {
    code: 'zh',
    // Simplified Chinese — the written standard used in mainland China.
    bcp47: 'zh-Hans',
    nativeName: '中文',
    englishName: 'Chinese',
    direction: 'ltr',
    flagEmoji: '🇨🇳',
  },
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * Per-field fallback chain (§6.4). A page never renders an empty section: if
 * the requested locale has no approved translation for a field, the default
 * locale is used, then any other locale that does.
 */
export function fallbackChain(
  requested: Locale,
  defaultLocale: Locale = DEFAULT_LOCALE,
): Locale[] {
  const chain: Locale[] = [requested]
  if (defaultLocale !== requested) chain.push(defaultLocale)
  for (const locale of LOCALES) {
    if (!chain.includes(locale)) chain.push(locale)
  }
  return chain
}

/**
 * Negotiates a locale from an Accept-Language header against the enabled set.
 * Quality values are honoured; an unknown or disabled language falls through
 * to the site default.
 */
export function negotiateLocale(
  acceptLanguage: string | null,
  enabled: readonly Locale[],
  defaultLocale: Locale,
): Locale {
  if (!acceptLanguage || enabled.length === 0) return defaultLocale

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.find((p) => p.trim().startsWith('q='))
      const q = qParam ? Number.parseFloat(qParam.split('=')[1] ?? '1') : 1
      return { tag: (tag ?? '').trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q }
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q)

  for (const { tag } of ranked) {
    const primary = tag.split('-')[0] ?? ''
    // zh-CN, zh-Hans, zh-SG all map to our single Chinese locale.
    const candidate = primary as Locale
    if (isLocale(candidate) && enabled.includes(candidate)) return candidate
  }

  return defaultLocale
}
