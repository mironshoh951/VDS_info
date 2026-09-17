import { db } from '@/server/db/client'
import type { Prisma } from '@/server/db/generated/client'
import {
  pickTranslation,
  translationFilter,
  resolveSlug,
  localePath,
  type LocaleContext,
} from '@/server/modules/shared/localize'
import { mediaUrl, type Paginated } from './queries'
import type { PartnershipType } from '@/server/db/generated/enums'

/**
 * Public read model for partners, brands, services, events and articles.
 *
 * Separate from the product queries purely for file size; the conventions are
 * identical — published-only, locale-resolved, and shaped for the card or
 * template that consumes it.
 */

const published = { status: 'PUBLISHED' as const, deletedAt: null }

export interface PartnerCard {
  id: string
  slug: string
  href: string
  name: string
  shortDescription: string | null
  specialization: string | null
  partnershipType: PartnershipType
  countryCode: string | null
  city: string | null
  verified: boolean
  featured: boolean
  logoUrl: string | null
  brandCount: number
  productCount: number
}

export interface PartnerFilters {
  query?: string
  countryCode?: string
  partnershipType?: PartnershipType
  categorySlug?: string
  verifiedOnly?: boolean
  featuredOnly?: boolean
  sort?: 'alphabetical' | 'featured'
  page?: number
  pageSize?: number
}

export async function listPartners(
  context: LocaleContext,
  filters: PartnerFilters = {},
): Promise<Paginated<PartnerCard>> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(60, Math.max(1, filters.pageSize ?? 24))

  const where: Prisma.PartnerWhereInput = {
    ...published,
    ...(filters.countryCode ? { countryCode: filters.countryCode } : {}),
    ...(filters.partnershipType ? { partnershipType: filters.partnershipType } : {}),
    ...(filters.verifiedOnly ? { verified: true } : {}),
    ...(filters.featuredOnly ? { featured: true } : {}),
    ...(filters.categorySlug
      ? { categories: { some: { category: { slug: filters.categorySlug } } } }
      : {}),
    ...(filters.query
      ? {
          OR: [
            { displayName: { contains: filters.query, mode: 'insensitive' } },
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

  const orderBy: Prisma.PartnerOrderByWithRelationInput[] =
    filters.sort === 'alphabetical'
      ? [{ displayName: 'asc' }]
      : [{ featured: 'desc' }, { sortOrder: 'asc' }, { displayName: 'asc' }]

  const [total, rows] = await Promise.all([
    db.partner.count({ where }),
    db.partner.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        displayName: true,
        partnershipType: true,
        countryCode: true,
        city: true,
        verified: true,
        featured: true,
        logo: { select: { storageKey: true } },
        translations: {
          where: translationFilter(context),
          select: {
            locale: true,
            slug: true,
            name: true,
            shortDescription: true,
            specialization: true,
          },
        },
        _count: {
          select: {
            brands: { where: { status: 'PUBLISHED', deletedAt: null } },
            products: { where: { status: 'PUBLISHED', deletedAt: null } },
          },
        },
      },
    }),
  ])

  const items = rows.flatMap((row): PartnerCard[] => {
    const picked = pickTranslation(row.translations, context)
    if (!picked) return []
    const slug = resolveSlug(row.slug, picked.translation)

    return [
      {
        id: row.id,
        slug,
        href: localePath(context.locale, 'partners', slug),
        name: picked.translation.name,
        shortDescription: picked.translation.shortDescription,
        specialization: picked.translation.specialization,
        partnershipType: row.partnershipType,
        countryCode: row.countryCode,
        city: row.city,
        verified: row.verified,
        featured: row.featured,
        logoUrl: mediaUrl(row.logo?.storageKey),
        brandCount: row._count.brands,
        productCount: row._count.products,
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

export interface PartnerDetail extends PartnerCard {
  description: unknown
  highlights: string[]
  website: string | null
  email: string | null
  phone: string | null
  foundedYear: number | null
  partnershipStart: Date | null
  addressLine: string | null
  brands: Array<{ name: string; href: string; logoUrl: string | null }>
  documents: Array<{ title: string; kind: string; url: string | null }>
  gallery: Array<{ url: string; alt: string | null }>
  updatedAt: Date
}

export async function getPartnerBySlug(
  slug: string,
  context: LocaleContext,
): Promise<PartnerDetail | null> {
  const localized = await db.partnerTranslation.findFirst({
    where: { slug, locale: context.locale },
    select: { partnerId: true },
  })

  const row = await db.partner.findFirst({
    where: { ...published, ...(localized ? { id: localized.partnerId } : { slug }) },
    select: {
      id: true,
      slug: true,
      displayName: true,
      partnershipType: true,
      countryCode: true,
      city: true,
      addressLine: true,
      website: true,
      email: true,
      phone: true,
      foundedYear: true,
      partnershipStart: true,
      verified: true,
      featured: true,
      updatedAt: true,
      logo: { select: { storageKey: true } },
      translations: {
        where: translationFilter(context),
        select: {
          locale: true,
          slug: true,
          name: true,
          shortDescription: true,
          specialization: true,
          description: true,
          highlights: true,
          addressLocalized: true,
        },
      },
      brands: {
        where: { status: 'PUBLISHED', deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: {
          slug: true,
          name: true,
          logo: { select: { storageKey: true } },
          translations: {
            where: translationFilter(context),
            select: { locale: true, slug: true, name: true },
          },
        },
      },
      documents: {
        orderBy: { sortOrder: 'asc' },
        select: { title: true, kind: true, asset: { select: { storageKey: true } } },
      },
      media: {
        where: { role: 'gallery' },
        orderBy: { sortOrder: 'asc' },
        select: { asset: { select: { storageKey: true } } },
      },
      _count: {
        select: {
          brands: { where: { status: 'PUBLISHED', deletedAt: null } },
          products: { where: { status: 'PUBLISHED', deletedAt: null } },
        },
      },
    },
  })

  if (!row) return null
  const picked = pickTranslation(row.translations, context)
  if (!picked) return null

  const resolvedSlug = resolveSlug(row.slug, picked.translation)

  return {
    id: row.id,
    slug: resolvedSlug,
    href: localePath(context.locale, 'partners', resolvedSlug),
    name: picked.translation.name,
    shortDescription: picked.translation.shortDescription,
    specialization: picked.translation.specialization,
    description: picked.translation.description,
    highlights: picked.translation.highlights,
    partnershipType: row.partnershipType,
    countryCode: row.countryCode,
    city: row.city,
    addressLine: picked.translation.addressLocalized ?? row.addressLine,
    website: row.website,
    email: row.email,
    phone: row.phone,
    foundedYear: row.foundedYear,
    partnershipStart: row.partnershipStart,
    verified: row.verified,
    featured: row.featured,
    logoUrl: mediaUrl(row.logo?.storageKey),
    brandCount: row._count.brands,
    productCount: row._count.products,
    updatedAt: row.updatedAt,
    brands: row.brands.flatMap((brand) => {
      const brandPicked = pickTranslation(brand.translations, context)
      const brandSlug = resolveSlug(brand.slug, brandPicked?.translation)
      return [
        {
          name: brandPicked?.translation.name ?? brand.name,
          href: localePath(context.locale, 'brands', brandSlug),
          logoUrl: mediaUrl(brand.logo?.storageKey),
        },
      ]
    }),
    documents: row.documents.map((document) => ({
      title: document.title,
      kind: document.kind,
      url: mediaUrl(document.asset.storageKey),
    })),
    gallery: row.media
      .map((item) => ({ url: mediaUrl(item.asset.storageKey) ?? '', alt: null }))
      .filter((item) => item.url.length > 0),
  }
}

export interface BrandCard {
  id: string
  slug: string
  href: string
  name: string
  tagline: string | null
  shortDescription: string | null
  countryCode: string | null
  logoUrl: string | null
  productCount: number
  partner: { name: string; href: string } | null
}

export async function listBrands(
  context: LocaleContext,
  options: { featuredOnly?: boolean; limit?: number } = {},
): Promise<BrandCard[]> {
  const rows = await db.brand.findMany({
    where: { ...published, ...(options.featuredOnly ? { featured: true } : {}) },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    ...(options.limit ? { take: options.limit } : {}),
    select: {
      id: true,
      slug: true,
      name: true,
      countryCode: true,
      logo: { select: { storageKey: true } },
      translations: {
        where: translationFilter(context),
        select: {
          locale: true,
          slug: true,
          name: true,
          tagline: true,
          shortDescription: true,
        },
      },
      partner: {
        select: {
          slug: true,
          displayName: true,
          translations: {
            where: translationFilter(context),
            select: { locale: true, slug: true, name: true },
          },
        },
      },
      _count: {
        select: { products: { where: { status: 'PUBLISHED', deletedAt: null } } },
      },
    },
  })

  return rows.flatMap((row): BrandCard[] => {
    const picked = pickTranslation(row.translations, context)
    if (!picked) return []
    const slug = resolveSlug(row.slug, picked.translation)
    const partnerPicked = row.partner
      ? pickTranslation(row.partner.translations, context)
      : null

    return [
      {
        id: row.id,
        slug,
        href: localePath(context.locale, 'brands', slug),
        name: picked.translation.name,
        tagline: picked.translation.tagline,
        shortDescription: picked.translation.shortDescription,
        countryCode: row.countryCode,
        logoUrl: mediaUrl(row.logo?.storageKey),
        productCount: row._count.products,
        partner: row.partner
          ? {
              name: partnerPicked?.translation.name ?? row.partner.displayName,
              href: localePath(
                context.locale,
                'partners',
                resolveSlug(row.partner.slug, partnerPicked?.translation),
              ),
            }
          : null,
      },
    ]
  })
}

export interface BrandDetail extends BrandCard {
  description: unknown
  website: string | null
  documents: Array<{ title: string; kind: string; url: string | null }>
  updatedAt: Date
}

export async function getBrandBySlug(
  slug: string,
  context: LocaleContext,
): Promise<BrandDetail | null> {
  const localized = await db.brandTranslation.findFirst({
    where: { slug, locale: context.locale },
    select: { brandId: true },
  })

  const row = await db.brand.findFirst({
    where: { ...published, ...(localized ? { id: localized.brandId } : { slug }) },
    select: {
      id: true,
      slug: true,
      name: true,
      countryCode: true,
      website: true,
      updatedAt: true,
      logo: { select: { storageKey: true } },
      translations: {
        where: translationFilter(context),
        select: {
          locale: true,
          slug: true,
          name: true,
          tagline: true,
          shortDescription: true,
          description: true,
        },
      },
      partner: {
        select: {
          slug: true,
          displayName: true,
          translations: {
            where: translationFilter(context),
            select: { locale: true, slug: true, name: true },
          },
        },
      },
      documents: {
        orderBy: { sortOrder: 'asc' },
        select: { title: true, kind: true, asset: { select: { storageKey: true } } },
      },
      _count: {
        select: { products: { where: { status: 'PUBLISHED', deletedAt: null } } },
      },
    },
  })

  if (!row) return null
  const picked = pickTranslation(row.translations, context)
  if (!picked) return null

  const resolvedSlug = resolveSlug(row.slug, picked.translation)
  const partnerPicked = row.partner
    ? pickTranslation(row.partner.translations, context)
    : null

  return {
    id: row.id,
    slug: resolvedSlug,
    href: localePath(context.locale, 'brands', resolvedSlug),
    name: picked.translation.name,
    tagline: picked.translation.tagline,
    shortDescription: picked.translation.shortDescription,
    description: picked.translation.description,
    countryCode: row.countryCode,
    website: row.website,
    logoUrl: mediaUrl(row.logo?.storageKey),
    productCount: row._count.products,
    updatedAt: row.updatedAt,
    partner: row.partner
      ? {
          name: partnerPicked?.translation.name ?? row.partner.displayName,
          href: localePath(
            context.locale,
            'partners',
            resolveSlug(row.partner.slug, partnerPicked?.translation),
          ),
        }
      : null,
    documents: row.documents.map((document) => ({
      title: document.title,
      kind: document.kind,
      url: mediaUrl(document.asset.storageKey),
    })),
  }
}

export interface ServiceCard {
  id: string
  slug: string
  href: string
  name: string
  shortDescription: string | null
  iconKey: string | null
  featured: boolean
}

export async function listServices(
  context: LocaleContext,
  options: { featuredOnly?: boolean; limit?: number } = {},
): Promise<ServiceCard[]> {
  const rows = await db.service.findMany({
    where: { ...published, ...(options.featuredOnly ? { featured: true } : {}) },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
    ...(options.limit ? { take: options.limit } : {}),
    select: {
      id: true,
      slug: true,
      iconKey: true,
      featured: true,
      translations: {
        where: translationFilter(context),
        select: { locale: true, slug: true, name: true, shortDescription: true },
      },
    },
  })

  return rows.flatMap((row): ServiceCard[] => {
    const picked = pickTranslation(row.translations, context)
    if (!picked) return []
    const slug = resolveSlug(row.slug, picked.translation)
    return [
      {
        id: row.id,
        slug,
        href: localePath(context.locale, 'services', slug),
        name: picked.translation.name,
        shortDescription: picked.translation.shortDescription,
        iconKey: row.iconKey,
        featured: row.featured,
      },
    ]
  })
}

export interface ServiceDetail extends ServiceCard {
  description: unknown
  benefits: string[]
  processSteps: Array<{ title: string; description: string }>
  ctaLabel: string | null
  faqs: Array<{ question: string; answer: unknown }>
  relatedProductSlugs: string[]
  updatedAt: Date
}

export async function getServiceBySlug(
  slug: string,
  context: LocaleContext,
): Promise<ServiceDetail | null> {
  const localized = await db.serviceTranslation.findFirst({
    where: { slug, locale: context.locale },
    select: { serviceId: true },
  })

  const row = await db.service.findFirst({
    where: { ...published, ...(localized ? { id: localized.serviceId } : { slug }) },
    select: {
      id: true,
      slug: true,
      iconKey: true,
      featured: true,
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
          processSteps: true,
          ctaLabel: true,
        },
      },
      faqs: {
        where: { status: 'PUBLISHED', deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: {
          translations: {
            where: translationFilter(context),
            select: { locale: true, question: true, answer: true },
          },
        },
      },
      products: { select: { product: { select: { slug: true, status: true } } } },
    },
  })

  if (!row) return null
  const picked = pickTranslation(row.translations, context)
  if (!picked) return null

  const resolvedSlug = resolveSlug(row.slug, picked.translation)

  return {
    id: row.id,
    slug: resolvedSlug,
    href: localePath(context.locale, 'services', resolvedSlug),
    name: picked.translation.name,
    shortDescription: picked.translation.shortDescription,
    description: picked.translation.description,
    benefits: picked.translation.benefits,
    processSteps: Array.isArray(picked.translation.processSteps)
      ? (picked.translation.processSteps as Array<{ title: string; description: string }>)
      : [],
    ctaLabel: picked.translation.ctaLabel,
    iconKey: row.iconKey,
    featured: row.featured,
    updatedAt: row.updatedAt,
    faqs: row.faqs.flatMap((faq) => {
      const faqPicked = pickTranslation(faq.translations, context)
      return faqPicked
        ? [
            {
              question: faqPicked.translation.question,
              answer: faqPicked.translation.answer,
            },
          ]
        : []
    }),
    relatedProductSlugs: row.products
      .filter((entry) => entry.product.status === 'PUBLISHED')
      .map((entry) => entry.product.slug),
  }
}

export interface EventCard {
  id: string
  slug: string
  href: string
  title: string
  shortDescription: string | null
  startDate: Date
  endDate: Date | null
  city: string | null
  countryCode: string | null
  venue: string | null
  type: string
  participation: string
  boothNumber: string | null
  coverUrl: string | null
  isUpcoming: boolean
}

export async function listEvents(
  context: LocaleContext,
  options: { upcoming?: boolean; limit?: number } = {},
): Promise<EventCard[]> {
  const now = new Date()

  const rows = await db.event.findMany({
    where: {
      ...published,
      ...(options.upcoming === true ? { startDate: { gte: now } } : {}),
      ...(options.upcoming === false ? { startDate: { lt: now } } : {}),
    },
    orderBy: { startDate: options.upcoming === false ? 'desc' : 'asc' },
    ...(options.limit ? { take: options.limit } : {}),
    select: {
      id: true,
      slug: true,
      startDate: true,
      endDate: true,
      city: true,
      countryCode: true,
      venue: true,
      type: true,
      participation: true,
      boothNumber: true,
      cover: { select: { storageKey: true } },
      translations: {
        where: translationFilter(context),
        select: {
          locale: true,
          slug: true,
          title: true,
          shortDescription: true,
          venueLocalized: true,
        },
      },
    },
  })

  return rows.flatMap((row): EventCard[] => {
    const picked = pickTranslation(row.translations, context)
    if (!picked) return []
    const slug = resolveSlug(row.slug, picked.translation)

    return [
      {
        id: row.id,
        slug,
        href: localePath(context.locale, 'events', slug),
        title: picked.translation.title,
        shortDescription: picked.translation.shortDescription,
        startDate: row.startDate,
        endDate: row.endDate,
        city: row.city,
        countryCode: row.countryCode,
        venue: picked.translation.venueLocalized ?? row.venue,
        type: row.type,
        participation: row.participation,
        boothNumber: row.boothNumber,
        coverUrl: mediaUrl(row.cover?.storageKey),
        isUpcoming: row.startDate >= now,
      },
    ]
  })
}

export interface EventDetail extends EventCard {
  description: unknown
  summary: unknown
  organizer: string | null
  website: string | null
  partners: Array<{ name: string; href: string; logoUrl: string | null }>
  gallery: Array<{ url: string; alt: string | null }>
  updatedAt: Date
}

export async function getEventBySlug(
  slug: string,
  context: LocaleContext,
): Promise<EventDetail | null> {
  const localized = await db.eventTranslation.findFirst({
    where: { slug, locale: context.locale },
    select: { eventId: true },
  })

  const row = await db.event.findFirst({
    where: { ...published, ...(localized ? { id: localized.eventId } : { slug }) },
    select: {
      id: true,
      slug: true,
      startDate: true,
      endDate: true,
      city: true,
      countryCode: true,
      venue: true,
      type: true,
      participation: true,
      boothNumber: true,
      organizer: true,
      website: true,
      updatedAt: true,
      cover: { select: { storageKey: true } },
      translations: {
        where: translationFilter(context),
        select: {
          locale: true,
          slug: true,
          title: true,
          shortDescription: true,
          description: true,
          summary: true,
          venueLocalized: true,
        },
      },
      partners: {
        select: {
          partner: {
            select: {
              slug: true,
              displayName: true,
              status: true,
              logo: { select: { storageKey: true } },
              translations: {
                where: translationFilter(context),
                select: { locale: true, slug: true, name: true },
              },
            },
          },
        },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
        select: { asset: { select: { storageKey: true } } },
      },
    },
  })

  if (!row) return null
  const picked = pickTranslation(row.translations, context)
  if (!picked) return null

  const resolvedSlug = resolveSlug(row.slug, picked.translation)

  return {
    id: row.id,
    slug: resolvedSlug,
    href: localePath(context.locale, 'events', resolvedSlug),
    title: picked.translation.title,
    shortDescription: picked.translation.shortDescription,
    description: picked.translation.description,
    summary: picked.translation.summary,
    startDate: row.startDate,
    endDate: row.endDate,
    city: row.city,
    countryCode: row.countryCode,
    venue: picked.translation.venueLocalized ?? row.venue,
    type: row.type,
    participation: row.participation,
    boothNumber: row.boothNumber,
    organizer: row.organizer,
    website: row.website,
    coverUrl: mediaUrl(row.cover?.storageKey),
    isUpcoming: row.startDate >= new Date(),
    updatedAt: row.updatedAt,
    partners: row.partners.flatMap((entry) => {
      if (entry.partner.status !== 'PUBLISHED') return []
      const partnerPicked = pickTranslation(entry.partner.translations, context)
      const partnerSlug = resolveSlug(entry.partner.slug, partnerPicked?.translation)
      return [
        {
          name: partnerPicked?.translation.name ?? entry.partner.displayName,
          href: localePath(context.locale, 'partners', partnerSlug),
          logoUrl: mediaUrl(entry.partner.logo?.storageKey),
        },
      ]
    }),
    gallery: row.media
      .map((item) => ({ url: mediaUrl(item.asset.storageKey) ?? '', alt: null }))
      .filter((item) => item.url.length > 0),
  }
}

export interface ArticleCard {
  id: string
  slug: string
  href: string
  title: string
  excerpt: string | null
  publishedAt: Date | null
  readingMinutes: number | null
  categoryName: string | null
  coverUrl: string | null
  featured: boolean
}

export async function listArticles(
  context: LocaleContext,
  options: {
    limit?: number
    page?: number
    pageSize?: number
    categorySlug?: string
  } = {},
): Promise<Paginated<ArticleCard>> {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = options.limit ?? Math.min(48, Math.max(1, options.pageSize ?? 12))

  const where: Prisma.ArticleWhereInput = {
    ...published,
    ...(options.categorySlug ? { category: { slug: options.categorySlug } } : {}),
  }

  const [total, rows] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
      skip: options.limit ? 0 : (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        publishedAt: true,
        featured: true,
        cover: { select: { storageKey: true } },
        category: { select: { names: true } },
        translations: {
          where: translationFilter(context),
          select: {
            locale: true,
            slug: true,
            title: true,
            excerpt: true,
            readingMinutes: true,
          },
        },
      },
    }),
  ])

  const items = rows.flatMap((row): ArticleCard[] => {
    const picked = pickTranslation(row.translations, context)
    if (!picked) return []
    const slug = resolveSlug(row.slug, picked.translation)
    const names = row.category?.names as Record<string, string> | null

    return [
      {
        id: row.id,
        slug,
        href: localePath(context.locale, 'news', slug),
        title: picked.translation.title,
        excerpt: picked.translation.excerpt,
        publishedAt: row.publishedAt,
        readingMinutes: picked.translation.readingMinutes,
        categoryName: names?.[context.locale] ?? names?.[context.defaultLocale] ?? null,
        coverUrl: mediaUrl(row.cover?.storageKey),
        featured: row.featured,
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

export interface ArticleDetail extends ArticleCard {
  content: unknown
  authorName: string | null
  updatedAt: Date
  relatedProducts: Array<{ name: string; href: string }>
  relatedPartners: Array<{ name: string; href: string }>
}

export async function getArticleBySlug(
  slug: string,
  context: LocaleContext,
): Promise<ArticleDetail | null> {
  const localized = await db.articleTranslation.findFirst({
    where: { slug, locale: context.locale },
    select: { articleId: true },
  })

  const row = await db.article.findFirst({
    where: { ...published, ...(localized ? { id: localized.articleId } : { slug }) },
    select: {
      id: true,
      slug: true,
      publishedAt: true,
      updatedAt: true,
      featured: true,
      authorName: true,
      cover: { select: { storageKey: true } },
      category: { select: { names: true } },
      translations: {
        where: translationFilter(context),
        select: {
          locale: true,
          slug: true,
          title: true,
          excerpt: true,
          content: true,
          readingMinutes: true,
        },
      },
      products: {
        select: {
          product: {
            select: {
              slug: true,
              status: true,
              translations: {
                where: translationFilter(context),
                select: { locale: true, slug: true, name: true },
              },
            },
          },
        },
      },
      partners: {
        select: {
          partner: {
            select: {
              slug: true,
              displayName: true,
              status: true,
              translations: {
                where: translationFilter(context),
                select: { locale: true, slug: true, name: true },
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

  const resolvedSlug = resolveSlug(row.slug, picked.translation)
  const names = row.category?.names as Record<string, string> | null

  return {
    id: row.id,
    slug: resolvedSlug,
    href: localePath(context.locale, 'news', resolvedSlug),
    title: picked.translation.title,
    excerpt: picked.translation.excerpt,
    content: picked.translation.content,
    readingMinutes: picked.translation.readingMinutes,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    featured: row.featured,
    authorName: row.authorName,
    categoryName: names?.[context.locale] ?? names?.[context.defaultLocale] ?? null,
    coverUrl: mediaUrl(row.cover?.storageKey),
    relatedProducts: row.products.flatMap((entry) => {
      if (entry.product.status !== 'PUBLISHED') return []
      const productPicked = pickTranslation(entry.product.translations, context)
      if (!productPicked) return []
      const productSlug = resolveSlug(entry.product.slug, productPicked.translation)
      return [
        {
          name: productPicked.translation.name,
          href: localePath(context.locale, 'products', productSlug),
        },
      ]
    }),
    relatedPartners: row.partners.flatMap((entry) => {
      if (entry.partner.status !== 'PUBLISHED') return []
      const partnerPicked = pickTranslation(entry.partner.translations, context)
      const partnerSlug = resolveSlug(entry.partner.slug, partnerPicked?.translation)
      return [
        {
          name: partnerPicked?.translation.name ?? entry.partner.displayName,
          href: localePath(context.locale, 'partners', partnerSlug),
        },
      ]
    }),
  }
}
