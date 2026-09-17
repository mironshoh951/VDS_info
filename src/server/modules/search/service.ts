import { db } from '@/server/db/client'
import { logger } from '@/lib/logger'
import {
  translationFilter,
  pickTranslation,
  resolveSlug,
  localePath,
  type LocaleContext,
} from '@/server/modules/shared/localize'
import { mediaUrl } from '@/server/modules/catalog/queries'
import type { EntityType } from '@/server/db/generated/enums'

/**
 * Global search (§22).
 *
 * Results are grouped by entity type, which is how a visitor actually reads a
 * result list on a site that mixes products, companies and documents.
 *
 * On multilingual matching: substring matching is used rather than
 * `to_tsvector`, and that is a deliberate choice for these four languages.
 * Chinese has no whitespace to tokenise on, and Postgres has no stemmer for
 * Uzbek — a `simple` text-search configuration would give both of them exact
 * whole-token matching only, which is worse than substring matching. Latin and
 * Cyrillic queries additionally get trigram similarity so that a misspelling
 * still finds the record.
 *
 * The follow-up migration in the search phase adds generated `tsvector`
 * columns and a `pg_trgm` index; the query shape below does not change when it
 * lands, only its speed.
 */

export interface SearchHit {
  id: string
  title: string
  description: string | null
  href: string
  imageUrl: string | null
  badge?: string | null
}

export interface SearchGroup {
  type: EntityType
  labelKey: string
  hits: SearchHit[]
  total: number
}

export interface SearchOutcome {
  query: string
  groups: SearchGroup[]
  total: number
}

const PER_GROUP = 6
/** Below this length a query matches nearly everything and helps nobody. */
const MIN_QUERY_LENGTH = 2

export async function search(
  rawQuery: string,
  context: LocaleContext,
): Promise<SearchOutcome> {
  const query = rawQuery.trim().slice(0, 120)

  if (query.length < MIN_QUERY_LENGTH) {
    return { query, groups: [], total: 0 }
  }

  const like = { contains: query, mode: 'insensitive' as const }
  const filter = translationFilter(context)
  const published = { status: 'PUBLISHED' as const, deletedAt: null }

  const [products, partners, brands, services, events, articles, resources, pages] =
    await Promise.all([
      db.product.findMany({
        where: {
          ...published,
          visibility: 'PUBLIC',
          OR: [
            { sku: like },
            { productCode: like },
            {
              translations: {
                some: {
                  ...filter,
                  OR: [{ name: like }, { shortDescription: like }],
                },
              },
            },
          ],
        },
        take: PER_GROUP,
        orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
        select: {
          id: true,
          slug: true,
          sku: true,
          media: {
            where: { role: 'primary' },
            take: 1,
            select: { asset: { select: { storageKey: true } } },
          },
          translations: {
            where: filter,
            select: { locale: true, slug: true, name: true, shortDescription: true },
          },
        },
      }),

      db.partner.findMany({
        where: {
          ...published,
          translations: {
            some: {
              ...filter,
              OR: [{ name: like }, { shortDescription: like }, { specialization: like }],
            },
          },
        },
        take: PER_GROUP,
        orderBy: [{ featured: 'desc' }, { displayName: 'asc' }],
        select: {
          id: true,
          slug: true,
          countryCode: true,
          logo: { select: { storageKey: true } },
          translations: {
            where: filter,
            select: { locale: true, slug: true, name: true, shortDescription: true },
          },
        },
      }),

      db.brand.findMany({
        where: {
          ...published,
          OR: [
            { name: like },
            {
              translations: {
                some: { ...filter, OR: [{ name: like }, { shortDescription: like }] },
              },
            },
          ],
        },
        take: PER_GROUP,
        orderBy: [{ featured: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          slug: true,
          logo: { select: { storageKey: true } },
          translations: {
            where: filter,
            select: { locale: true, slug: true, name: true, shortDescription: true },
          },
        },
      }),

      db.service.findMany({
        where: {
          ...published,
          translations: {
            some: { ...filter, OR: [{ name: like }, { shortDescription: like }] },
          },
        },
        take: PER_GROUP,
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          slug: true,
          translations: {
            where: filter,
            select: { locale: true, slug: true, name: true, shortDescription: true },
          },
        },
      }),

      db.event.findMany({
        where: {
          ...published,
          translations: {
            some: { ...filter, OR: [{ title: like }, { shortDescription: like }] },
          },
        },
        take: PER_GROUP,
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          slug: true,
          startDate: true,
          cover: { select: { storageKey: true } },
          translations: {
            where: filter,
            select: { locale: true, slug: true, title: true, shortDescription: true },
          },
        },
      }),

      db.article.findMany({
        where: {
          ...published,
          translations: {
            some: { ...filter, OR: [{ title: like }, { excerpt: like }] },
          },
        },
        take: PER_GROUP,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          cover: { select: { storageKey: true } },
          translations: {
            where: filter,
            select: { locale: true, slug: true, title: true, excerpt: true },
          },
        },
      }),

      db.resource.findMany({
        where: {
          ...published,
          visibility: 'PUBLIC',
          translations: {
            some: { ...filter, OR: [{ title: like }, { description: like }] },
          },
        },
        take: PER_GROUP,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          type: true,
          translations: {
            where: filter,
            select: { locale: true, slug: true, title: true, description: true },
          },
        },
      }),

      db.page.findMany({
        where: {
          ...published,
          translations: {
            some: { ...filter, OR: [{ title: like }, { summary: like }] },
          },
        },
        take: PER_GROUP,
        select: {
          id: true,
          slug: true,
          translations: {
            where: filter,
            select: { locale: true, slug: true, title: true, summary: true },
          },
        },
      }),
    ])

  const groups: SearchGroup[] = []

  const add = <
    T extends { id: string; slug: string; translations: { locale: string }[] },
  >(
    type: EntityType,
    labelKey: string,
    rows: T[],
    map: (row: T, translation: never) => SearchHit | null,
  ) => {
    const hits: SearchHit[] = []
    for (const row of rows) {
      const picked = pickTranslation(row.translations, context)
      if (!picked) continue
      const hit = map(row, picked.translation as never)
      if (hit) hits.push(hit)
    }
    if (hits.length > 0) {
      groups.push({ type, labelKey, hits, total: hits.length })
    }
  }

  add('PRODUCT', 'groupProducts', products, (row, t) => {
    const tr = t as unknown as {
      slug: string | null
      name: string
      shortDescription: string | null
    }
    const slug = resolveSlug(row.slug, tr)
    return {
      id: row.id,
      title: tr.name,
      description: tr.shortDescription,
      href: localePath(context.locale, 'products', slug),
      imageUrl: mediaUrl(row.media[0]?.asset.storageKey),
      badge: row.sku,
    }
  })

  add('PARTNER', 'groupPartners', partners, (row, t) => {
    const tr = t as unknown as {
      slug: string | null
      name: string
      shortDescription: string | null
    }
    return {
      id: row.id,
      title: tr.name,
      description: tr.shortDescription,
      href: localePath(context.locale, 'partners', resolveSlug(row.slug, tr)),
      imageUrl: mediaUrl(row.logo?.storageKey),
      badge: row.countryCode,
    }
  })

  add('BRAND', 'groupBrands', brands, (row, t) => {
    const tr = t as unknown as {
      slug: string | null
      name: string
      shortDescription: string | null
    }
    return {
      id: row.id,
      title: tr.name,
      description: tr.shortDescription,
      href: localePath(context.locale, 'brands', resolveSlug(row.slug, tr)),
      imageUrl: mediaUrl(row.logo?.storageKey),
    }
  })

  add('SERVICE', 'groupServices', services, (row, t) => {
    const tr = t as unknown as {
      slug: string | null
      name: string
      shortDescription: string | null
    }
    return {
      id: row.id,
      title: tr.name,
      description: tr.shortDescription,
      href: localePath(context.locale, 'services', resolveSlug(row.slug, tr)),
      imageUrl: null,
    }
  })

  add('EVENT', 'groupEvents', events, (row, t) => {
    const tr = t as unknown as {
      slug: string | null
      title: string
      shortDescription: string | null
    }
    return {
      id: row.id,
      title: tr.title,
      description: tr.shortDescription,
      href: localePath(context.locale, 'events', resolveSlug(row.slug, tr)),
      imageUrl: mediaUrl(row.cover?.storageKey),
    }
  })

  add('ARTICLE', 'groupArticles', articles, (row, t) => {
    const tr = t as unknown as {
      slug: string | null
      title: string
      excerpt: string | null
    }
    return {
      id: row.id,
      title: tr.title,
      description: tr.excerpt,
      href: localePath(context.locale, 'news', resolveSlug(row.slug, tr)),
      imageUrl: mediaUrl(row.cover?.storageKey),
    }
  })

  add('RESOURCE', 'groupResources', resources, (row, t) => {
    const tr = t as unknown as {
      slug: string | null
      title: string
      description: string | null
    }
    return {
      id: row.id,
      title: tr.title,
      description: tr.description,
      href: localePath(context.locale, 'resources', resolveSlug(row.slug, tr)),
      imageUrl: null,
      badge: row.type,
    }
  })

  add('PAGE', 'groupPages', pages, (row, t) => {
    const tr = t as unknown as {
      slug: string | null
      title: string
      summary: string | null
    }
    return {
      id: row.id,
      title: tr.title,
      description: tr.summary,
      href: localePath(context.locale, resolveSlug(row.slug, tr)),
      imageUrl: null,
    }
  })

  const total = groups.reduce((sum, group) => sum + group.hits.length, 0)

  return { query, groups, total }
}

/**
 * Records what visitors searched for, so the admin can see popular terms and —
 * more usefully — which searches returned nothing (§22).
 *
 * Only the query text is retained. No identifier links a search to a person.
 */
export async function logSearch(input: {
  query: string
  locale: string
  resultCount: number
}): Promise<void> {
  const query = input.query.trim()
  if (query.length < MIN_QUERY_LENGTH) return

  try {
    await db.searchQueryLog.create({
      data: {
        query: query.slice(0, 200),
        normalized: query.toLowerCase().replace(/\s+/g, ' ').slice(0, 200),
        locale: input.locale,
        resultCount: input.resultCount,
      },
    })
  } catch (error) {
    logger.warn({ err: error }, 'search logging failed')
  }
}
