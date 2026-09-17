import { db } from '@/server/db/client'
import { requireCapability } from '@/server/auth/guard'
import type { Actor } from '@/server/auth/actor'
import { LOCALES, type Locale } from '@/i18n/config'
import type { TranslationStatus } from '@/server/db/generated/enums'

/**
 * Translation completeness (§2.1).
 *
 * The matrix answers the question an editor actually has: "what is missing, and
 * in which language". Missing is computed as base rows minus rows that have a
 * translation at all — a translation table cannot tell you about a record that
 * has no row in it, which is the case a naive `groupBy` would silently hide.
 */

export interface LocaleBreakdown {
  locale: Locale
  approved: number
  humanDraft: number
  aiDraft: number
  outdated: number
  missing: number
  total: number
  percentApproved: number
}

export interface EntityTranslationSummary {
  key: string
  label: string
  path: string
  baseCount: number
  locales: LocaleBreakdown[]
}

interface TranslatableSource {
  key: string
  label: string
  path: string
  countBase: () => Promise<number>
  groupTranslations: () => Promise<
    Array<{ locale: string; status: TranslationStatus; count: number }>
  >
}

function source(
  key: string,
  label: string,
  path: string,
  countBase: () => Promise<number>,
  group: () => Promise<
    Array<{ locale: string; status: TranslationStatus; _count: { _all: number } }>
  >,
): TranslatableSource {
  return {
    key,
    label,
    path,
    countBase,
    groupTranslations: async () =>
      (await group()).map((row) => ({
        locale: row.locale,
        status: row.status,
        count: row._count._all,
      })),
  }
}

function sources(): TranslatableSource[] {
  return [
    source(
      'product',
      'Products',
      'products',
      () => db.product.count(),
      () =>
        db.productTranslation.groupBy({
          by: ['locale', 'status'],
          _count: { _all: true },
        }),
    ),
    source(
      'partner',
      'Partners',
      'partners',
      () => db.partner.count(),
      () =>
        db.partnerTranslation.groupBy({
          by: ['locale', 'status'],
          _count: { _all: true },
        }),
    ),
    source(
      'brand',
      'Brands',
      'brands',
      () => db.brand.count(),
      () =>
        db.brandTranslation.groupBy({ by: ['locale', 'status'], _count: { _all: true } }),
    ),
    source(
      'service',
      'Services',
      'services',
      () => db.service.count(),
      () =>
        db.serviceTranslation.groupBy({
          by: ['locale', 'status'],
          _count: { _all: true },
        }),
    ),
    source(
      'event',
      'Events',
      'events',
      () => db.event.count(),
      () =>
        db.eventTranslation.groupBy({ by: ['locale', 'status'], _count: { _all: true } }),
    ),
    source(
      'article',
      'News',
      'news',
      () => db.article.count(),
      () =>
        db.articleTranslation.groupBy({
          by: ['locale', 'status'],
          _count: { _all: true },
        }),
    ),
    source(
      'resource',
      'Resources',
      'resources',
      () => db.resource.count(),
      () =>
        db.resourceTranslation.groupBy({
          by: ['locale', 'status'],
          _count: { _all: true },
        }),
    ),
    source(
      'certificate',
      'Trust centre',
      'certificates',
      () => db.certificate.count(),
      () =>
        db.certificateTranslation.groupBy({
          by: ['locale', 'status'],
          _count: { _all: true },
        }),
    ),
    source(
      'page',
      'Pages',
      'pages',
      () => db.page.count(),
      () =>
        db.pageTranslation.groupBy({ by: ['locale', 'status'], _count: { _all: true } }),
    ),
  ]
}

export async function translationMatrix(
  actor: Actor,
): Promise<EntityTranslationSummary[]> {
  await requireCapability(actor, 'translation.read')

  return Promise.all(
    sources().map(async (entry) => {
      const [baseCount, grouped] = await Promise.all([
        entry.countBase(),
        entry.groupTranslations(),
      ])

      const locales: LocaleBreakdown[] = LOCALES.map((locale) => {
        const rows = grouped.filter((row) => row.locale === locale)
        const byStatus = (status: TranslationStatus) =>
          rows.find((row) => row.status === status)?.count ?? 0

        const approved = byStatus('APPROVED')
        const humanDraft = byStatus('HUMAN_DRAFT')
        const aiDraft = byStatus('AI_DRAFT')
        const outdated = byStatus('OUTDATED')
        const present = rows.reduce((sum, row) => sum + row.count, 0)

        return {
          locale,
          approved,
          humanDraft,
          aiDraft,
          outdated,
          // A base record with no translation row at all is missing too.
          missing: Math.max(0, baseCount - present) + byStatus('MISSING'),
          total: baseCount,
          percentApproved: baseCount === 0 ? 0 : Math.round((approved / baseCount) * 100),
        }
      })

      return {
        key: entry.key,
        label: entry.label,
        path: entry.path,
        baseCount,
        locales,
      }
    }),
  )
}

/** Overall approval percentage per locale, for the dashboard. */
export async function overallCompleteness(
  actor: Actor,
): Promise<Array<{ locale: Locale; percent: number; approved: number; total: number }>> {
  const matrix = await translationMatrix(actor)

  return LOCALES.map((locale) => {
    let approved = 0
    let total = 0
    for (const entity of matrix) {
      const row = entity.locales.find((item) => item.locale === locale)
      if (!row) continue
      approved += row.approved
      total += row.total
    }
    return {
      locale,
      approved,
      total,
      percent: total === 0 ? 0 : Math.round((approved / total) * 100),
    }
  })
}
