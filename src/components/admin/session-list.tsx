'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { StepUpDialog } from './step-up-dialog'
import { revokeSessionAction } from '@/app/(admin)/admin/(workspace)/security/actions'
import type { SessionRow } from '@/server/modules/admin/security-centre'
import type { StepUpScope } from '@/server/auth/capabilities'

/** Active sessions with the ability to revoke one (§65). */
export function SessionList({
  sessions,
  canRevoke,
}: {
  sessions: SessionRow[]
  canRevoke: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<{
    sessionId: string
    scope: StepUpScope
    mfaRequired: boolean
  } | null>(null)

  const revoke = (sessionId: string, token?: string) => {
    setError(null)
    startTransition(async () => {
      const result = await revokeSessionAction({
        sessionId,
        ...(token ? { challengeToken: token } : {}),
      })

      if (result.stepUp) {
        setChallenge({
          sessionId,
          scope: result.stepUp.scope,
          mfaRequired: result.stepUp.mfaRequired,
        })
        return
      }
      if (!result.ok) {
        setError(result.message ?? 'Could not revoke the session.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="border-danger-500/30 bg-danger-50 text-danger-700 mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-left">
              <th scope="col" className="px-5 py-2.5 font-medium text-neutral-600">
                Account
              </th>
              <th scope="col" className="px-5 py-2.5 font-medium text-neutral-600">
                Host
              </th>
              <th scope="col" className="px-5 py-2.5 font-medium text-neutral-600">
                Address
              </th>
              <th scope="col" className="px-5 py-2.5 font-medium text-neutral-600">
                Last seen
              </th>
              {canRevoke && <th scope="col" className="w-24 px-5 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr
                key={session.id}
                className="border-b border-[var(--border-subtle)] last:border-0"
              >
                <td className="px-5 py-3">
                  <span className="block font-medium text-neutral-900">
                    {session.userName}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {session.userEmail}
                  </span>
                  <span className="mt-1 flex gap-1.5">
                    {session.isCurrent && (
                      <Badge variant="brand" size="sm">
                        this device
                      </Badge>
                    )}
                    {!session.mfaSatisfied && (
                      <Badge variant="warning" size="sm">
                        MFA pending
                      </Badge>
                    )}
                  </span>
                </td>
                <td className="px-5 py-3 text-neutral-600">{session.host}</td>
                <td className="px-5 py-3">
                  <span className="block font-mono text-xs text-neutral-700">
                    {session.ip ?? '—'}
                  </span>
                  <span className="text-2xs block max-w-[18rem] truncate text-neutral-400">
                    {session.userAgent ?? ''}
                  </span>
                </td>
                <td className="px-5 py-3 text-neutral-600">
                  <time dateTime={new Date(session.lastSeenAt).toISOString()}>
                    {new Date(session.lastSeenAt)
                      .toISOString()
                      .slice(0, 16)
                      .replace('T', ' ')}
                  </time>
                </td>
                {canRevoke && (
                  <td className="px-5 py-3 text-right">
                    {!session.isCurrent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => revoke(session.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {challenge && (
        <StepUpDialog
          open
          onOpenChange={(next) => {
            if (!next) setChallenge(null)
          }}
          scope={challenge.scope}
          mfaRequired={challenge.mfaRequired}
          title="Revoke this session"
          warning="The person using it will be signed out immediately."
          confirmLabel="Revoke session"
          onConfirmed={(token) => {
            const id = challenge.sessionId
            setChallenge(null)
            revoke(id, token)
          }}
        />
      )}
    </div>
  )
}
