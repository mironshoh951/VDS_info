import { redirect } from 'next/navigation'
import { getActor } from '@/server/auth/context'
import { requireCapability } from '@/server/auth/guard'
import { getDashboardSummary } from '@/server/modules/dashboard/service'

export const dynamic = 'force-dynamic'

/**
 * Administration dashboard.
 *
 * Every figure is a live count from the database — there are no placeholder
 * numbers anywhere in this file (§49).
 */
export default async function DashboardPage() {
  const actor = await getActor()
  if (actor.kind !== 'user' || actor.capabilities.size === 0) {
    redirect('/admin/login')
  }

  await requireCapability(actor, 'content.read')
  const summary = await getDashboardSummary(actor)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Signed in as {actor.name} ·{' '}
          {actor.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Viewer'}
        </p>
      </header>

      <section
        aria-label="Content totals"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {summary.counts.map((item) => (
          <div
            key={item.key}
            className="rounded-lg border border-[var(--border-subtle)] bg-white p-5"
          >
            <p className="text-sm text-neutral-600">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900 tabular-nums">
              {item.total}
            </p>
            {item.published !== undefined && (
              <p className="mt-1 text-xs text-neutral-500">{item.published} published</p>
            )}
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">
            Translation completeness
          </h2>
          {summary.translationCompleteness.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No translatable content yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {summary.translationCompleteness.map((row) => (
                <li key={row.locale}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-neutral-800">{row.locale}</span>
                    <span className="text-neutral-600 tabular-nums">
                      {row.approved}/{row.expected}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100"
                    role="progressbar"
                    aria-valuenow={row.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${row.locale} translation completeness`}
                  >
                    <div
                      className="bg-primary-600 h-full rounded-full"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Recent activity</h2>
          {summary.recentActivity.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {summary.recentActivity.map((entry) => (
                <li key={entry.id} className="flex items-baseline justify-between gap-4">
                  <span className="truncate text-neutral-700">
                    {entry.action}
                    {entry.entityLabel ? ` · ${entry.entityLabel}` : ''}
                  </span>
                  <time
                    dateTime={entry.createdAt.toISOString()}
                    className="shrink-0 text-xs text-neutral-500"
                  >
                    {entry.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
