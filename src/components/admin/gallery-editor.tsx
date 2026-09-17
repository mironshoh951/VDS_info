'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { MediaPickerDialog } from '@/components/admin/media-picker'
import {
  addGalleryImagesAction,
  listGalleryAction,
  moveGalleryImageAction,
  removeGalleryImageAction,
  setPrimaryImageAction,
} from '@/app/(admin)/admin/(workspace)/gallery-actions'
import type { GalleryItem, GalleryOwner } from '@/lib/gallery'

/**
 * The many-images panel on a content editor.
 *
 * Order is the whole point: the first image is what the catalogue, the search
 * results and the share preview all use, so arranging them is content work
 * rather than decoration. The arrows move an image along the row it is
 * actually displayed in, which is the only mental model that needs no
 * explaining.
 *
 * It saves immediately rather than on the form's Save. A gallery is a list of
 * relations, not a column on the record, and pretending otherwise means
 * silently discarding uploads when someone leaves the page without saving.
 */
export function GalleryEditor({
  owner,
  ownerId,
  canEdit,
}: {
  owner: GalleryOwner
  ownerId: string
  canEdit: boolean
}) {
  const t = useTranslations('admin.gallery')
  const [items, setItems] = useState<GalleryItem[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    void listGalleryAction({ owner, ownerId }).then((outcome) => {
      if (cancelled) return
      if (outcome.ok) setItems(outcome.items ?? [])
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [owner, ownerId])

  const run = (
    work: () => Promise<{ ok: boolean; items?: GalleryItem[]; message?: string }>,
  ) =>
    startTransition(async () => {
      const outcome = await work()
      if (outcome.ok) {
        setItems(outcome.items ?? [])
        setMessage(null)
      } else {
        setMessage(outcome.message ?? t('failed'))
      }
    })

  return (
    <section className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-white p-5">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{t('title')}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">{t('description')}</p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ml-auto"
            disabled={pending}
            onClick={() => setOpen(true)}
          >
            <ImagePlus aria-hidden="true" />
            {t('add')}
          </Button>
        )}
      </header>

      {message && (
        <p role="alert" className="text-danger-700 mb-3 text-sm">
          {message}
        </p>
      )}

      {!loaded ? (
        <p className="py-8 text-center text-sm text-neutral-500">{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-strong)] py-10 text-center text-sm text-neutral-500">
          {t('empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={cn(
                'overflow-hidden rounded-lg border bg-white',
                item.role === 'primary'
                  ? 'border-primary-400 ring-primary-100 ring-2'
                  : 'border-[var(--border-subtle)]',
              )}
            >
              <span className="relative block aspect-4/3 bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnailUrl ?? item.url}
                  alt={item.alt ?? ''}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {item.role === 'primary' && (
                  <span className="bg-primary-600 text-2xs absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 font-medium text-white">
                    {t('primary')}
                  </span>
                )}
              </span>

              <span className="block truncate px-2 pt-2 text-xs text-neutral-700">
                {item.name}
              </span>
              {!item.alt && (
                <span className="text-2xs block px-2 text-amber-700">{t('noAlt')}</span>
              )}

              {canEdit && (
                <span className="flex items-center gap-0.5 px-1.5 py-1.5">
                  <button
                    type="button"
                    aria-label={t('moveLeft')}
                    disabled={pending || index === 0}
                    onClick={() =>
                      run(() =>
                        moveGalleryImageAction({
                          owner,
                          ownerId,
                          id: item.id,
                          direction: 'up',
                        }),
                      )
                    }
                    className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('moveRight')}
                    disabled={pending || index === items.length - 1}
                    onClick={() =>
                      run(() =>
                        moveGalleryImageAction({
                          owner,
                          ownerId,
                          id: item.id,
                          direction: 'down',
                        }),
                      )
                    }
                    className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>

                  {owner === 'product' && item.role !== 'primary' && (
                    <button
                      type="button"
                      aria-label={t('makePrimary')}
                      title={t('makePrimary')}
                      disabled={pending}
                      onClick={() =>
                        run(() => setPrimaryImageAction({ ownerId, id: item.id }))
                      }
                      className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100"
                    >
                      <Star className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label={t('remove')}
                    disabled={pending}
                    onClick={() =>
                      run(() => removeGalleryImageAction({ owner, ownerId, id: item.id }))
                    }
                    className="text-danger-700 hover:bg-danger-50 ml-auto rounded p-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <MediaPickerDialog
          accept="image"
          multiple
          onClose={() => setOpen(false)}
          onPickMany={(picked) => {
            setOpen(false)
            run(() =>
              addGalleryImagesAction({
                owner,
                ownerId,
                assetIds: picked.map((item) => item.id),
              }),
            )
          }}
        />
      )}
    </section>
  )
}
