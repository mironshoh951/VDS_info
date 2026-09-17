import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getActor } from '@/server/auth/context'
import { hasCapability } from '@/server/auth/guard'
import { listForAdmin, statusCounts } from '@/server/modules/admin/lists'
import { RESOURCES, type ResourceKey } from '@/server/modules/admin/resources'
import { LOCALES, DEFAULT_LOCALE } from '@/i18n/config'
import { AdminPageHeader } from './page-header'
import { ListFilters } from './list-filters'
import { ResourceTable } from './resource-table'
import { EmptyState } from './empty-state'
import { Pagination } from '@/components/site/pagination'
import { Button } from '@/components/ui'
import type { ContentStatus } from '@/server/db/generated/enums'

/**
 * One implementation of "a list of content", used by every content type.
 *
 * The per-type page files are three lines each, which is what keeps the ten
 * screens consistent — filters, bulk actions, translation indicators and
 * confirmation flows behave identically everywhere because they are the same
 * component.
 */

const STATUS_CHIPS: Array<{ value: ContentStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'REVIEW', label: 'In review' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

export async function ResourceList({
  resourceKey,
  searchParams,
  description,
}: {
  resourceKey: ResourceKey
  searchParams: Record<string, string | string[] | undefined>
  description?: string
}) {
  const definition = RESOURCES[resourceKey]
  const actor = await getActor()

  const first = (key: string): string | undefined => {
    const value = searchParams[key]
    return Array.isArray(value) ? value[0] : value
  }

  const trashed = first('trash') === '1'
  const rawStatus = first('status')
  const status = STATUS_CHIPS.find((chip) => chip.value === rawStatus)?.value
  const page = Math.max(1, Number.parseInt(first('page') ?? '1', 10) || 1)
  const query = first('q')

  const [result, counts] = await Promise.all([
    listForAdmin(actor, resourceKey, {
      ...(query ? { query } : {}),
      ...(status ? { status } : {}),
      trashed,
      page,
    }),
    statusCounts(actor, resourceKey),
  ])

  const canEdit = hasCapability(actor, 'content.update')
  const canDelete = hasCapability(actor, 'content.delete.soft')
  const canPermanentDelete = hasCapability(actor, 'content.delete.permanent')
  const canCreate = hasCapability(actor, 'content.create')

  const buildHref = (targetPage: number) => {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === 'string' && key !== 'page') next.set(key, value)
    }
    if (targetPage > 1) next.set('page', String(targetPage))
    const suffix = next.toString()
    return `/admin/${definition.path}${suffix ? `?${suffix}` : ''}`
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const publicHrefBase =
    definition.publicPath === null
      ? null
      : `${siteUrl}/${DEFAULT_LOCALE}${definition.publicPath ? `/${definition.publicPath}` : ''}`

  return (
    <>
      <AdminPageHeader
        title={definition.labelPlural}
        {...(description ? { description } : {})}
        actions={
          canCreate && !trashed ? (
            <Button asChild>
              <Link href={`/admin/${definition.path}/new`}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New {definition.label.toLowerCase()}
              </Link>
            </Button>
          ) : null
        }
      />

      <ListFilters counts={counts} statuses={definition.hasStatus ? STATUS_CHIPS : []} />

      {result.rows.length === 0 ? (
        <EmptyState
          title={
            query || status || trashed
              ? 'Nothing matches this filter'
              : `No ${definition.labelPlural.toLowerCase()} yet`
          }
          description={
            query || status || trashed
              ? 'Try a different search term or clear the filters.'
              : `Create the first ${definition.label.toLowerCase()} to see it here and on the public site once published.`
          }
          {...(canCreate && !trashed && !query && !status
            ? {
                action: {
                  label: `New ${definition.label.toLowerCase()}`,
                  href: `/admin/${definition.path}/new`,
                },
              }
            : {})}
        />
      ) : (
        <>
          <ResourceTable
            resource={resourceKey}
            rows={result.rows}
            locales={LOCALES}
            canEdit={canEdit}
            canDelete={canDelete}
            canPermanentDelete={canPermanentDelete}
            editHrefBase={`/admin/${definition.path}`}
            publicHrefBase={publicHrefBase}
            trashed={trashed}
          />

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            buildHref={buildHref}
            labels={{
              previous: 'Previous',
              next: 'Next',
              page: `Page ${result.page} of ${result.totalPages}`,
            }}
          />
        </>
      )}
    </>
  )
}
