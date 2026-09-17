import { fallbackChain, type Locale } from '@/i18n/config'
import type { TranslationStatus } from '@/server/db/generated/enums'

/**
 * Locale resolution for content read by the public site.
 *
 * Two rules, applied consistently everywhere:
 *
 *  1. **Visibility.** AI-generated drafts are not shown to visitors unless a
 *     Super Admin has explicitly allowed it (§27). Approved, human-drafted and
 *     outdated translations are all visible — "outdated" means the source
 *     changed, not that the text is wrong, and pulling live content because an
 *     editor touched the English would be worse than showing it.
 *
 *  2. **Fallback.** If the requested locale has nothing usable, the default
 *     locale is used, then any other locale that does. A page never renders an
 *     empty heading (§6.4).
 */

export const PUBLIC_TRANSLATION_STATUSES: TranslationStatus[] = [
  'APPROVED',
  'HUMAN_DRAFT',
  'OUTDATED',
]

export const PUBLIC_TRANSLATION_STATUSES_WITH_AI: TranslationStatus[] = [
  ...PUBLIC_TRANSLATION_STATUSES,
  'AI_DRAFT',
]

export function visibleStatuses(publishAiDrafts: boolean): TranslationStatus[] {
  return publishAiDrafts
    ? PUBLIC_TRANSLATION_STATUSES_WITH_AI
    : PUBLIC_TRANSLATION_STATUSES
}

export interface LocaleContext {
  locale: Locale
  defaultLocale: Locale
  publishAiDrafts: boolean
}

interface HasLocale {
  locale: string
}

/**
 * Picks the best translation from a set, following the fallback chain.
 * Returns both the row and which locale it came from, so a template can mark
 * fallback content in development without guessing.
 */
export function pickTranslation<T extends HasLocale>(
  translations: T[],
  context: LocaleContext,
): { translation: T; usedLocale: Locale; isFallback: boolean } | null {
  if (translations.length === 0) return null

  for (const candidate of fallbackChain(context.locale, context.defaultLocale)) {
    const match = translations.find((row) => row.locale === candidate)
    if (match) {
      return {
        translation: match,
        usedLocale: candidate,
        isFallback: candidate !== context.locale,
      }
    }
  }

  // Nothing in the chain matched, which can only happen if a locale outside
  // the supported set exists in the database. Take whatever is there rather
  // than rendering nothing.
  const first = translations[0]
  return first
    ? { translation: first, usedLocale: context.locale, isFallback: true }
    : null
}

/**
 * The `where` clause for loading candidate translations. Loading only the
 * requested and default locales keeps the query small; the rare third-locale
 * fallback is handled by a second lookup in the few places that need it.
 */
export function translationFilter(context: LocaleContext) {
  return {
    locale: { in: [context.locale, context.defaultLocale] },
    status: { in: visibleStatuses(context.publishAiDrafts) },
  }
}

/** Resolved slug for a URL: the localized one if present, else the base slug. */
export function resolveSlug(
  baseSlug: string,
  translation: { slug?: string | null } | null | undefined,
): string {
  return translation?.slug ?? baseSlug
}

/** Builds a locale-prefixed path. */
export function localePath(locale: Locale, ...segments: string[]): string {
  const path = segments.filter(Boolean).join('/')
  return path.length > 0 ? `/${locale}/${path}` : `/${locale}`
}
