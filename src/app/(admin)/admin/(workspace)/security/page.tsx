import { getActor } from '@/server/auth/context'
import { requireCapability, hasCapability } from '@/server/auth/guard'
import { securityOverview } from '@/server/modules/admin/security-centre'
import { AdminPageHeader } from '@/components/admin/page-header'
import { SessionList } from '@/components/admin/session-list'
import { Badge } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function SecurityPage() {
  const actor = await getActor()
  await requireCapability(actor, 'security.read')

  const overview = await securityOverview(actor)
  const canRevoke = hasCapability(actor, 'session.revoke')

  return (
    <>
      <AdminPageHeader
        title="Security"
        description="Active sessions, sign-in history and security events for this installation."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Active sessions" value={overview.sessions.length} />
        <Stat
          label="Failed sign-ins (24h)"
          value={overview.failedLast24h}
          tone={overview.failedLast24h > 10 ? 'warning' : 'neutral'}
        />
        <Stat
          label="Accounts without MFA"
          value={overview.accountsWithoutMfa}
          tone={overview.accountsWithoutMfa > 0 ? 'warning' : 'success'}
        />
      </div>

      <Panel title="Active sessions">
        {overview.sessions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No active sessions.</p>
        ) : (
          <SessionList sessions={overview.sessions} canRevoke={canRevoke} />
        )}
      </Panel>

      <Panel title="Accounts">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left">
                <th scope="col" className="px-5 py-2.5 font-medium text-neutral-600">
                  Name
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium text-neutral-600">
                  Role
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium text-neutral-600">
                  MFA
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium text-neutral-600">
                  Last sign-in
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium text-neutral-600">
                  State
                </th>
              </tr>
            </thead>
            <tbody>
              {overview.accounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-b border-[var(--border-subtle)] last:border-0"
                >
                  <td className="px-5 py-3">
                    <span className="block font-medium text-neutral-900">
                      {account.name}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {account.email}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-neutral-600">
                    {account.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Viewer'}
                  </td>
                  <td className="px-5 py-3">
                    {account.mfaEnabled ? (
                      <Badge variant="success" size="sm">
                        enabled
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        not set up
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-neutral-600">
                    {account.lastLoginAt
                      ? account.lastLoginAt.toISOString().slice(0, 16).replace('T', ' ')
                      : 'never'}
                  </td>
                  <td className="px-5 py-3">
                    {account.lockedUntil && account.lockedUntil > new Date() ? (
                      <Badge variant="danger" size="sm">
                        locked
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        {account.status.toLowerCase()}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Recent sign-in attempts">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <tbody>
              {overview.recentAttempts.map((attempt) => (
                <tr
                  key={attempt.id}
                  className="border-b border-[var(--border-subtle)] last:border-0"
                >
                  <td className="px-5 py-2.5 text-neutral-600">
                    <time dateTime={attempt.createdAt.toISOString()}>
                      {attempt.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
                    </time>
                  </td>
                  <td className="px-5 py-2.5 text-neutral-800">{attempt.email}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-neutral-500">
                    {attempt.ip ?? '—'}
                  </td>
                  <td className="px-5 py-2.5">
                    {attempt.success ? (
                      <Badge variant="success" size="sm">
                        success
                      </Badge>
                    ) : (
                      <Badge variant="danger" size="sm">
                        {attempt.reason ?? 'failed'}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Security events">
        <ul className="divide-y divide-[var(--border-subtle)]">
          {overview.events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3"
            >
              <Badge
                size="sm"
                variant={
                  event.severity === 'critical'
                    ? 'danger'
                    : event.severity === 'warning'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {event.type.toLowerCase().replace(/_/g, ' ')}
              </Badge>
              <span className="text-sm text-neutral-800">{event.message}</span>
              <time
                dateTime={event.createdAt.toISOString()}
                className="ml-auto text-xs text-neutral-500"
              >
                {event.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
              </time>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'warning' | 'success'
}) {
  const colour =
    tone === 'warning'
      ? 'text-warning-700'
      : tone === 'success'
        ? 'text-success-700'
        : 'text-neutral-900'

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-5">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${colour}`}>{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
      <h2 className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-3 text-sm font-semibold text-neutral-900">
        {title}
      </h2>
      {children}
    </section>
  )
}
