import { db } from '@/server/db/client'
import { authorize } from '@/server/auth/guard'
import type { Actor } from '@/server/auth/actor'

/**
 * Read models for the Insight screens (§37).
 *
 * Everything here is a plain aggregate over the raw event tables. There is no
 * pre-computed rollup because there is no worker running one yet, and a screen
 * that reads an empty rollup table looks broken in a way that is hard to
 * diagnose. Counting the events directly is slower at scale but always true;
 * `AnalyticsDaily` is where this moves when the worker exists.
 */

export interface CountedRow {
  label: string
  count: number
}

export interface AnalyticsOverview {
  days: number
  totals: {
    pageViews: number
    uniqueVisitors: number
    entityViews: number
    searches: number
    downloads: number
    ctaClicks: number
    inquiries: number
  }
  topPaths: CountedRow[]
  topReferrers: CountedRow[]
  devices: CountedRow[]
  locales: CountedRow[]
  topCtas: CountedRow[]
}

function since(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

export async function getAnalyticsOverview(
  actor: Actor,
  days = 30,
): Promise<AnalyticsOverview> {
  await authorize(actor, 'analytics.read')

  const from = since(days)
  const window = { createdAt: { gte: from } }

  const [
    pageViews,
    uniqueVisitors,
    entityViews,
    searches,
    downloads,
    ctaClicks,
    inquiries,
    paths,
    referrers,
    devices,
    locales,
    ctas,
  ] = await Promise.all([
    db.pageView.count({ where: window }),
    db.pageView
      .findMany({
        where: { ...window, visitorHash: { not: null } },
        distinct: ['visitorHash'],
        select: { visitorHash: true },
      })
      .then((rows) => rows.length),
    db.entityView.count({ where: window }),
    db.searchQueryLog.count({ where: window }),
    db.downloadEvent.count({ where: window }),
    db.ctaClick.count({ where: window }),
    db.inquiry.count({ where: window }),

    db.pageView.groupBy({
      by: ['path'],
      where: window,
      _count: { path: true },
      orderBy: { _count: { path: 'desc' } },
      take: 12,
    }),
    db.pageView.groupBy({
      by: ['referrerHost'],
      where: { ...window, referrerHost: { not: null } },
      _count: { referrerHost: true },
      orderBy: { _count: { referrerHost: 'desc' } },
      take: 8,
    }),
    db.pageView.groupBy({
      by: ['deviceType'],
      where: { ...window, deviceType: { not: null } },
      _count: { deviceType: true },
      orderBy: { _count: { deviceType: 'desc' } },
      take: 6,
    }),
    db.pageView.groupBy({
      by: ['locale'],
      where: { ...window, locale: { not: null } },
      _count: { locale: true },
      orderBy: { _count: { locale: 'desc' } },
      take: 6,
    }),
    db.ctaClick.groupBy({
      by: ['ctaKey'],
      where: window,
      _count: { ctaKey: true },
      orderBy: { _count: { ctaKey: 'desc' } },
      take: 8,
    }),
  ])

  return {
    days,
    totals: {
      pageViews,
      uniqueVisitors,
      entityViews,
      searches,
      downloads,
      ctaClicks,
      inquiries,
    },
    topPaths: paths.map((row) => ({ label: row.path, count: row._count.path })),
    topReferrers: referrers.map((row) => ({
      label: row.referrerHost ?? '—',
      count: row._count.referrerHost,
    })),
    devices: devices.map((row) => ({
      label: row.deviceType ?? '—',
      count: row._count.deviceType,
    })),
    locales: locales.map((row) => ({
      label: row.locale ?? '—',
      count: row._count.locale,
    })),
    topCtas: ctas.map((row) => ({ label: row.ctaKey, count: row._count.ctaKey })),
  }
}

export interface SearchTermRow {
  term: string
  searches: number
  averageResults: number
}

export interface SearchTermsReport {
  days: number
  total: number
  topTerms: SearchTermRow[]
  emptyTerms: SearchTermRow[]
}

export async function getSearchTerms(
  actor: Actor,
  days = 30,
): Promise<SearchTermsReport> {
  await authorize(actor, 'analytics.read')

  const from = since(days)
  const window = { createdAt: { gte: from } }

  const [total, top, empty] = await Promise.all([
    db.searchQueryLog.count({ where: window }),
    db.searchQueryLog.groupBy({
      by: ['normalized'],
      where: window,
      _count: { normalized: true },
      _avg: { resultCount: true },
      orderBy: { _count: { normalized: 'desc' } },
      take: 25,
    }),
    // Searches that found nothing are the most actionable list on the screen:
    // each one is a visitor who wanted something this site does not surface.
    db.searchQueryLog.groupBy({
      by: ['normalized'],
      where: { ...window, resultCount: 0 },
      _count: { normalized: true },
      _avg: { resultCount: true },
      orderBy: { _count: { normalized: 'desc' } },
      take: 25,
    }),
  ])

  const shape = (rows: typeof top): SearchTermRow[] =>
    rows.map((row) => ({
      term: row.normalized,
      searches: row._count.normalized,
      averageResults: Math.round((row._avg.resultCount ?? 0) * 10) / 10,
    }))

  return { days, total, topTerms: shape(top), emptyTerms: shape(empty) }
}
