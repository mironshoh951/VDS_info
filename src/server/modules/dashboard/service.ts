import { db } from '@/server/db/client'
import { requireCapability } from '@/server/auth/guard'
import { hasCapability } from '@/server/auth/guard'
import type { Actor } from '@/server/auth/actor'
import { LOCALES } from '@/i18n/config'

/**
 * Dashboard data (§49).
 *
 * Every number here is a real query. The translation figures are computed the
 * same way the translation dashboard computes them, so the two can never
 * disagree.
 *
 * A Viewer sees content and analytics figures but not the audit feed — the
 * capability check is inside this service, not in the page, so the API and the
 * page enforce the same rule.
 */

export interface CountTile {
  key: string
  label: string
  total: number
  published?: number
}

export interface TranslationCompletenessRow {
  locale: string
  approved: number
  expected: number
  percent: number
}

export interface ActivityEntry {
  id: string
  action: string
  entityLabel: string | null
  createdAt: Date
}

export interface DashboardSummary {
  counts: CountTile[]
  translationCompleteness: TranslationCompletenessRow[]
  recentActivity: ActivityEntry[]
  newInquiries: number
}

export async function getDashboardSummary(actor: Actor): Promise<DashboardSummary> {
  await requireCapability(actor, 'content.read')

  const [
    products,
    publishedProducts,
    partners,
    publishedPartners,
    brands,
    publishedBrands,
    services,
    publishedServices,
    events,
    articles,
    resources,
    newInquiries,
  ] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { status: 'PUBLISHED' } }),
    db.partner.count(),
    db.partner.count({ where: { status: 'PUBLISHED' } }),
    db.brand.count(),
    db.brand.count({ where: { status: 'PUBLISHED' } }),
    db.service.count(),
    db.service.count({ where: { status: 'PUBLISHED' } }),
    db.event.count(),
    db.article.count(),
    db.resource.count(),
    db.inquiry.count({ where: { status: 'NEW' } }),
  ])

  const counts: CountTile[] = [
    { key: 'products', label: 'Products', total: products, published: publishedProducts },
    { key: 'partners', label: 'Partners', total: partners, published: publishedPartners },
    { key: 'brands', label: 'Brands', total: brands, published: publishedBrands },
    { key: 'services', label: 'Services', total: services, published: publishedServices },
    { key: 'events', label: 'Events', total: events },
    { key: 'articles', label: 'Articles', total: articles },
    { key: 'resources', label: 'Resources', total: resources },
    { key: 'inquiries', label: 'New inquiries', total: newInquiries },
  ]

  const [translationCompleteness, recentActivity] = await Promise.all([
    getTranslationCompleteness(),
    hasCapability(actor, 'audit.read') ? getRecentActivity() : Promise.resolve([]),
  ])

  return { counts, translationCompleteness, recentActivity, newInquiries }
}

/**
 * Completeness per locale across the entity types that carry customer-facing
 * content. "Expected" is the number of base records; "approved" is how many
 * have an approved translation in that locale.
 */
export async function getTranslationCompleteness(): Promise<
  TranslationCompletenessRow[]
> {
  const [productBase, partnerBase, brandBase, serviceBase, articleBase] =
    await Promise.all([
      db.product.count(),
      db.partner.count(),
      db.brand.count(),
      db.service.count(),
      db.article.count(),
    ])

  const expected = productBase + partnerBase + brandBase + serviceBase + articleBase

  return Promise.all(
    LOCALES.map(async (locale) => {
      const [products, partners, brands, services, articles] = await Promise.all([
        db.productTranslation.count({ where: { locale, status: 'APPROVED' } }),
        db.partnerTranslation.count({ where: { locale, status: 'APPROVED' } }),
        db.brandTranslation.count({ where: { locale, status: 'APPROVED' } }),
        db.serviceTranslation.count({ where: { locale, status: 'APPROVED' } }),
        db.articleTranslation.count({ where: { locale, status: 'APPROVED' } }),
      ])

      const approved = products + partners + brands + services + articles

      return {
        locale,
        approved,
        expected,
        percent: expected === 0 ? 0 : Math.round((approved / expected) * 100),
      }
    }),
  )
}

async function getRecentActivity(limit = 12): Promise<ActivityEntry[]> {
  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, action: true, entityLabel: true, createdAt: true },
  })
  return rows
}
