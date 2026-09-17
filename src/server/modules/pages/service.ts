import { db } from '@/server/db/client'
import { logger } from '@/lib/logger'
import type { Locale } from '@/i18n/config'

/**
 * Reading pages and their blocks for the public site.
 *
 * Per-field locale fallback is applied here rather than in components, so a
 * template can render without defensive checks and a missing translation
 * degrades to the default language instead of an empty section (§6.4).
 */

export interface ResolvedBlock {
  id: string
  type: string
  anchor: string | null
  /** Locale-independent configuration merged with localized text props. */
  props: Record<string, unknown>
  /** True when the localized props came from a fallback locale. */
  usedFallback: boolean
}

export interface ResolvedPage {
  id: string
  slug: string
  title: string
  subtitle: string | null
  summary: string | null
  template: string
  publishedAt: Date | null
  updatedAt: Date
  blocks: ResolvedBlock[]
}

interface LoadOptions {
  locale: Locale
  defaultLocale: Locale
  /** When false, AI drafts are not shown to visitors (§27). */
  publishAiDrafts: boolean
}

const VISIBLE_TRANSLATION_STATUSES = ['APPROVED', 'HUMAN_DRAFT', 'OUTDATED'] as const

export async function getPageBySystemKey(
  systemKey: string,
  options: LoadOptions,
): Promise<ResolvedPage | null> {
  return loadPage({ systemKey, status: 'PUBLISHED' }, options)
}

export async function getPageBySlug(
  slug: string,
  options: LoadOptions,
): Promise<ResolvedPage | null> {
  // A localized slug wins; the base slug is the fallback, which keeps old
  // links working when a translation introduces its own slug later.
  const translated = await db.pageTranslation.findFirst({
    where: { slug, locale: options.locale },
    select: { pageId: true },
  })

  if (translated) {
    return loadPage({ id: translated.pageId, status: 'PUBLISHED' }, options)
  }

  return loadPage({ slug, status: 'PUBLISHED' }, options)
}

type PageWhere =
  | { systemKey: string; status: 'PUBLISHED' }
  | { slug: string; status: 'PUBLISHED' }
  | { id: string; status: 'PUBLISHED' }

async function loadPage(
  where: PageWhere,
  options: LoadOptions,
): Promise<ResolvedPage | null> {
  const statuses = options.publishAiDrafts
    ? [...VISIBLE_TRANSLATION_STATUSES, 'AI_DRAFT' as const]
    : VISIBLE_TRANSLATION_STATUSES

  try {
    const page = await db.page.findFirst({
      where,
      select: {
        id: true,
        slug: true,
        template: true,
        publishedAt: true,
        updatedAt: true,
        translations: {
          where: {
            locale: { in: [options.locale, options.defaultLocale] },
            status: { in: [...statuses] },
          },
          select: {
            locale: true,
            slug: true,
            title: true,
            subtitle: true,
            summary: true,
          },
        },
        blocks: {
          where: { enabled: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            type: true,
            anchor: true,
            props: true,
            translations: {
              where: {
                locale: { in: [options.locale, options.defaultLocale] },
                status: { in: [...statuses] },
              },
              select: { locale: true, props: true },
            },
          },
        },
      },
    })

    if (!page) return null

    const translation =
      page.translations.find((t) => t.locale === options.locale) ??
      page.translations.find((t) => t.locale === options.defaultLocale)

    // A page with no usable translation in any candidate locale is not
    // renderable — better a 404 than a page of blank headings.
    if (!translation) return null

    return {
      id: page.id,
      slug: translation.slug ?? page.slug,
      title: translation.title,
      subtitle: translation.subtitle,
      summary: translation.summary,
      template: page.template,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
      blocks: page.blocks.map((block) => {
        const exact = block.translations.find((t) => t.locale === options.locale)
        const fallback = block.translations.find(
          (t) => t.locale === options.defaultLocale,
        )
        const localized = exact ?? fallback

        return {
          id: block.id,
          type: block.type,
          anchor: block.anchor,
          props: {
            ...((block.props as Record<string, unknown>) ?? {}),
            ...((localized?.props as Record<string, unknown>) ?? {}),
          },
          usedFallback: !exact && Boolean(fallback),
        }
      }),
    }
  } catch (error) {
    logger.error({ err: error, where }, 'page load failed')
    return null
  }
}

/** Every published page slug, for sitemap generation (§38). */
export async function listPublishedPagePaths(
  locale: Locale,
): Promise<{ slug: string; updatedAt: Date }[]> {
  const pages = await db.page.findMany({
    where: {
      status: 'PUBLISHED',
      showInSitemap: true,
      translations: { some: { locale, status: { in: ['APPROVED', 'HUMAN_DRAFT'] } } },
    },
    select: {
      slug: true,
      updatedAt: true,
      translations: { where: { locale }, select: { slug: true } },
    },
  })

  return pages.map((page) => ({
    slug: page.translations[0]?.slug ?? page.slug,
    updatedAt: page.updatedAt,
  }))
}
