'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal, UserPlus, AlertCircle, Check } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { StepUpDialog } from './step-up-dialog'
import {
  createUserAction,
  changeRoleAction,
  setStatusAction,
  resetPasswordAction,
  deleteUserAction,
  type UserActionResult,
} from '@/app/(admin)/admin/(workspace)/users/actions'
import type { UserRow } from '@/server/modules/admin/users'
import type { StepUpScope } from '@/server/auth/capabilities'

/**
 * Account list with inline management.
 *
 * Every mutation here is in the step-up set, so the first attempt comes back
 * asking for a password; the dialog supplies a scoped token and the action is
 * retried. That round trip is deliberate — it is the protection.
 */
export function UserTable({
  users,
  canManage,
}: {
  users: UserRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [challenge, setChallenge] = useState<{
    scope: StepUpScope
    mfaRequired: boolean
    title: string
    warning: string
    retry: (token: string) => Promise<UserActionResult>
  } | null>(null)

  const run = (
    attempt: () => Promise<UserActionResult>,
    retry: (token: string) => Promise<UserActionResult>,
    copy: { title: string; warning: string },
    successMessage?: string,
  ) => {
    setError(null)
    setNotice(null)

    startTransition(async () => {
      const result = await attempt()

      if (result.stepUp) {
        setChallenge({ ...result.stepUp, ...copy, retry })
        return
      }
      if (!result.ok) {
        setError(result.message ?? 'Action failed.')
        return
      }
      if (successMessage) setNotice(successMessage)
      router.refresh()
    })
  }

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="border-danger-500/30 bg-danger-50 text-danger-700 mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="border-success-500/30 bg-success-50 text-success-700 mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      {canManage && (
        <div className="mb-4">
          <Button size="sm" onClick={() => setCreating((value) => !value)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {creating ? 'Cancel' : 'New account'}
          </Button>
        </div>
      )}

      {creating && canManage && (
        <CreateUserForm
          pending={pending}
          onSubmit={(values, tokenValue) =>
            run(
              () =>
                createUserAction({
                  ...values,
                  ...(tokenValue ? { challengeToken: tokenValue } : {}),
                }),
              (confirmed) => createUserAction({ ...values, challengeToken: confirmed }),
              {
                title: 'Create this account',
                warning: `A new ${values.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Viewer'} account will be able to sign in immediately.`,
              },
              'Account created.',
            )
          }
          onDone={() => setCreating(false)}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-left">
              <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                Account
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                Role
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                Two-factor
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                Last sign-in
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                State
              </th>
              {canManage && <th scope="col" className="w-12 px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-[var(--border-subtle)] last:border-0"
              >
                <td className="px-4 py-3">
                  <span className="block font-medium text-neutral-900">
                    {user.name}
                    {user.isSelf && (
                      <span className="ml-2 text-xs font-normal text-neutral-500">
                        (you)
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-neutral-500">{user.email}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={user.role === 'SUPER_ADMIN' ? 'brand' : 'neutral'}
                    size="sm"
                  >
                    {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Viewer'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {user.mfaEnabled ? (
                    <Badge variant="success" size="sm">
                      enabled
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      not set up
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt)
                        .toISOString()
                        .slice(0, 16)
                        .replace('T', ' ')
                    : 'never'}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={user.status === 'ACTIVE' ? 'success' : 'danger'}
                    size="sm"
                  >
                    {user.status.toLowerCase()}
                  </Badge>
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger
                        disabled={pending}
                        aria-label={`Actions for ${user.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </DropdownMenu.Trigger>

                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          align="end"
                          className="z-50 min-w-56 rounded-lg border border-[var(--border-subtle)] bg-white p-1.5 shadow-lg"
                        >
                          {!user.isSelf && (
                            <DropdownMenu.Item
                              className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-neutral-700 outline-none data-highlighted:bg-neutral-100"
                              onSelect={() => {
                                const nextRole =
                                  user.role === 'SUPER_ADMIN' ? 'VIEWER' : 'SUPER_ADMIN'
                                run(
                                  () =>
                                    changeRoleAction({ userId: user.id, role: nextRole }),
                                  (t) =>
                                    changeRoleAction({
                                      userId: user.id,
                                      role: nextRole,
                                      challengeToken: t,
                                    }),
                                  {
                                    title: 'Change this role',
                                    warning:
                                      nextRole === 'SUPER_ADMIN'
                                        ? `${user.name} will gain full access to every part of the system.`
                                        : `${user.name} will lose the ability to change anything.`,
                                  },
                                  'Role changed. Their open sessions were ended.',
                                )
                              }}
                            >
                              Make{' '}
                              {user.role === 'SUPER_ADMIN' ? 'Viewer' : 'Super Admin'}
                            </DropdownMenu.Item>
                          )}

                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-neutral-700 outline-none data-highlighted:bg-neutral-100"
                            onSelect={() => {
                              const password = window.prompt(
                                `Set a new password for ${user.name} (at least 12 characters):`,
                              )
                              if (!password) return
                              run(
                                () => resetPasswordAction({ userId: user.id, password }),
                                (t) =>
                                  resetPasswordAction({
                                    userId: user.id,
                                    password,
                                    challengeToken: t,
                                  }),
                                {
                                  title: 'Reset this password',
                                  warning: `${user.name} will be signed out everywhere and must use the new password.`,
                                },
                                'Password reset. All their sessions were ended.',
                              )
                            }}
                          >
                            Reset password
                          </DropdownMenu.Item>

                          {!user.isSelf && (
                            <>
                              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-neutral-700 outline-none data-highlighted:bg-neutral-100"
                                onSelect={() => {
                                  const next =
                                    user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
                                  run(
                                    () =>
                                      setStatusAction({ userId: user.id, status: next }),
                                    (t) =>
                                      setStatusAction({
                                        userId: user.id,
                                        status: next,
                                        challengeToken: t,
                                      }),
                                    {
                                      title:
                                        next === 'ACTIVE'
                                          ? 'Reactivate account'
                                          : 'Suspend account',
                                      warning:
                                        next === 'ACTIVE'
                                          ? `${user.name} will be able to sign in again.`
                                          : `${user.name} will be signed out and unable to sign in.`,
                                    },
                                  )
                                }}
                              >
                                {user.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                className="text-danger-700 data-highlighted:bg-danger-50 flex cursor-pointer items-center rounded-md px-3 py-2 text-sm outline-none"
                                onSelect={() =>
                                  run(
                                    () => deleteUserAction({ userId: user.id }),
                                    (t) =>
                                      deleteUserAction({
                                        userId: user.id,
                                        challengeToken: t,
                                      }),
                                    {
                                      title: 'Delete this account',
                                      warning: `${user.name} will lose access immediately. Their audit history is kept.`,
                                    },
                                    'Account deleted.',
                                  )
                                }
                              >
                                Delete account
                              </DropdownMenu.Item>
                            </>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
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
          title={challenge.title}
          warning={challenge.warning}
          confirmLabel="Confirm"
          onConfirmed={async (tokenValue) => {
            const retry = challenge.retry
            setChallenge(null)
            const result = await retry(tokenValue)
            if (!result.ok) setError(result.message ?? 'Action failed.')
            else router.refresh()
          }}
        />
      )}
    </div>
  )
}

function CreateUserForm({
  pending,
  onSubmit,
  onDone,
}: {
  pending: boolean
  onSubmit: (
    values: {
      name: string
      email: string
      password: string
      role: 'SUPER_ADMIN' | 'VIEWER'
    },
    token?: string,
  ) => void
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'SUPER_ADMIN' | 'VIEWER'>('VIEWER')

  return (
    <form
      className="mb-6 grid gap-4 rounded-xl border border-[var(--border-subtle)] bg-white p-5 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ name, email, password, role })
        onDone()
      }}
    >
      <div>
        <label
          htmlFor="new-user-name"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Name
        </label>
        <input
          id="new-user-name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11 w-full rounded-md border border-neutral-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        />
      </div>

      <div>
        <label
          htmlFor="new-user-email"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Email
        </label>
        <input
          id="new-user-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 w-full rounded-md border border-neutral-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        />
      </div>

      <div>
        <label
          htmlFor="new-user-password"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Temporary password
        </label>
        <input
          id="new-user-password"
          type="text"
          required
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 w-full rounded-md border border-neutral-300 px-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        />
        <p className="mt-1 text-xs text-neutral-500">
          At least 12 characters. They will be asked to change it.
        </p>
      </div>

      <div>
        <label
          htmlFor="new-user-role"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Role
        </label>
        <select
          id="new-user-role"
          value={role}
          onChange={(event) => setRole(event.target.value as 'SUPER_ADMIN' | 'VIEWER')}
          className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <option value="VIEWER">Viewer — read-only</option>
          <option value="SUPER_ADMIN">Super Admin — full access</option>
        </select>
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Create account
        </Button>
      </div>
    </form>
  )
}
