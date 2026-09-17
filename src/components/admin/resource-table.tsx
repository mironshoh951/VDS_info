'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  MoreHorizontal,
  Star,
  Eye,
  EyeOff,
  Archive,
  Trash2,
  RotateCcw,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import { StatusBadge, TranslationDots } from './status-badge'
import { StepUpDialog } from './step-up-dialog'
import { ConfirmDialog } from './confirm-dialog'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  changeStatusAction,
  toggleFeaturedAction,
  trashAction,
  restoreAction,
  permanentDeleteAction,
  bulkAction,
} from '@/app/(admin)/admin/(workspace)/content-actions'
import type { AdminRow } from '@/server/modules/admin/lists'
import type { StepUpScope } from '@/server/auth/capabilities'

/**
 * The list table shared by every content type.
 *
 * Bulk selection, row actions and confirmation flows are implemented once
 * here. Every mutation goes through a server action that re-checks the
 * caller's capability — the `canEdit` prop only decides what is drawn.
 */
export function ResourceTable({
  resource,
  rows,
  locales,
  canEdit,
  canDelete,
  canPermanentDelete,
  editHrefBase,
  publicHrefBase,
  trashed = false,
}: {
  resource: string
  rows: AdminRow[]
  locales: readonly string[]
  canEdit: boolean
  canDelete: boolean
  canPermanentDelete: boolean
  editHrefBase: string
  publicHrefBase: string | null
  trashed?: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [stepUp, setStepUp] = useState<{
    scope: StepUpScope
    mfaRequired: boolean
    run: (token: string) => Promise<void>
    title: string
    warning: string
  } | null>(null)

  const [confirm, setConfirm] = useState<{
    title: string
    description: string
    confirmLabel: string
    destructive: boolean
    run: () => Promise<void>
  } | null>(null)

  const allSelected = rows.length > 0 && selected.size === rows.length

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))
  }

  const toggleOne = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Runs an action and, if it asks for password confirmation, opens the dialog. */
  const run = (
    action: () => Promise<{
      ok: boolean
      message?: string
      stepUp?: { scope: StepUpScope; mfaRequired: boolean }
    }>,
    retryWithToken?: (token: string) => Promise<{ ok: boolean; message?: string }>,
    dialogCopy?: { title: string; warning: string },
  ) => {
    setError(null)
    startTransition(async () => {
      const result = await action()

      if (result.stepUp && retryWithToken) {
        setStepUp({
          scope: result.stepUp.scope,
          mfaRequired: result.stepUp.mfaRequired,
          title: dialogCopy?.title ?? 'Confirm this action',
          warning: dialogCopy?.warning ?? 'This action cannot be undone.',
          run: async (token) => {
            const retried = await retryWithToken(token)
            if (!retried.ok) setError(retried.message ?? 'Action failed.')
            else router.refresh()
          },
        })
        return
      }

      if (!result.ok) {
        setError(result.message ?? 'Action failed.')
        return
      }

      setSelected(new Set())
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

      {canEdit && selected.size > 0 && !trashed && (
        <div className="border-primary-200 bg-primary-50 mb-4 flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3">
          <span className="text-primary-900 text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(() =>
                  bulkAction({ resource, ids: [...selected], operation: 'publish' }),
                )
              }
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(() =>
                  bulkAction({ resource, ids: [...selected], operation: 'unpublish' }),
                )
              }
            >
              Unpublish
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(() =>
                  bulkAction({ resource, ids: [...selected], operation: 'archive' }),
                )
              }
            >
              Archive
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="danger"
                disabled={pending}
                onClick={() =>
                  setConfirm({
                    title: `Move ${selected.size} item(s) to trash?`,
                    description:
                      'They will be unpublished and hidden from the site. You can restore them from the trash.',
                    confirmLabel: 'Move to trash',
                    destructive: true,
                    run: async () => {
                      setConfirm(null)
                      run(() =>
                        bulkAction({ resource, ids: [...selected], operation: 'delete' }),
                      )
                    },
                  })
                }
              >
                Move to trash
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-left">
              {canEdit && !trashed && (
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                    className="text-primary-600 h-4 w-4 rounded border-neutral-300"
                  />
                </th>
              )}
              <th scope="col" className="px-4 py-3 font-medium text-neutral-600">
                Title
              </th>
              <th scope="col" className="w-28 px-4 py-3 font-medium text-neutral-600">
                Status
              </th>
              <th scope="col" className="w-28 px-4 py-3 font-medium text-neutral-600">
                Languages
              </th>
              <th scope="col" className="w-32 px-4 py-3 font-medium text-neutral-600">
                Updated
              </th>
              <th scope="col" className="w-12 px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-[var(--border-subtle)] last:border-0',
                  selected.has(row.id) && 'bg-primary-50/40',
                )}
              >
                {canEdit && !trashed && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.title}`}
                      className="text-primary-600 h-4 w-4 rounded border-neutral-300"
                    />
                  </td>
                )}

                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.featured && (
                      <Star
                        className="fill-accent-400 text-accent-500 h-3.5 w-3.5 shrink-0"
                        aria-label="Featured"
                      />
                    )}
                    <Link
                      href={`${editHrefBase}/${row.id}`}
                      className="hover:text-primary-800 font-medium text-neutral-900 hover:underline"
                    >
                      {row.title}
                    </Link>
                  </div>
                  <p className="text-2xs mt-0.5 font-mono text-neutral-400">{row.slug}</p>
                </td>

                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>

                <td className="px-4 py-3">
                  <TranslationDots translations={row.translations} locales={locales} />
                </td>

                <td className="px-4 py-3 text-neutral-600">
                  <time dateTime={new Date(row.updatedAt).toISOString()}>
                    {new Date(row.updatedAt).toISOString().slice(0, 10)}
                  </time>
                </td>

                <td className="px-4 py-3 text-right">
                  <RowMenu
                    row={row}
                    resource={resource}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canPermanentDelete={canPermanentDelete}
                    editHrefBase={editHrefBase}
                    publicHrefBase={publicHrefBase}
                    trashed={trashed}
                    pending={pending}
                    onAction={run}
                    onConfirm={setConfirm}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stepUp && (
        <StepUpDialog
          open
          onOpenChange={(next) => {
            if (!next) setStepUp(null)
          }}
          scope={stepUp.scope}
          mfaRequired={stepUp.mfaRequired}
          title={stepUp.title}
          warning={stepUp.warning}
          confirmLabel="Delete permanently"
          onConfirmed={async (token) => {
            await stepUp.run(token)
            setStepUp(null)
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) setConfirm(null)
          }}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          destructive={confirm.destructive}
          onConfirm={confirm.run}
        />
      )}
    </div>
  )
}

type RunFn = (
  action: () => Promise<{
    ok: boolean
    message?: string
    stepUp?: { scope: StepUpScope; mfaRequired: boolean }
  }>,
  retryWithToken?: (token: string) => Promise<{ ok: boolean; message?: string }>,
  dialogCopy?: { title: string; warning: string },
) => void

function RowMenu({
  row,
  resource,
  canEdit,
  canDelete,
  canPermanentDelete,
  editHrefBase,
  publicHrefBase,
  trashed,
  pending,
  onAction,
  onConfirm,
}: {
  row: AdminRow
  resource: string
  canEdit: boolean
  canDelete: boolean
  canPermanentDelete: boolean
  editHrefBase: string
  publicHrefBase: string | null
  trashed: boolean
  pending: boolean
  onAction: RunFn
  onConfirm: (
    value: {
      title: string
      description: string
      confirmLabel: string
      destructive: boolean
      run: () => Promise<void>
    } | null,
  ) => void
}) {
  const itemClass =
    'flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-neutral-100'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        aria-label={`Actions for ${row.title}`}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-52 rounded-lg border border-[var(--border-subtle)] bg-white p-1.5 shadow-lg"
        >
          {!trashed && (
            <DropdownMenu.Item asChild>
              <Link
                href={`${editHrefBase}/${row.id}`}
                className={`${itemClass} text-neutral-700`}
              >
                Edit
              </Link>
            </DropdownMenu.Item>
          )}

          {publicHrefBase && row.status === 'PUBLISHED' && !trashed && (
            <DropdownMenu.Item asChild>
              <a
                href={`${publicHrefBase}/${row.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${itemClass} text-neutral-700`}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                View on site
              </a>
            </DropdownMenu.Item>
          )}

          {canEdit && !trashed && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />

              {row.status !== 'PUBLISHED' ? (
                <DropdownMenu.Item
                  className={`${itemClass} text-neutral-700`}
                  onSelect={() =>
                    onAction(() =>
                      changeStatusAction({ resource, id: row.id, status: 'PUBLISHED' }),
                    )
                  }
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Publish
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item
                  className={`${itemClass} text-neutral-700`}
                  onSelect={() =>
                    onAction(() =>
                      changeStatusAction({ resource, id: row.id, status: 'DRAFT' }),
                    )
                  }
                >
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                  Unpublish
                </DropdownMenu.Item>
              )}

              <DropdownMenu.Item
                className={`${itemClass} text-neutral-700`}
                onSelect={() =>
                  onAction(() =>
                    toggleFeaturedAction({
                      resource,
                      id: row.id,
                      featured: !row.featured,
                    }),
                  )
                }
              >
                <Star className="h-4 w-4" aria-hidden="true" />
                {row.featured ? 'Remove from featured' : 'Mark as featured'}
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className={`${itemClass} text-neutral-700`}
                onSelect={() =>
                  onAction(() =>
                    changeStatusAction({ resource, id: row.id, status: 'ARCHIVED' }),
                  )
                }
              >
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive
              </DropdownMenu.Item>
            </>
          )}

          {canDelete && !trashed && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
              <DropdownMenu.Item
                className={`${itemClass} text-danger-700 data-highlighted:bg-danger-50`}
                onSelect={() =>
                  onConfirm({
                    title: 'Move to trash?',
                    description: `“${row.title}” will be unpublished and hidden from the site. You can restore it from the trash.`,
                    confirmLabel: 'Move to trash',
                    destructive: true,
                    run: async () => {
                      onConfirm(null)
                      onAction(() => trashAction({ resource, id: row.id }))
                    },
                  })
                }
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Move to trash
              </DropdownMenu.Item>
            </>
          )}

          {trashed && (
            <>
              <DropdownMenu.Item
                className={`${itemClass} text-neutral-700`}
                onSelect={() => onAction(() => restoreAction({ resource, id: row.id }))}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Restore as draft
              </DropdownMenu.Item>

              {canPermanentDelete && (
                <>
                  <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
                  <DropdownMenu.Item
                    className={`${itemClass} text-danger-700 data-highlighted:bg-danger-50`}
                    onSelect={() =>
                      onAction(
                        () => permanentDeleteAction({ resource, id: row.id }),
                        (token) =>
                          permanentDeleteAction({
                            resource,
                            id: row.id,
                            challengeToken: token,
                          }),
                        {
                          title: 'Delete permanently',
                          warning: `“${row.title}” and everything attached to it will be destroyed. This cannot be undone.`,
                        },
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete permanently
                  </DropdownMenu.Item>
                </>
              )}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
