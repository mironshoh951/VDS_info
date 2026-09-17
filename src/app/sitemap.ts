import type { MetadataRoute } from 'next'
import { db } from '@/server/db/client'
import { getSettings, getLocaleSettings } from '@/server/modules/settings/service'
import { LOCALE_DESCRIPTORS, type Locale } from '@/i18n/config'
import { logger } from '@/lib/logger'

/**
 * sitemap.xml (§38).
 *
 * Every entry carries its `alternates.languages` map, which is how a
 * multilingual site tells a crawler that four URLs are one document rather
 * than four competing ones.
 *
 * A locale is listed for an entity only when that entity actually has an
 * approved translation in it. Advertising a language that silently falls back
 * to English is worse for ranking than not advertising it at all.
 */

export const revalidate = 3600

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/** Locales in which a translation is publishable. */
const SITEMAP_STATUSES = ['APPROVED'] as const

type Entry = MetadataRoute.Sitemap[number]

function buildEntry(
  base: string,
  enabledLocales: Locale[],
  pathByLocale: Partial<Record<Locale, string>>,
  options: {
    lastModified?: Date
    changeFrequency?: Entry['changeFrequency']
    priority?: number
  },
): Entry[] {
  const available = enabledLocales.filter((locale) => pathByLocale[locale] !== undefined)
  if (available.length === 0) return []

  const languages: Record<string, string> = {}
  for (const locale of available) {
    languages[LOCALE_DESCRIPTORS[locale].bcp47] =
      `${base}/${locale}${pathByLocale[locale] ? `/${pathByLocale[locale]}` : ''}`
  }

  return available.map((locale) => ({
    url: `${base}/${locale}${pathByLocale[locale] ? `/${pathByLocale[locale]}` : ''}`,
    ...(options.lastModified ? { lastModified: options.lastModified } : {}),
    ...(options.changeFrequency ? { changeFrequency: options.changeFrequency } : {}),
    ...(options.priority !== undefined ? { priority: options.priority } : {}),
    alternates: { languages },
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()

  try {
    const [seoSettings, { enabledLocales }] = await Promise.all([
      getSettings('site.seo'),
      getLocaleSettings(),
    ])

    // Nothing is advertised to crawlers until indexing is switched on for
    // launch. A staging deployment that quietly submits a sitemap is a
    // problem that is hard to undo.
    if (!seoSettings.robotsAllowIndexing) return []

    const localeSet = enabledLocales

    const [products, partners, brands, services, events, articles, resources, pages] =
      await Promise.all([
        db.product.findMany({
          where: { status: 'PUBLISHED', deletedAt: null, visibility: 'PUBLIC' },
          select: {
            slug: true,
            updatedAt: true,
            translations: {
              where: { status: { in: [...SITEMAP_STATUSES] } },
              select: { locale: true, slug: true },
            },
          },
        }),
        db.partner.findMany({
          where: { status: 'PUBLISHED', deletedAt: null },
          select: {
            slug: true,
            updatedAt: true,
            translations: {
              where: { status: { in: [...SITEMAP_STATUSES] } },
              select: { locale: true, slug: true },
            },
          },
        }),
        db.brand.findMany({
          where: { status: 'PUBLISHED', deletedAt: null },
          select: {
            slug: true,
            updatedAt: true,
            translations: {
              where: { status: { in: [...SITEMAP_STATUSES] } },
              select: { locale: true, slug: true },
            },
          },
        }),
        db.service.findMany({
          where: { status: 'PUBLISHED', deletedAt: null },
          select: {
            slug: true,
            updatedAt: true,
            translations: {
              where: { status: { in: [...SITEMAP_STATUSES] } },
              select: { locale: true, slug: true },
            },
          },
        }),
        db.event.findMany({
          where: { status: 'PUBLISHED', deletedAt: null },
          select: {
            slug: true,
            updatedAt: true,
            translations: {
              where: { status: { in: [...SITEMAP_STATUSES] } },
              select: { locale: true, slug: true },
            },
          },
        }),
        db.article.findMany({
          where: { status: 'PUBLISHED', deletedAt: null },
          select: {
            slug: true,
            updatedAt: true,
            translations: {
              where: { status: { in: [...SITEMAP_STATUSES] } },
              select: { locale: true, slug: true },
            },
          },
        }),
        db.resource.findMany({
          where: { status: 'PUBLISHED', deletedAt: null, visibility: 'PUBLIC' },
          select: {
            slug: true,
            updatedAt: true,
            translations: {
              where: { status: { in: [...SITEMAP_STATUSES] } },
              select: { locale: true, slug: true },
            },
          },
        }),
        db.page.findMany({
          where: { status: 'PUBLISHED', deletedAt: null, showInSitemap: true },
          select: {
            slug: true,
            systemKey: true,
            updatedAt: true,
            translations: {
              where: { status: { in: [...SITEMAP_STATUSES] } },
              select: { locale: true, slug: true },
            },
          },
        }),
      ])

    const entries: MetadataRoute.Sitemap = []

    // Static index routes exist in every enabled locale.
    const indexRoutes: Array<{
      path: string
      priority: number
      frequency: Entry['changeFrequency']
    }> = [
      { path: '', priority: 1, frequency: 'weekly' },
      { path: 'products', priority: 0.9, frequency: 'weekly' },
      { path: 'partners', priority: 0.8, frequency: 'weekly' },
      { path: 'brands', priority: 0.7, frequency: 'monthly' },
      { path: 'services', priority: 0.7, frequency: 'monthly' },
      { path: 'events', priority: 0.6, frequency: 'weekly' },
      { path: 'news', priority: 0.6, frequency: 'daily' },
      { path: 'resources', priority: 0.6, frequency: 'weekly' },
      { path: 'certificates', priority: 0.5, frequency: 'monthly' },
      { path: 'achievements', priority: 0.4, frequency: 'monthly' },
      { path: 'contact', priority: 0.7, frequency: 'yearly' },
    ]

    for (const route of indexRoutes) {
      const byLocale = Object.fromEntries(
        localeSet.map((locale) => [locale, route.path]),
      ) as Partial<Record<Locale, string>>
      entries.push(
        ...buildEntry(base, localeSet, byLocale, {
          priority: route.priority,
          changeFrequency: route.frequency,
        }),
      )
    }

    const collect = (
      rows: Array<{
        slug: string
        updatedAt: Date
        translations: { locale: string; slug: string | null }[]
      }>,
      prefix: string,
      priority: number,
      frequency: Entry['changeFrequency'],
    ) => {
      for (const row of rows) {
        const byLocale: Partial<Record<Locale, string>> = {}
        for (const translation of row.translations) {
          const locale = translation.locale as Locale
          if (!localeSet.includes(locale)) continue
          const slug = translation.slug ?? row.slug
          byLocale[locale] = prefix ? `${prefix}/${slug}` : slug
        }
        entries.push(
          ...buildEntry(base, localeSet, byLocale, {
            lastModified: row.updatedAt,
            priority,
            changeFrequency: frequency,
          }),
        )
      }
    }

    collect(products, 'products', 0.8, 'weekly')
    collect(partners, 'partners', 0.7, 'monthly')
    collect(brands, 'brands', 0.6, 'monthly')
    collect(services, 'services', 0.6, 'monthly')
    collect(events, 'events', 0.5, 'monthly')
    collect(articles, 'news', 0.6, 'monthly')
    collect(resources, 'resources', 0.5, 'monthly')

    // The home and contact pages already appear as index routes.
    collect(
      pages.filter((page) => page.systemKey !== 'home' && page.systemKey !== 'contact'),
      '',
      0.5,
      'monthly',
    )

    return entries
  } catch (error) {
    // A sitemap that 500s is worse than an empty one: crawlers back off from
    // the whole site after repeated errors.
    logger.error({ err: error }, 'sitemap generation failed')
    return []
  }
}
