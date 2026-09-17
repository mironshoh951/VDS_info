import { contentHash } from '../../src/lib/ids'
import { LOCALES, DEFAULT_LOCALE, type Locale } from '../../src/i18n/config'
import type { RichTextDocument } from '../../src/lib/rich-text'

/**
 * Seed helpers.
 *
 * Two small utilities that every seed module needs, kept here so the content
 * files stay readable.
 */

/**
 * Turns a per-locale map of fields into the translation rows Prisma expects.
 *
 * Every seeded translation is written as APPROVED with a correct `sourceHash`
 * derived from the default-locale content, so the translation dashboard shows
 * a truthful picture straight after seeding instead of flagging the sample
 * content as outdated.
 */
export function translationRows<T extends Record<string, unknown>>(
  byLocale: Record<Locale, T>,
): (T & {
  locale: Locale
  status: 'APPROVED'
  origin: 'IMPORT'
  sourceHash: string
  approvedAt: Date
})[] {
  // Freshness is measured against the source locale — the language content is
  // written in — not against English by habit.
  const hash = contentHash(byLocale[DEFAULT_LOCALE])
  const approvedAt = new Date()

  return LOCALES.map((locale) => ({
    ...byLocale[locale],
    locale,
    status: 'APPROVED' as const,
    origin: 'IMPORT' as const,
    sourceHash: hash,
    approvedAt,
  }))
}

/**
 * Builds a rich-text document from an array of paragraphs.
 *
 * Content is stored as a structured tree rather than HTML, so there is nothing
 * to sanitise on the way out — see `src/lib/rich-text.ts`.
 */
export function richDoc(paragraphs: string[]): RichTextDocument {
  return {
    type: 'doc',
    content: paragraphs
      .map((text) => text.trim())
      .filter((text) => text.length > 0)
      .map((text) => ({
        type: 'paragraph' as const,
        content: [{ type: 'text' as const, text }],
      })),
  }
}
