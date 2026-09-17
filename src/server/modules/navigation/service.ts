import { db } from '@/server/db/client'
import { cached, invalidatePrefix } from '@/server/cache/redis'
import { logger } from '@/lib/logger'
import type { Locale } from '@/i18n/config'
import type { MenuLocation, MenuItemTarget } from '@/server/db/generated/enums'

/**
 * Navigation is data (§3).
 *
 * Nothing in the codebase knows what the header contains. This service reads
 * the menu tree, resolves each item's destination to a real URL for the
 * requested locale (preferring a localized slug when one exists), and drops
 * items whose target has been unpublished or deleted — so a menu can never
 * link into a 404 because someone archived a product.
 */

const CACHE_PREFIX = 'menu:'
const CACHE_TTL_SECONDS = 300

export interface NavigationItem {
  id: string
  label: string
  description: string | null
  ariaLabel: string | null
  href: string | null
  external: boolean
  openInNewTab: boolean
  rel: string | null
  icon: string | null
  highlight: boolean
  children: NavigationItem[]
}

interface RawItem {
  id: string
  parentId: string | null
  sortOrder: number
  target: MenuItemTarget
  pageId: string | null
  productId: string | null
  productCategoryId: string | null
  partnerId: string | null
  brandId: string | null
  serviceId: string | null
  eventId: string | null
  articleId: string | null
  routeKey: string | null
  externalUrl: string | null
  openInNewTab: boolean
  rel: string | null
  icon: string | null
  highlight: boolean
  visibleLocales: string[]
  translations: {
    label: string
    description: string | null
    ariaLabel: string | null
    locale: string
  }[]
}

/** Static route keys the CMS can point a menu item at. */
const ROUTE_PATHS: Record<string, string> = {
  home: '',
  about: 'about',
  'partners.index': 'partners',
  'brands.index': 'brands',
  'products.index': 'products',
  'services.index': 'services',
  'achievements.index': 'achievements',
  'events.index': 'events',
  'news.index': 'news',
  'resources.index': 'resources',
  'certificates.index': 'certificates',
  contact: 'contact',
  search: 'search',
  faq: 'faq',
  careers: 'careers',
  distributors: 'distributors',
  media: 'media',
  testimonials: 'testimonials',
  privacy: 'legal/privacy',
  terms: 'legal/terms',
  cookies: 'legal/cookies',
  disclaimer: 'legal/disclaimer',
}

/**
 * The same keys, for the menu editor's dropdown. Exported from here rather
 * than repeated in the admin module so a route added above cannot go missing
 * from the picker — or worse, be offered in the picker and resolve to nothing.
 */
export const ROUTE_KEYS = Object.keys(ROUTE_PATHS)

export async function getNavigation(
  location: MenuLocation,
  locale: Locale,
  defaultLocale: Locale,
): Promise<NavigationItem[]> {
  try {
    return await cached(`${CACHE_PREFIX}${location}:${locale}`, CACHE_TTL_SECONDS, () =>
      loadNavigation(location, locale, defaultLocale),
    )
  } catch (error) {
    // A navigation failure should degrade to an empty menu, not a broken page.
    logger.error({ err: error, location, locale }, 'navigation load failed')
    return []
  }
}

async function loadNavigation(
  location: MenuLocation,
  locale: Locale,
  defaultLocale: Locale,
): Promise<NavigationItem[]> {
  const menu = await db.menu.findFirst({
    where: { location, enabled: true },
    select: {
      items: {
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          parentId: true,
          sortOrder: true,
          target: true,
          pageId: true,
          productId: true,
          productCategoryId: true,
          partnerId: true,
          brandId: true,
          serviceId: true,
          eventId: true,
          articleId: true,
          routeKey: true,
          externalUrl: true,
          openInNewTab: true,
          rel: true,
          icon: true,
          highlight: true,
          visibleLocales: true,
          translations: {
            where: { locale: { in: [locale, defaultLocale] } },
            orderBy: { locale: locale === defaultLocale ? 'asc' : 'desc' },
            select: { label: true, description: true, ariaLabel: true, locale: true },
          },
        },
      },
    },
  })

  if (!menu) return []

  const items = menu.items as unknown as RawItem[]

  const visible = items.filter(
    (item) => item.visibleLocales.length === 0 || item.visibleLocales.includes(locale),
  )

  const hrefs = await resolveHrefs(visible, locale)

  const nodes = new Map<string, NavigationItem>()
  for (const item of visible) {
    // Prefer the requested locale's label; fall back to the default locale.
    const translation =
      item.translations.find((t) => t.locale === locale) ?? item.translations[0]
    if (!translation) continue

    const href = hrefs.get(item.id) ?? null
    // An item whose target no longer resolves is dropped rather than rendered
    // as a dead link.
    if (item.target !== 'NONE' && href === null) continue

    nodes.set(item.id, {
      id: item.id,
      label: translation.label,
      description: translation.description,
      ariaLabel: translation.ariaLabel,
      href,
      external: item.target === 'EXTERNAL_URL',
      openInNewTab: item.openInNewTab,
      rel: item.rel ?? (item.target === 'EXTERNAL_URL' ? 'noopener noreferrer' : null),
      icon: item.icon,
      highlight: item.highlight,
      children: [],
    })
  }

  const roots: NavigationItem[] = []
  for (const item of visible) {
    const node = nodes.get(item.id)
    if (!node) continue
    if (item.parentId) {
      const parent = nodes.get(item.parentId)
      if (parent) {
        parent.children.push(node)
        continue
      }
    }
    roots.push(node)
  }

  return roots
}

/**
 * Batch-resolves every item's destination. One query per referenced entity
 * type, never one per menu item.
 */
async function resolveHrefs(
  items: RawItem[],
  locale: Locale,
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()

  const ids = {
    page: collect(items, 'PAGE', (i) => i.pageId),
    product: collect(items, 'PRODUCT', (i) => i.productId),
    productCategory: collect(items, 'PRODUCT_CATEGORY', (i) => i.productCategoryId),
    partner: collect(items, 'PARTNER', (i) => i.partnerId),
    brand: collect(items, 'BRAND', (i) => i.brandId),
    service: collect(items, 'SERVICE', (i) => i.serviceId),
    event: collect(items, 'EVENT', (i) => i.eventId),
    article: collect(items, 'ARTICLE', (i) => i.articleId),
  }

  const [pages, products, categories, partners, brands, services, events, articles] =
    await Promise.all([
      ids.page.length
        ? db.page.findMany({
            where: { id: { in: ids.page }, status: 'PUBLISHED' },
            select: {
              id: true,
              slug: true,
              translations: { where: { locale }, select: { slug: true } },
            },
          })
        : [],
      ids.product.length
        ? db.product.findMany({
            where: { id: { in: ids.product }, status: 'PUBLISHED' },
            select: {
              id: true,
              slug: true,
              translations: { where: { locale }, select: { slug: true } },
            },
          })
        : [],
      ids.productCategory.length
        ? db.productCategory.findMany({
            where: { id: { in: ids.productCategory }, enabled: true },
            select: {
              id: true,
              path: true,
              translations: { where: { locale }, select: { slug: true } },
            },
          })
        : [],
      ids.partner.length
        ? db.partner.findMany({
            where: { id: { in: ids.partner }, status: 'PUBLISHED' },
            select: {
              id: true,
              slug: true,
              translations: { where: { locale }, select: { slug: true } },
            },
          })
        : [],
      ids.brand.length
        ? db.brand.findMany({
            where: { id: { in: ids.brand }, status: 'PUBLISHED' },
            select: {
              id: true,
              slug: true,
              translations: { where: { locale }, select: { slug: true } },
            },
          })
        : [],
      ids.service.length
        ? db.service.findMany({
            where: { id: { in: ids.service }, status: 'PUBLISHED' },
            select: {
              id: true,
              slug: true,
              translations: { where: { locale }, select: { slug: true } },
            },
          })
        : [],
      ids.event.length
        ? db.event.findMany({
            where: { id: { in: ids.event }, status: 'PUBLISHED' },
            select: {
              id: true,
              slug: true,
              translations: { where: { locale }, select: { slug: true } },
            },
          })
        : [],
      ids.article.length
        ? db.article.findMany({
            where: { id: { in: ids.article }, status: 'PUBLISHED' },
            select: {
              id: true,
              slug: true,
              translations: { where: { locale }, select: { slug: true } },
            },
          })
        : [],
    ])

  const index = <T extends { id: string }>(rows: T[]) =>
    new Map(rows.map((r) => [r.id, r]))
  const pageMap = index(pages)
  const productMap = index(products)
  const categoryMap = index(categories)
  const partnerMap = index(partners)
  const brandMap = index(brands)
  const serviceMap = index(services)
  const eventMap = index(events)
  const articleMap = index(articles)

  const slugOf = (
    row: { slug: string; translations: { slug: string | null }[] } | undefined,
  ) => (row ? (row.translations[0]?.slug ?? row.slug) : null)

  for (const item of items) {
    switch (item.target) {
      case 'NONE':
        result.set(item.id, null)
        break
      case 'EXTERNAL_URL':
        result.set(item.id, item.externalUrl ?? null)
        break
      case 'ROUTE': {
        const path = item.routeKey ? ROUTE_PATHS[item.routeKey] : undefined
        result.set(item.id, path === undefined ? null : localized(locale, path))
        break
      }
      case 'PAGE': {
        const slug = slugOf(pageMap.get(item.pageId ?? ''))
        result.set(item.id, slug ? localized(locale, slug) : null)
        break
      }
      case 'PRODUCT': {
        const slug = slugOf(productMap.get(item.productId ?? ''))
        result.set(item.id, slug ? localized(locale, `products/${slug}`) : null)
        break
      }
      case 'PRODUCT_CATEGORY': {
        const row = categoryMap.get(item.productCategoryId ?? '')
        const path = row?.translations[0]?.slug ?? row?.path
        result.set(item.id, path ? localized(locale, `products/category/${path}`) : null)
        break
      }
      case 'PARTNER': {
        const slug = slugOf(partnerMap.get(item.partnerId ?? ''))
        result.set(item.id, slug ? localized(locale, `partners/${slug}`) : null)
        break
      }
      case 'BRAND': {
        const slug = slugOf(brandMap.get(item.brandId ?? ''))
        result.set(item.id, slug ? localized(locale, `brands/${slug}`) : null)
        break
      }
      case 'SERVICE': {
        const slug = slugOf(serviceMap.get(item.serviceId ?? ''))
        result.set(item.id, slug ? localized(locale, `services/${slug}`) : null)
        break
      }
      case 'EVENT': {
        const slug = slugOf(eventMap.get(item.eventId ?? ''))
        result.set(item.id, slug ? localized(locale, `events/${slug}`) : null)
        break
      }
      case 'ARTICLE': {
        const slug = slugOf(articleMap.get(item.articleId ?? ''))
        result.set(item.id, slug ? localized(locale, `news/${slug}`) : null)
        break
      }
    }
  }

  return result
}

function collect(
  items: RawItem[],
  target: MenuItemTarget,
  pick: (item: RawItem) => string | null,
): string[] {
  return [
    ...new Set(
      items
        .filter((item) => item.target === target)
        .map(pick)
        .filter((value): value is string => Boolean(value)),
    ),
  ]
}

function localized(locale: Locale, path: string): string {
  return path.length === 0 ? `/${locale}` : `/${locale}/${path}`
}

export async function invalidateNavigation(): Promise<void> {
  await invalidatePrefix(CACHE_PREFIX)
}
