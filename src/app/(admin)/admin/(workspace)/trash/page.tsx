import Link from 'next/link'
import { getActor } from '@/server/auth/context'
import { requireCapability } from '@/server/auth/guard'
import { RESOURCES, RESOURCE_KEYS } from '@/server/modules/admin/resources'
import { AdminPageHeader } from '@/components/admin/page-header'
import { EmptyState } from '@/components/admin/empty-state'

export const dynamic = 'force-dynamic'

/**
 * Trash overview.
 *
 * Deleted items stay with their own content type — restoring a product is a
 * product decision — so this page counts what is in the bin and links to each
 * list's trash view rather than mixing nine kinds of record in one table.
 */
export default async function TrashPage() {
  const actor = await getActor()
  await requireCapability(actor, 'content.read')

  const counts = await Promise.all(
    RESOURCE_KEYS.map(async (key) => {
      const definition = RESOURCES[key]
      const count = await definition
        .rawDelegate()
        .count({ where: { deletedAt: { not: null } } })
        .catch(() => 0)
      return { key, definition, count }
    }),
  )

  const withItems = counts.filter((entry) => entry.count > 0)
  const total = counts.reduce((sum, entry) => sum + entry.count, 0)

  return (
    <>
      <AdminPageHeader
        title="Trash"
        description="Deleted content is kept until it is permanently removed. Restoring brings an item back as a draft, never straight to the live site."
      />

      {total === 0 ? (
        <EmptyState
          title="Trash is empty"
          description="Content you delete appears here and can be restored."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withItems.map((entry) => (
            <li key={entry.key}>
              <Link
                href={`/admin/${entry.definition.path}?trash=1`}
                className="block rounded-xl border border-[var(--border-subtle)] bg-white p-5 transition-shadow hover:shadow-sm"
              >
                <p className="text-sm text-neutral-600">{entry.definition.labelPlural}</p>
                <p className="mt-2 text-3xl font-semibold text-neutral-900 tabular-nums">
                  {entry.count}
                </p>
                <p className="mt-1 text-xs text-neutral-500">in trash</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 max-w-2xl text-sm text-neutral-500">
        Permanent deletion destroys the record and everything attached to it, cannot be
        undone, and requires you to re-enter your password. Everything else here is
        reversible.
      </p>
    </>
  )
}
