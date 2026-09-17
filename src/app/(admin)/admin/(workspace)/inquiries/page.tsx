import Link from 'next/link'
import { getActor } from '@/server/auth/context'
import { listInquiries, inquiryCounts } from '@/server/modules/inquiries/service'
import { AdminPageHeader } from '@/components/admin/page-header'
import { ListFilters } from '@/components/admin/list-filters'
import { EmptyState } from '@/components/admin/empty-state'
import { Pagination } from '@/components/site/pagination'
import { Badge } from '@/components/ui'
import type { InquiryStatus } from '@/server/db/generated/enums'

export const dynamic = 'force-dynamic'

const STATUS_CHIPS: Array<{ value: InquiryStatus; label: string }> = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'SPAM', label: 'Spam' },
]

const STATUS_VARIANT: Record<
  InquiryStatus,
  'brand' | 'warning' | 'success' | 'neutral' | 'danger'
> = {
  NEW: 'brand',
  IN_PROGRESS: 'warning',
  CONTACTED: 'warning',
  RESOLVED: 'success',
  ARCHIVED: 'neutral',
  SPAM: 'danger',
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const actor = await getActor()

  const first = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }

  const status = STATUS_CHIPS.find((chip) => chip.value === first('status'))?.value
  const page = Math.max(1, Number.parseInt(first('page') ?? '1', 10) || 1)
  const query = first('q')

  const [result, counts] = await Promise.all([
    listInquiries(actor, {
      ...(status ? { status } : {}),
      ...(query ? { query } : {}),
      page,
    }),
    inquiryCounts(actor),
  ])

  const buildHref = (targetPage: number) => {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && key !== 'page') next.set(key, value)
    }
    if (targetPage > 1) next.set('page', String(targetPage))
    const suffix = next.toString()
    return `/admin/inquiries${suffix ? `?${suffix}` : ''}`
  }

  return (
    <>
      <AdminPageHeader
        title="Inquiries"
        description="Everything submitted through the public forms, newest first."
      />

      <ListFilters counts={counts} statuses={STATUS_CHIPS} />

      {result.rows.length === 0 ? (
        <EmptyState
          title="No inquiries"
          description="Submissions from the contact and product enquiry forms appear here as soon as they arrive."
        />
      ) : (
        <>
          {result.rows[0]?.masked && (
            <p className="mb-4 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-2.5 text-sm text-neutral-600">
              Contact details are masked for read-only accounts. A Super Admin can change
              this in Settings → Security.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-left">
                  <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                    Reference
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                    From
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                    Received
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/inquiries/${row.id}`}
                        className="text-primary-700 font-mono text-xs font-medium hover:underline"
                      >
                        {row.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-neutral-900">
                        {row.name}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {row.company ? `${row.company} · ` : ''}
                        {row.email}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{row.type}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[row.status]} size="sm">
                        {row.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      <time dateTime={row.createdAt.toISOString()}>
                        {row.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
