'use client'

import { useTranslations } from 'next-intl'
import { AdminPageHeader } from '@/components/admin/page-header'
import type { SearchTermsReport, SearchTermRow } from '@/server/modules/analytics/service'

/**
 * What visitors typed into search.
 *
 * The screen leads with the searches that returned nothing. Popular terms tell
 * you what the site already does well; empty ones are a list of things people
 * came looking for and did not find, which is the only half that tells you
 * what to write next.
 */

function TermTable({
  title,
  description,
  rows,
  emptyLabel,
  showAverage,
}: {
  title: string
  description: string
  rows: SearchTermRow[]
  emptyLabel: string
  showAverage: boolean
}) {
  const t = useTranslations('admin.searchTerms')

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-white">
      <header className="border-b border-[var(--border-subtle)] px-4 py-2.5">
        <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
        <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-2xs text-left text-neutral-500 uppercase">
              <th className="px-4 py-2 font-medium">{t('term')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('searches')}</th>
              {showAverage && (
                <th className="px-4 py-2 text-right font-medium">{t('avgResults')}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.map((row) => (
              <tr key={row.term}>
                <td className="truncate px-4 py-2 text-neutral-800">{row.term}</td>
                <td className="px-4 py-2 text-right text-neutral-900 tabular-nums">
                  {row.searches.toLocaleString()}
                </td>
                {showAverage && (
                  <td className="px-4 py-2 text-right text-neutral-600 tabular-nums">
                    {row.averageResults}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export function SearchTermsScreen({ data }: { data: SearchTermsReport }) {
  const t = useTranslations('admin.searchTerms')

  return (
    <>
      <AdminPageHeader
        title={t('title')}
        description={t('description', { days: data.days, total: data.total })}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TermTable
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          rows={data.emptyTerms}
          emptyLabel={t('noEmpty')}
          showAverage={false}
        />
        <TermTable
          title={t('topTitle')}
          description={t('topDescription')}
          rows={data.topTerms}
          emptyLabel={t('noData')}
          showAverage
        />
      </div>
    </>
  )
}
