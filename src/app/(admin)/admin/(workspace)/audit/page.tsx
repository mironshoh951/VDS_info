import { getActor } from '@/server/auth/context'
import { requireCapability } from '@/server/auth/guard'
import { db } from '@/server/db/client'
import { AdminPageHeader } from '@/components/admin/page-header'
import { EmptyState } from '@/components/admin/empty-state'
import { Pagination } from '@/components/site/pagination'
import { Badge } from '@/components/ui'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

/**
 * Audit log (§48).
 *
 * Read-only by design: there is no delete control here and no code path that
 * removes a row. Retention is handled by a scheduled archival job, never by a
 * person clicking something.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actor = await getActor()
  await requireCapability(actor, 'audit.read')

  const params = await searchParams
  const first = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }

  const page = Math.max(1, Number.parseInt(first('page') ?? '1', 10) || 1)
  const query = first('q')

  const where = query
    ? {
        OR: [
          { action: { contains: query, mode: 'insensitive' as const } },
          { entityLabel: { contains: query, mode: 'insensitive' as const } },
          { actorLabel: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [total, entries] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        actorLabel: true,
        actorRole: true,
        entityType: true,
        entityLabel: true,
        diff: true,
        success: true,
        failureReason: true,
        stepUpUsed: true,
        ip: true,
        createdAt: true,
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        description="Every change made in the administration panel, including refused attempts. This log cannot be edited or deleted."
      />

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Administrative actions are written here as they happen."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white">
            <table className="w-full min-w-[54rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-left">
                  <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                    When
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                    Who
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                    Action
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                    Subject
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                    Changed
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const changed =
                    entry.diff && typeof entry.diff === 'object'
                      ? Object.keys(entry.diff as Record<string, unknown>)
                      : []

                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                        <time dateTime={entry.createdAt.toISOString()}>
                          {entry.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
                        </time>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-neutral-800">
                          {entry.actorLabel ?? 'system'}
                        </span>
                        {entry.ip && (
                          <span className="text-2xs block font-mono text-neutral-400">
                            {entry.ip}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-neutral-800">
                          {entry.action}
                        </span>
                        {!entry.success && (
                          <Badge variant="danger" size="sm" className="ml-2">
                            refused
                          </Badge>
                        )}
                        {entry.stepUpUsed && (
                          <Badge variant="brand" size="sm" className="ml-2">
                            confirmed
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {entry.entityLabel ?? entry.entityType ?? '—'}
                        {entry.failureReason && (
                          <span className="text-2xs text-danger-700 block">
                            {entry.failureReason}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {changed.length > 0 ? changed.slice(0, 4).join(', ') : '—'}
                        {changed.length > 4 && ` +${changed.length - 4}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(target) => `/admin/audit${target > 1 ? `?page=${target}` : ''}`}
            labels={{
              previous: 'Previous',
              next: 'Next',
              page: `Page ${page} of ${totalPages}`,
            }}
          />
        </>
      )}
    </>
  )
}
