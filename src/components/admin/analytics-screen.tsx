'use client'

import { useTranslations } from 'next-intl'
import { AdminPageHeader } from '@/components/admin/page-header'
import type { AnalyticsOverview, CountedRow } from '@/server/modules/analytics/service'

/**
 * Insight overview.
 *
 * Deliberately a set of counts and rankings rather than charts. With no
 * rollup table behind it there is no honest time series to draw, and a chart
 * of invented buckets is worse than a number that is simply correct.
 */

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-white px-4 py-3">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-900">
        {value.toLocaleString()}
      </dd>
    </div>
  )
}

export function CountTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string
  rows: CountedRow[]
  emptyLabel: string
}) {
  const max = rows.reduce((peak, row) => Math.max(peak, row.count), 0)

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-white">
      <h2 className="border-b border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-neutral-800">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {rows.map((row) => (
            <li key={row.label} className="relative px-4 py-2">
              {/* The bar is a background rule, not a chart: it gives the eye a
                  shape to compare without implying more precision than a count. */}
              <span
                aria-hidden="true"
                className="bg-primary-50 absolute inset-y-0 left-0 rounded-r"
                style={{ width: max > 0 ? `${(row.count / max) * 100}%` : '0%' }}
              />
              <span className="relative flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-neutral-700">{row.label}</span>
                <span className="shrink-0 font-medium text-neutral-900 tabular-nums">
                  {row.count.toLocaleString()}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function AnalyticsScreen({ data }: { data: AnalyticsOverview }) {
  const t = useTranslations('admin.analytics')

  return (
    <>
      <AdminPageHeader
        title={t('title')}
        description={t('description', { days: data.days })}
      />

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <StatTile label={t('pageViews')} value={data.totals.pageViews} />
        <StatTile label={t('visitors')} value={data.totals.uniqueVisitors} />
        <StatTile label={t('entityViews')} value={data.totals.entityViews} />
        <StatTile label={t('searches')} value={data.totals.searches} />
        <StatTile label={t('downloads')} value={data.totals.downloads} />
        <StatTile label={t('ctaClicks')} value={data.totals.ctaClicks} />
        <StatTile label={t('inquiries')} value={data.totals.inquiries} />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <CountTable title={t('topPaths')} rows={data.topPaths} emptyLabel={t('noData')} />
        <CountTable
          title={t('topReferrers')}
          rows={data.topReferrers}
          emptyLabel={t('noData')}
        />
        <CountTable title={t('devices')} rows={data.devices} emptyLabel={t('noData')} />
        <CountTable title={t('locales')} rows={data.locales} emptyLabel={t('noData')} />
        <CountTable title={t('topCtas')} rows={data.topCtas} emptyLabel={t('noData')} />
      </div>

      <p className="mt-6 text-xs text-neutral-500">{t('footnote')}</p>
    </>
  )
}
