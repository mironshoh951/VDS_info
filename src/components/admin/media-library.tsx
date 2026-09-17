'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Upload, Trash2, FileText, Film, Music, File as FileIcon, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { AdminPageHeader } from '@/components/admin/page-header'
import { EmptyState } from '@/components/admin/empty-state'
import { StepUpDialog } from '@/components/admin/step-up-dialog'
import { cn } from '@/lib/cn'
import {
  deleteMediaAction,
  updateMediaTextAction,
  uploadMediaAction,
} from '@/app/(admin)/admin/(workspace)/media/actions'
import type { MediaListItem, MediaListResult } from '@/server/modules/media/service'

/**
 * Media library.
 *
 * The grid is the screen; the side panel is where a file becomes usable —
 * alternative text is not decoration, it is the difference between an image
 * that works for a screen reader and one that does not, so the field is the
 * first thing in the panel rather than buried under metadata.
 */

const KIND_ICON = {
  IMAGE: FileIcon,
  VIDEO: Film,
  AUDIO: Music,
  DOCUMENT: FileText,
  OTHER: FileIcon,
} as const

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaLibrary({
  result,
  canUpload,
  canDelete,
  mfaRequired,
  filters,
}: {
  result: MediaListResult
  canUpload: boolean
  canDelete: boolean
  mfaRequired: boolean
  filters: { query: string; kind: string }
}) {
  const t = useTranslations('admin.media')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [selected, setSelected] = useState<MediaListItem | null>(null)
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [stepUpOpen, setStepUpOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const send = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const data = new FormData()
    for (const file of Array.from(files)) data.append('files', file)

    startTransition(async () => {
      const outcome = await uploadMediaAction(data)
      setNotice(
        outcome.failed > 0
          ? t('uploadPartial', { uploaded: outcome.uploaded, failed: outcome.failed })
          : t('uploadDone', { uploaded: outcome.uploaded }),
      )
      router.refresh()
    })
  }

  return (
    <>
      <AdminPageHeader
        title={t('title')}
        description={t('description')}
        actions={
          canUpload ? (
            <Button onClick={() => inputRef.current?.click()} disabled={pending}>
              <Upload aria-hidden="true" />
              {pending ? t('uploading') : t('upload')}
            </Button>
          ) : undefined
        }
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => {
          send(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
      />

      <form method="get" className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={filters.query}
          placeholder={t('searchPlaceholder')}
          className="w-56 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
        />
        <select
          name="kind"
          defaultValue={filters.kind}
          className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
        >
          <option value="">{t('allKinds')}</option>
          <option value="IMAGE">{t('kind.IMAGE')}</option>
          <option value="DOCUMENT">{t('kind.DOCUMENT')}</option>
          <option value="VIDEO">{t('kind.VIDEO')}</option>
          <option value="AUDIO">{t('kind.AUDIO')}</option>
        </select>
        <Button type="submit" variant="secondary">
          {t('filter')}
        </Button>
        <span className="ml-auto text-sm text-neutral-500">
          {t('count', { total: result.total })}
        </span>
      </form>

      {notice && (
        <p className="bg-primary-50 text-primary-900 mb-4 rounded-md px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      {canUpload && (
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            send(event.dataTransfer.files)
          }}
          className={cn(
            'mb-6 rounded-xl border-2 border-dashed px-6 py-8 text-center text-sm transition-colors',
            dragging
              ? 'border-primary-500 bg-primary-50 text-primary-800'
              : 'border-[var(--border-subtle)] text-neutral-500',
          )}
        >
          {t('dropHint')}
        </div>
      )}

      {result.items.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {result.items.map((item) => {
            const Icon = KIND_ICON[item.kind as keyof typeof KIND_ICON] ?? FileIcon
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="group w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  <span
                    className="flex aspect-4/3 items-center justify-center overflow-hidden"
                    style={{ backgroundColor: item.dominantColor ?? '#f5f5f5' }}
                  >
                    {(item.thumbnailUrl ?? (item.kind === 'IMAGE' ? item.url : null)) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl ?? item.url}
                        alt={item.alt ?? ''}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <Icon className="h-8 w-8 text-neutral-400" aria-hidden="true" />
                    )}
                  </span>
                  <span className="block px-2.5 py-2">
                    <span className="block truncate text-xs font-medium text-neutral-800">
                      {item.originalName}
                    </span>
                    <span className="text-2xs block text-neutral-500">
                      {formatSize(item.sizeBytes)}
                      {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                      {!item.alt && item.kind === 'IMAGE' ? ` · ${t('noAlt')}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {selected && (
        <MediaPanel
          key={selected.id}
          item={selected}
          canDelete={canDelete}
          pending={pending}
          onClose={() => setSelected(null)}
          onSave={(values) =>
            startTransition(async () => {
              const outcome = await updateMediaTextAction({
                assetId: selected.id,
                ...values,
              })
              setNotice(outcome.ok ? t('saved') : (outcome.message ?? t('saveFailed')))
              if (outcome.ok) router.refresh()
            })
          }
          onRequestDelete={() => setStepUpOpen(true)}
        />
      )}

      {selected && canDelete && (
        <StepUpDialog
          open={stepUpOpen}
          onOpenChange={setStepUpOpen}
          scope="media.permanent-delete"
          mfaRequired={mfaRequired}
          title={t('deleteTitle')}
          warning={t('deleteWarning', { name: selected.originalName })}
          confirmLabel={t('deleteConfirm')}
          onConfirmed={async (token) => {
            const outcome = await deleteMediaAction({
              assetId: selected.id,
              challengeToken: token,
            })
            setNotice(
              outcome.ok
                ? (outcome.message ?? t('deleted'))
                : (outcome.message ?? t('deleteFailed')),
            )
            setStepUpOpen(false)
            setSelected(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function MediaPanel({
  item,
  canDelete,
  pending,
  onClose,
  onSave,
  onRequestDelete,
}: {
  item: MediaListItem
  canDelete: boolean
  pending: boolean
  onClose: () => void
  onSave: (values: { alt: string; caption: string; title: string }) => void
  onRequestDelete: () => void
}) {
  const t = useTranslations('admin.media')
  const [alt, setAlt] = useState(item.alt ?? '')
  const [caption, setCaption] = useState(item.caption ?? '')
  const [title, setTitle] = useState(item.title ?? '')

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-[var(--border-subtle)] bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <h2 className="truncate text-sm font-semibold text-neutral-900">
          {item.originalName}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {item.kind === 'IMAGE' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl ?? item.url}
            alt={item.alt ?? ''}
            className="mb-4 w-full rounded-lg border border-[var(--border-subtle)] object-contain"
          />
        )}

        <dl className="mb-5 space-y-1 text-xs text-neutral-600">
          <div className="flex justify-between gap-3">
            <dt>{t('type')}</dt>
            <dd className="truncate font-medium text-neutral-800">{item.mimeType}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{t('size')}</dt>
            <dd className="font-medium text-neutral-800">{formatSize(item.sizeBytes)}</dd>
          </div>
          {item.width && item.height && (
            <div className="flex justify-between gap-3">
              <dt>{t('dimensions')}</dt>
              <dd className="font-medium text-neutral-800">
                {item.width}×{item.height}
              </dd>
            </div>
          )}
        </dl>

        <label
          className="mb-1 block text-xs font-medium text-neutral-700"
          htmlFor="media-alt"
        >
          {t('alt')}
        </label>
        <textarea
          id="media-alt"
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          rows={2}
          className="mb-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
        />
        <p className="mb-4 text-xs text-neutral-500">{t('altHint')}</p>

        <label
          className="mb-1 block text-xs font-medium text-neutral-700"
          htmlFor="media-title"
        >
          {t('titleField')}
        </label>
        <input
          id="media-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mb-4 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
        />

        <label
          className="mb-1 block text-xs font-medium text-neutral-700"
          htmlFor="media-caption"
        >
          {t('caption')}
        </label>
        <textarea
          id="media-caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
        />
      </div>

      <footer className="flex items-center gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
        <Button onClick={() => onSave({ alt, caption, title })} disabled={pending}>
          {t('save')}
        </Button>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-700 text-sm hover:underline"
        >
          {t('openOriginal')}
        </a>
        {canDelete && (
          <button
            type="button"
            onClick={onRequestDelete}
            className="text-danger-700 hover:bg-danger-50 ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t('delete')}
          </button>
        )}
      </footer>
    </aside>
  )
}
