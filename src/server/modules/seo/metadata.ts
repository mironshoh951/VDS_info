import type { Metadata } from 'next'
import { db } from '@/server/db/client'
import { getSettings } from '@/server/modules/settings/service'
import { LOCALES, LOCALE_DESCRIPTORS, type Locale } from '@/i18n/config'
import type { EntityType } from '@/server/db/generated/enums'

/**
 * Metadata construction for public pages (§38).
 *
 * Three things every page needs and that are easy to get subtly wrong:
 *
 *  - **Canonical** must point at the locale being rendered, not the default
 *    one, or the four language versions compete with each other.
 *  - **hreflang** must list only locales that are enabled *and* have usable
 *    content, plus `x-default`. Advertising a translation that falls back to
 *    English is worse than not advertising it.
 *  - **Indexing** stays off site-wide until a Super Admin turns it on, so a
 *    staging deployment cannot quietly index itself.
 */

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export interface PageMetaInput {
  locale: Locale
  /** Path after the locale segment, e.g. "products/dental-composite". */
  path: string
  title: string
  description?: string | null
  imageUrl?: string | null
  /** Locales that actually have content for this page, with their own slugs. */
  alternates?: Partial<Record<Locale, string>>
  type?: 'website' | 'article'
  publishedTime?: Date | null
  modifiedTime?: Date | null
  noindex?: boolean
}

export async function buildMetadata(input: PageMetaInput): Promise<Metadata> {
  const [seo, general] = await Promise.all([
    getSettings('site.seo', input.locale),
    getSettings('site.general', input.locale),
  ])

  const base = siteUrl()
  const canonical = `${base}/${input.locale}${input.path ? `/${input.path}` : ''}`
  const siteName = general.siteName || undefined

  const languages: Record<string, string> = {}
  for (const locale of LOCALES) {
    const slug = input.alternates?.[locale]
    if (input.alternates && !slug) continue
    const suffix = slug ?? input.path
    languages[LOCALE_DESCRIPTORS[locale].bcp47] =
      `${base}/${locale}${suffix ? `/${suffix}` : ''}`
  }
  languages['x-default'] = `${base}/${input.locale}${input.path ? `/${input.path}` : ''}`

  const indexable = seo.robotsAllowIndexing && !input.noindex

  return {
    title: input.title,
    description: input.description ?? seo.defaultDescription ?? undefined,
    alternates: { canonical, languages },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: input.type ?? 'website',
      url: canonical,
      title: input.title,
      description: input.description ?? undefined,
      siteName,
      locale: LOCALE_DESCRIPTORS[input.locale].bcp47,
      ...(input.imageUrl ? { images: [{ url: input.imageUrl }] } : {}),
      ...(input.publishedTime
        ? { publishedTime: input.publishedTime.toISOString() }
        : {}),
      ...(input.modifiedTime ? { modifiedTime: input.modifiedTime.toISOString() } : {}),
    },
    twitter: {
      card: input.imageUrl ? 'summary_large_image' : 'summary',
      title: input.title,
      description: input.description ?? undefined,
    },
  }
}

/**
 * Per-entity SEO overrides entered in the admin panel win over the values a
 * template derives from the content itself.
 */
export async function seoOverride(
  entityType: EntityType,
  entityId: string,
  locale: Locale,
): Promise<{ title?: string; description?: string; noindex?: boolean } | null> {
  const row = await db.seoMeta
    .findUnique({
      where: { entityType_entityId_locale: { entityType, entityId, locale } },
      select: { title: true, description: true, noindex: true },
    })
    .catch(() => null)

  if (!row) return null

  return {
    ...(row.title ? { title: row.title } : {}),
    ...(row.description ? { description: row.description } : {}),
    noindex: row.noindex,
  }
}

/** Truncates a description to a length search engines actually display. */
export function metaDescription(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length <= 160 ? clean : `${clean.slice(0, 157).trimEnd()}…`
}
