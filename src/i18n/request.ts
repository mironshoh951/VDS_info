import { getRequestConfig } from 'next-intl/server'
import { LOCALES, DEFAULT_LOCALE, isLocale, LOCALE_DESCRIPTORS } from './config'

/**
 * Per-request i18n configuration.
 *
 * Messages come from the shipped catalogue and are then overlaid with any
 * Super Admin overrides stored in `UiTranslation`, so interface wording can be
 * corrected without a deploy (§6.1). The overlay is cached; a failure to read
 * it degrades to the shipped catalogue rather than breaking the page.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = requested && isLocale(requested) ? requested : DEFAULT_LOCALE

  const base = (await import(`../../messages/${locale}.json`)).default as Record<
    string,
    unknown
  >

  const overrides = await loadOverrides(locale)
  const messages = overrides ? deepMerge(base, overrides) : base

  return {
    locale,
    messages,
    timeZone: 'Asia/Tashkent',
    formats: {
      dateTime: {
        short: { day: 'numeric', month: 'short', year: 'numeric' },
        long: { day: 'numeric', month: 'long', year: 'numeric' },
      },
      number: {
        integer: { maximumFractionDigits: 0 },
      },
    },
    now: new Date(),
    onError(error) {
      // A missing message must never break a page; it is a content problem,
      // surfaced in the admin translation dashboard instead.
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] ${error.message}`)
      }
    },
    getMessageFallback({ namespace, key }) {
      const path = [namespace, key].filter(Boolean).join('.')
      return process.env.NODE_ENV === 'development' ? `⟦${path}⟧` : ''
    },
  }
})

type MessageTree = Record<string, unknown>

function deepMerge(base: MessageTree, overlay: MessageTree): MessageTree {
  const out: MessageTree = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    const existing = out[key]
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof existing === 'object' &&
      existing !== null &&
      !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing as MessageTree, value as MessageTree)
    } else {
      out[key] = value
    }
  }
  return out
}

/**
 * Loads admin overrides. Imported lazily so that the i18n layer has no
 * hard dependency on the database during build-time rendering of static
 * error pages.
 */
async function loadOverrides(locale: string): Promise<MessageTree | null> {
  if (process.env.SKIP_UI_TRANSLATION_OVERRIDES === '1') return null
  try {
    const { getUiTranslationOverrides } =
      await import('@/server/modules/i18n/ui-translations')
    return await getUiTranslationOverrides(locale)
  } catch {
    return null
  }
}

export { LOCALES, LOCALE_DESCRIPTORS }
