import Link from 'next/link'
import { getActor } from '@/server/auth/context'
import { translationMatrix } from '@/server/modules/admin/translations'
import { LOCALE_DESCRIPTORS, LOCALES } from '@/i18n/config'
import { AdminPageHeader } from '@/components/admin/page-header'
import { EmptyState } from '@/components/admin/empty-state'

export const dynamic = 'force-dynamic'

/**
 * Translation completeness matrix.
 *
 * Every number is a link into the list it describes, because the useful next
 * action after seeing "12 missing in Chinese" is to open those twelve records.
 */
export default async function TranslationsPage() {
  const actor = await getActor()
  const matrix = await translationMatrix(actor)
  const withContent = matrix.filter((entity) => entity.baseCount > 0)

  return (
    <>
      <AdminPageHeader
        title="Translations"
        description="Where each content type stands in each language. Approved content is what the public site shows."
      />

      {withContent.length === 0 ? (
        <EmptyState
          title="Nothing to translate yet"
          description="Once products, partners or articles exist, their translation status appears here."
        />
      ) : (
        <div className="space-y-4">
          {withContent.map((entity) => (
            <section
              key={entity.key}
              className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white"
            >
              <header className="flex items-baseline justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-3">
                <h2 className="text-sm font-semibold text-neutral-900">
                  <Link
                    href={`/admin/${entity.path}`}
                    className="hover:text-primary-800 hover:underline"
                  >
                    {entity.label}
                  </Link>
                </h2>
                <span className="text-sm text-neutral-500">
                  {entity.baseCount} records
                </span>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-sm">
                  <thead>
                    <tr className="text-left">
                      <th
                        scope="col"
                        className="px-5 py-2.5 font-medium text-neutral-600"
                      >
                        Language
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-2.5 font-medium text-neutral-600"
                      >
                        Approved
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-2.5 font-medium text-neutral-600"
                      >
                        Draft
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-2.5 font-medium text-neutral-600"
                      >
                        AI draft
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-2.5 font-medium text-neutral-600"
                      >
                        Outdated
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-2.5 font-medium text-neutral-600"
                      >
                        Missing
                      </th>
                      <th
                        scope="col"
                        className="w-40 px-5 py-2.5 font-medium text-neutral-600"
                      >
                        Complete
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entity.locales.map((row) => (
                      <tr
                        key={row.locale}
                        className="border-t border-[var(--border-subtle)]"
                      >
                        <th
                          scope="row"
                          className="px-5 py-3 text-left font-medium text-neutral-800"
                        >
                          {LOCALE_DESCRIPTORS[row.locale].nativeName}
                          <span className="ml-2 text-xs text-neutral-400 uppercase">
                            {row.locale}
                          </span>
                        </th>
                        <td className="text-success-700 px-5 py-3 tabular-nums">
                          {row.approved}
                        </td>
                        <td className="px-5 py-3 text-neutral-600 tabular-nums">
                          {row.humanDraft}
                        </td>
                        <td className="text-warning-700 px-5 py-3 tabular-nums">
                          {row.aiDraft}
                        </td>
                        <td className="text-accent-700 px-5 py-3 tabular-nums">
                          {row.outdated}
                        </td>
                        <td className="px-5 py-3 text-neutral-500 tabular-nums">
                          {row.missing}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"
                              role="progressbar"
                              aria-valuenow={row.percentApproved}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${entity.label}, ${row.locale}`}
                            >
                              <div
                                className="bg-primary-600 h-full rounded-full"
                                style={{ width: `${row.percentApproved}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs text-neutral-600 tabular-nums">
                              {row.percentApproved}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 text-sm text-neutral-500">
        Languages shown:{' '}
        {LOCALES.map((locale) => LOCALE_DESCRIPTORS[locale].nativeName).join(', ')}. AI
        drafts are never published automatically — a Super Admin must review and approve
        them.
      </p>
    </>
  )
}
