'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ImagePlus, Search, Upload, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  browseMediaAction,
  uploadMediaAction,
} from '@/app/(admin)/admin/(workspace)/media/actions'
import type { MediaListItem } from '@/server/modules/media/service'

/**
 * Picks one file from the media library for a content field.
 *
 * The field stores an id, so the component has to resolve that id to something
 * a person recognises before it can show anything — an editor opening a brand
 * should see the logo, not a UUID. That lookup happens once on mount and only
 * when a value is actually set.
 *
 * Uploading is offered inside the picker rather than sending the editor away
 * to the library and back: the moment someone needs an image is the moment
 * they discover they have not uploaded it yet, and losing the half-filled form
 * to go and fix that is how content stops getting entered.
 */
export function MediaPickerField({
  value,
  accept,
  disabled,
  onChange,
}: {
  value: string | null
  accept: 'image' | 'document'
  disabled: boolean
  onChange: (id: string | null) => void
}) {
  const t = useTranslations('admin.mediaPicker')
  const [resolved, setResolved] = useState<MediaListItem | null>(null)
  const [open, setOpen] = useState(false)
  const requestedFor = useRef<string | null>(null)

  // Derived during render rather than synced by an effect. The field's value is
  // the truth; `resolved` is only a cache of what that id looks like. Clearing
  // it from an effect meant an extra render in which the old thumbnail was
  // still on screen next to the new value.
  const selected = resolved && resolved.id === value ? resolved : null

  useEffect(() => {
    if (!value || resolved?.id === value) return
    // An id that resolved to nothing — a deleted asset — must not be requested
    // again on every render, so the attempt is remembered, not just its result.
    if (requestedFor.current === value) return
    requestedFor.current = value

    let cancelled = false
    void browseMediaAction({ ids: [value] }).then((outcome) => {
      if (!cancelled) setResolved(outcome.result?.items[0] ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [value, resolved?.id])

  return (
    <>
      <div className="flex items-center gap-3 rounded-md border border-neutral-300 p-2">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-100">
          {selected?.thumbnailUrl || (selected && selected.kind === 'IMAGE') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.thumbnailUrl ?? selected.url}
              alt={selected.alt ?? ''}
              className="h-full w-full object-cover"
            />
          ) : selected ? (
            <FileText className="h-6 w-6 text-neutral-400" aria-hidden="true" />
          ) : (
            <ImagePlus className="h-6 w-6 text-neutral-300" aria-hidden="true" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-neutral-800">
            {selected ? selected.originalName : t('none')}
          </span>
          {selected && !selected.alt && selected.kind === 'IMAGE' && (
            <span className="text-2xs text-amber-700">{t('missingAlt')}</span>
          )}
        </span>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {selected ? t('replace') : t('choose')}
        </Button>
        {selected && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setResolved(null)
              onChange(null)
            }}
            aria-label={t('clear')}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <MediaPickerDialog
          accept={accept}
          onClose={() => setOpen(false)}
          onPick={(item) => {
            setResolved(item)
            onChange(item.id)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

/**
 * Also used by the gallery editor, which needs several files at once — hence
 * `multiple`. In that mode a click marks a file instead of closing the dialog,
 * and a footer confirms the whole selection: picking twelve product photos one
 * dialog-open at a time is the kind of friction that stops a catalogue from
 * ever being filled in.
 */
export function MediaPickerDialog({
  accept,
  multiple = false,
  onClose,
  onPick,
  onPickMany,
}: {
  accept: 'image' | 'document'
  multiple?: boolean
  onClose: () => void
  onPick?: (item: MediaListItem) => void
  onPickMany?: (items: MediaListItem[]) => void
}) {
  const t = useTranslations('admin.mediaPicker')
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<MediaListItem[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const load = useCallback(
    (search: string) =>
      startTransition(async () => {
        const outcome = await browseMediaAction({
          query: search || undefined,
          kind: accept === 'image' ? 'IMAGE' : undefined,
        })
        if (outcome.ok) setItems(outcome.result?.items ?? [])
        else setMessage(outcome.message ?? t('loadFailed'))
      }),
    [accept, t],
  )

  useEffect(() => {
    load('')
  }, [load])

  // Escape closes the dialog: a picker that can only be dismissed with the
  // mouse traps anyone working from the keyboard.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const upload = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const data = new FormData()
    for (const file of Array.from(files)) data.append('files', file)

    startTransition(async () => {
      const outcome = await uploadMediaAction(data)
      setMessage(
        outcome.failed > 0
          ? (outcome.message ?? t('uploadFailed'))
          : t('uploaded', { uploaded: outcome.uploaded }),
      )
      load(query)
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
        <header className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">{t('title')}</h2>
          <div className="relative ml-auto">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                load(event.target.value)
              }}
              placeholder={t('search')}
              className="w-52 rounded-md border border-[var(--border-subtle)] py-1.5 pr-3 pl-8 text-sm"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden="true" />
            {t('upload')}
          </Button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            upload(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />

        {message && (
          <p className="bg-primary-50 text-primary-900 px-4 py-2 text-sm">{message}</p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-500">
              {pending ? t('loading') : t('empty')}
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={multiple ? picked.includes(item.id) : undefined}
                    onClick={() => {
                      if (multiple) {
                        setPicked((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        )
                      } else {
                        onPick?.(item)
                      }
                    }}
                    className={cn(
                      'group w-full overflow-hidden rounded-lg border bg-white text-left',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
                      multiple && picked.includes(item.id)
                        ? 'border-primary-500 ring-primary-200 ring-2'
                        : 'hover:border-primary-400 border-[var(--border-subtle)]',
                    )}
                  >
                    <span
                      className="flex aspect-square items-center justify-center overflow-hidden"
                      style={{ backgroundColor: item.dominantColor ?? '#f5f5f5' }}
                    >
                      {item.kind === 'IMAGE' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl ?? item.url}
                          alt={item.alt ?? ''}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileText
                          className="h-7 w-7 text-neutral-400"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="text-2xs block truncate px-2 py-1.5 text-neutral-700">
                      {item.originalName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {multiple && (
          <footer className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-4 py-3">
            <span className="text-sm text-neutral-600">
              {t('selected', { count: picked.length })}
            </span>
            <Button
              type="button"
              size="sm"
              className="ml-auto"
              disabled={picked.length === 0}
              onClick={() =>
                onPickMany?.(items.filter((item) => picked.includes(item.id)))
              }
            >
              {t('addSelected')}
            </Button>
          </footer>
        )}
      </div>
    </div>
  )
}
