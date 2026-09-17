import { db } from '@/server/db/client'
import type { Prisma } from '@/server/db/generated/client'
import {
  pickTranslation,
  translationFilter,
  resolveSlug,
  localePath,
  type LocaleContext,
} from '@/server/modules/shared/localize'
import type { Locale } from '@/i18n/config'

/**
 * Public read model for the catalogue.
 *
 * Everything the public site renders passes through this file. Three
 * consequences that matter:
 *
 *  - Draft, archived and soft-deleted records are filtered out in one place,
 *    so a template cannot accidentally leak unpublished content.
 *  - Locale fallback is applied here, so templates receive plain strings.
 *  - Every list query selects exactly the columns its card needs, which is how
 *    a CMS with this many relations avoids N+1 queries (§55).
 */

export interface ProductCard {
  id: string
  slug: string
  href: string
  name: string
  shortDescription: string | null
  sku: string | null
  brand: { name: string; slug: string; href: string } | null
  categoryName: string | null
  countryOfOrigin: string | null
  featured: boolean
  isNew: boolean
  imageUrl: string | null
}

export interface ProductFilters {
  query?: string
  categorySlug?: string
  brandSlug?: string
  partnerSlug?: string
  countryCode?: string
  featuredOnly?: boolean
  attribute?: { key: string; value: string }
  sort?: 'newest' | 'name' | 'featured'
  page?: number
  pageSize?: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const DEFAULT_PAGE_SIZE = 24

function publishedFilter() {
  return { status: 'PUBLISHED' as const, deletedAt: null }
}

export async function listProducts(
  context: LocaleContext,
  filters: ProductFilters = {},
): Promise<Paginated<ProductCard>> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(96, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE))

  const where: Prisma.ProductWhereInput = {
    ...publishedFilter(),
    visibility: 'PUBLIC',
    ...(filters.brandSlug ? { brand: { slug: filters.brandSlug } } : {}),
    ...(filters.partnerSlug ? { partner: { slug: filters.partnerSlug } } : {}),
    ...(filters.countryCode ? { countryOfOrigin: filters.countryCode } : {}),
    ...(filters.featuredOnly ? { featured: true } : {}),
    ...(filters.categorySlug
      ? {
          categories: {
            some: {
              category: {
                OR: [
                  { slug: filters.categorySlug },
                  // Subtree match: a parent category shows its children's items.
                  { path: { startsWith: `${filters.categorySlug}/` } },
                  { path: { contains: `/${filters.categorySlug}/` } },
                  { path: { endsWith: `/${filters.categorySlug}` } },
                ],
              },
            },
          },
        }
      : {}),
    ...(filters.attribute
      ? {
          attributeValues: {
            some: {
              attribute: { key: filters.attribute.key },
              valueString: filters.attribute.value,
            },
          },
        }
      : {}),
    ...(filters.query
      ? {
          OR: [
            { sku: { contains: filters.query, mode: 'insensitive' } },
            { productCode: { contains: filters.query, mode: 'insensitive' } },
            {
              translations: {
                some: {
                  name: { contains: filters.query, mode: 'insensitive' },
                  ...translationFilter(context),
                },
              },
            },
          ],
        }
      : {}),
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    filters.sort === 'newest'
      ? [{ publishedAt: 'desc' }]
      : filters.sort === 'name'
        ? [{ slug: 'asc' }]
        : [{ featured: 'desc' }, { sortOrder: 'asc' }, { publishedAt: 'desc' }]

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        sku: true,
        countryOfOrigin: true,
        featured: true,
        isNew: true,
        translations: {
          where: translationFilter(context),
          select: { locale: true, slug: true, name: true, shortDescription: true },
        },
        brand: {
          select: {
            slug: true,
            name: true,
            translations: {
              where: translationFilter(context),
              select: { locale: true, slug: true, name: true },
            },
          },
        },
        categories: {
          where: { isPrimary: true },
          take: 1,
          select: {
            category: {
              select: {
                slug: true,
                translations: {
                  where: translationFilter(context),
                  select: { locale: true, name: true },
                },
              },
            },
          },
        },
        media: {
          where: { role: 'primary' },
          take: 1,
          select: { asset: { select: { storageKey: true } } },
        },
      },
    }),
  ])

  const items = rows.flatMap((row): ProductCard[] => {
    const picked = pickTranslation(row.translations, context)
    if (!picked) return []

    const brandPicked = row.brand
      ? pickTranslation(row.brand.translations, context)
      : null
    const categoryPicked = row.categories[0]
      ? pickTranslation(row.categories[0].category.translations, context)
      : null

    const slug = resolveSlug(row.slug, picked.translation)

    return [
      {
        id: row.id,
        slug,
        href: localePath(context.locale, 'products', slug),
        name: picked.translation.name,
        shortDescription: picked.translation.shortDescription,
        sku: row.sku,
        brand: row.brand
          ? {
              name: brandPicked?.translation.name ?? row.brand.name,
              slug: resolveSlug(row.brand.slug, brandPicked?.translation),
              href: localePath(
                context.locale,
                'brands',
                resolveSlug(row.brand.slug, brandPicked?.translation),
              ),
            }
          : null,
        categoryName: categoryPicked?.translation.name ?? null,
        countryOfOrigin: row.countryOfOrigin,
        featured: row.featured,
        isNew: row.isNew,
        imageUrl: mediaUrl(row.media[0]?.asset.storageKey),
      },
    ]
  })

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export interface ProductDetail extends ProductCard {
  description: unknown
  benefits: string[]
  applications: string[]
  indications: string[]
  packaging: string | null
  unit: string | null
  productCode: string | null
  partner: { name: string; slug: string; href: string; countryCode: string | null } | null
  specifications: Array<{
    group: string
    label: string
    value: string
    unit: string | null
  }>
  gallery: Array<{ url: string; alt: string | null }>
  documents: Array<{ title: string; kind: string; url: string | null }>
  relatedProducts: ProductCard[]
  relatedServices: Array<{ name: string; href: string; short: string | null }>
  relatedArticles: Array<{ title: string; href: string }>
  updatedAt: Date
}

export async function getProductBySlug(
  slugOrLocalized: string,
  context: LocaleContext,
): Promise<ProductDetail | null> {
  // A localized slug takes precedence; the base slug keeps older links alive.
  const localized = await db.productTranslation.findFirst({
    where: { slug: slugOrLocalized, locale: context.locale },
    select: { productId: true },
  })

  const row = await db.product.findFirst({
    where: {
      ...publishedFilter(),
      visibility: 'PUBLIC',
      ...(localized ? { id: localized.productId } : { slug: slugOrLocalized }),
    },
    select: {
      id: true,
      slug: true,
      sku: true,
      productCode: true,
      unit: true,
      packaging: true,
      countryOfOrigin: true,
      featured: true,
      isNew: true,
      updatedAt: true,
      translations: {
        where: translationFilter(context),
        select: {
          locale: true,
          slug: true,
          name: true,
          shortDescription: true,
          description: true,
          benefits: true,
          applications: true,
          indications: true,
        },
      },
      brand: {
        select: {
          slug: true,
          name: true,
          translations: {
            where: translationFilter(context),
            select: { locale: true, slug: true, name: true },
          },
        },
      },
      partner: {
        select: {
          slug: true,
          displayName: true,
          countryCode: true,
          translations: {
            where: translationFilter(context),
            select: { locale: true, slug: true, name: true },
          },
        },
      },
      categories: {
        where: { isPrimary: true },
        take: 1,
        select: {
          category: {
            select: {
              slug: true,
              translations: {
                where: translationFilter(context),
                select: { locale: true, name: true },
              },
            },
          },
        },
      },
      specifications: {
        orderBy: [{ groupKey: 'asc' }, { sortOrder: 'asc' }],
        select: { groupKey: true, label: true, value: true, unit: true, localized: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
        select: {
          role: true,
          asset: {
            select: {
              storageKey: true,
              translations: {
                where: { locale: { in: [context.locale, context.defaultLocale] } },
                select: { locale: true, alt: true },
              },
            },
          },
        },
      },
      documents: {
        orderBy: { sortOrder: 'asc' },
        select: { title: true, kind: true, asset: { select: { storageKey: true } } },
      },
      relatedFrom: {
        orderBy: { sortOrder: 'asc' },
        select: { target: { select: { slug: true } } },
      },
      services: {
        select: {
          service: {
            select: {
              slug: true,
              status: true,
              deletedAt: true,
              translations: {
                where: translationFilter(context),
                select: { locale: true, slug: true, name: true, shortDescription: true },
              },
            },
          },
        },
      },
      articles: {
        select: {
          article: {
            select: {
              slug: true,
              status: true,
              deletedAt: true,
              translations: {
                where: translationFilter(context),
                select: { locale: true, slug: true, title: true },
              },
            },
          },
        },
      },
    },
  })

  if (!row) return null

  const picked = pickTranslation(row.translations, context)
  if (!picked) return null

  const brandPicked = row.brand ? pickTranslation(row.brand.translations, context) : null
  const partnerPicked = row.partner
    ? pickTranslation(row.partner.translations, context)
    : null
  const categoryPicked = row.categories[0]
    ? pickTranslation(row.categories[0].category.translations, context)
    : null

  const slug = resolveSlug(row.slug, picked.translation)

  const relatedSlugs = row.relatedFrom.map((relation) => relation.target.slug)
  const relatedProducts =
    relatedSlugs.length > 0
      ? (await listProducts(context, { pageSize: 8 })).items.filter((item) =>
          relatedSlugs.includes(item.slug),
        )
      : []

  return {
    id: row.id,
    slug,
    href: localePath(context.locale, 'products', slug),
    name: picked.translation.name,
    shortDescription: picked.translation.shortDescription,
    description: picked.translation.description,
    benefits: picked.translation.benefits,
    applications: picked.translation.applications,
    indications: picked.translation.indications,
    sku: row.sku,
    productCode: row.productCode,
    unit: row.unit,
    packaging: row.packaging,
    countryOfOrigin: row.countryOfOrigin,
    featured: row.featured,
    isNew: row.isNew,
    updatedAt: row.updatedAt,
    categoryName: categoryPicked?.translation.name ?? null,
    imageUrl: mediaUrl(row.media.find((m) => m.role === 'primary')?.asset.storageKey),
    brand: row.brand
      ? {
          name: brandPicked?.translation.name ?? row.brand.name,
          slug: resolveSlug(row.brand.slug, brandPicked?.translation),
          href: localePath(
            context.locale,
            'brands',
            resolveSlug(row.brand.slug, brandPicked?.translation),
          ),
        }
      : null,
    partner: row.partner
      ? {
          name: partnerPicked?.translation.name ?? row.partner.displayName,
          slug: resolveSlug(row.partner.slug, partnerPicked?.translation),
          href: localePath(
            context.locale,
            'partners',
            resolveSlug(row.partner.slug, partnerPicked?.translation),
          ),
          countryCode: row.partner.countryCode,
        }
      : null,
    specifications: row.specifications.map((spec) => {
      const overrides = (
        spec.localized as Record<string, { label?: string; value?: string }> | null
      )?.[context.locale]
      return {
        group: spec.groupKey,
        label: overrides?.label ?? spec.label,
        value: overrides?.value ?? spec.value,
        unit: spec.unit,
      }
    }),
    gallery: row.media
      .filter((item) => item.role === 'gallery' || item.role === 'primary')
      .map((item) => ({
        url: mediaUrl(item.asset.storageKey) ?? '',
        alt:
          item.asset.translations.find((t) => t.locale === context.locale)?.alt ??
          item.asset.translations[0]?.alt ??
          null,
      }))
      .filter((item) => item.url.length > 0),
    documents: row.documents.map((document) => ({
      title: document.title,
      kind: document.kind,
      url: mediaUrl(document.asset.storageKey),
    })),
    relatedProducts,
    relatedServices: row.services.flatMap((entry) => {
      const service = entry.service
      if (service.status !== 'PUBLISHED' || service.deletedAt) return []
      const servicePicked = pickTranslation(service.translations, context)
      if (!servicePicked) return []
      const serviceSlug = resolveSlug(service.slug, servicePicked.translation)
      return [
        {
          name: servicePicked.translation.name,
          short: servicePicked.translation.shortDescription,
          href: localePath(context.locale, 'services', serviceSlug),
        },
      ]
    }),
    relatedArticles: row.articles.flatMap((entry) => {
      const article = entry.article
      if (article.status !== 'PUBLISHED' || article.deletedAt) return []
      const articlePicked = pickTranslation(article.translations, context)
      if (!articlePicked) return []
      const articleSlug = resolveSlug(article.slug, articlePicked.translation)
      return [
        {
          title: articlePicked.translation.title,
          href: localePath(context.locale, 'news', articleSlug),
        },
      ]
    }),
  }
}

export interface CategoryNode {
  id: string
  slug: string
  path: string
  name: string
  href: string
  iconKey: string | null
  productCount: number
  children: CategoryNode[]
}

export async function listCategoryTree(
  context: LocaleContext,
  options: { featuredOnly?: boolean } = {},
): Promise<CategoryNode[]> {
  const rows = await db.productCategory.findMany({
    where: {
      enabled: true,
      deletedAt: null,
      ...(options.featuredOnly ? { featured: true, depth: 0 } : {}),
    },
    orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      slug: true,
      path: true,
      parentId: true,
      iconKey: true,
      translations: {
        where: translationFilter(context),
        select: { locale: true, slug: true, name: true },
      },
      _count: {
        select: {
          products: { where: { product: { status: 'PUBLISHED', deletedAt: null } } },
        },
      },
    },
  })

  const nodes = new Map<string, CategoryNode>()
  const parentOf = new Map<string, string | null>()

  for (const row of rows) {
    const picked = pickTranslation(row.translations, context)
    if (!picked) continue

    const slug = resolveSlug(row.slug, picked.translation)
    nodes.set(row.id, {
      id: row.id,
      slug: row.slug,
      path: row.path,
      name: picked.translation.name,
      href: localePath(context.locale, 'products', 'category', row.path),
      iconKey: row.iconKey,
      productCount: row._count.products,
      children: [],
    })
    parentOf.set(row.id, row.parentId)
    void slug
  }

  const roots: CategoryNode[] = []
  for (const [id, node] of nodes) {
    const parentId = parentOf.get(id)
    const parent = parentId ? nodes.get(parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return roots
}

/**
 * Public URL for a stored asset. Returns null when there is no asset, so
 * templates render their own placeholder rather than a broken image.
 */
export function mediaUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null

  // With the local driver the files live outside `public/` and are served by
  // the /media/* route handler. Building an S3 URL here would point the site
  // at an object store that is not running in development, which is how an
  // upload ends up as a broken image even though the file is on disk.
  if ((process.env.MEDIA_DRIVER ?? 'local') !== 's3') {
    return `/media/${storageKey}`
  }

  const base = process.env.S3_PUBLIC_BASE_URL
  if (!base) return `/media/${storageKey}`
  return `${base.replace(/\/$/, '')}/${storageKey}`
}

export function localeContextFrom(
  locale: Locale,
  defaultLocale: Locale,
  publishAiDrafts: boolean,
): LocaleContext {
  return { locale, defaultLocale, publishAiDrafts }
}
