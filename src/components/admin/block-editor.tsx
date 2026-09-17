'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { DEFAULT_LOCALE, LOCALE_ORDER } from '@/i18n/config'
import {
  BLOCK_DEFINITIONS,
  blockDefinition,
  type BlockField,
  type EditorBlock,
} from '@/lib/blocks'
import { plainTextDocument, richTextToPlainText } from '@/lib/rich-text'
import { MediaPickerField, MediaPickerDialog } from '@/components/admin/media-picker'
import {
  addBlockAction,
  listBlocksAction,
  moveBlockAction,
  removeBlockAction,
  saveBlockAction,
  setBlockEnabledAction,
  type BlockActionResult,
} from '@/app/(admin)/admin/(workspace)/block-actions'

/**
 * The page block editor (§32).
 *
 * A page is a stack of sections, so the editor is a stack too: each block is a
 * collapsed row you can move, hide or open. Deliberately not a drag-and-drop
 * canvas — sections are full-width and ordered, so there is nothing to drag
 * them *to* except up or down, and two buttons do that with a keyboard, on a
 * phone, and with a screen reader, which dragging does not.
 *
 * Hiding rather than deleting is offered first because taking a section off the
 * live site for a week is the common case, and it is the one that a delete
 * would make expensive to undo.
 *
 * Each block saves on its own. Blocks are rows, not fields on the page, and
 * folding them into the page's Save would mean an editor who arranged six
 * sections and navigated away lost the arrangement.
 */
export function BlockEditor({ pageId, canEdit }: { pageId: string; canEdit: boolean }) {
  const t = useTranslations('admin.blocks')
  const [blocks, setBlocks] = useState<EditorBlock[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    void listBlocksAction({ pageId }).then((outcome) => {
      if (cancelled) return
      if (outcome.ok) setBlocks(outcome.blocks ?? [])
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [pageId])

  const run = (work: () => Promise<BlockActionResult>) =>
    startTransition(async () => {
      const outcome = await work()
      if (outcome.ok) {
        setBlocks(outcome.blocks ?? [])
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
          <div className="ml-auto flex items-center gap-2">
            <select
              value={adding}
              disabled={pending}
              onChange={(event) => setAdding(event.target.value)}
              aria-label={t('addLabel')}
              className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-700"
            >
              <option value="">{t('addLabel')}</option>
              {BLOCK_DEFINITIONS.map((definition) => (
                <option key={definition.type} value={definition.type}>
                  {t(`types.${definition.type}`)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending || !adding}
              onClick={() =>
                run(async () => {
                  const outcome = await addBlockAction({ pageId, type: adding })
                  if (outcome.ok) setAdding('')
                  return outcome
                })
              }
            >
              <Plus aria-hidden="true" />
              {t('add')}
            </Button>
          </div>
        )}
      </header>

      {message && (
        <p role="alert" className="text-danger-700 mb-3 text-sm">
          {message}
        </p>
      )}

      {!loaded ? (
        <p className="text-sm text-neutral-500">{t('loading')}</p>
      ) : blocks.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('empty')}</p>
      ) : (
        <ol className="space-y-2">
          {blocks.map((block, index) => (
            <li
              key={block.id}
              className={cn(
                'rounded-lg border border-[var(--border-subtle)]',
                !block.enabled && 'opacity-60',
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setOpenId(openId === block.id ? null : block.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={openId === block.id}
                >
                  {openId === block.id ? (
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate text-sm font-medium text-neutral-900">
                    {t(`types.${block.type}`)}
                  </span>
                  {block.anchor && (
                    <code className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-500">
                      #{block.anchor}
                    </code>
                  )}
                  {!block.enabled && (
                    <span className="text-warning-700 shrink-0 text-xs">
                      {t('hidden')}
                    </span>
                  )}
                </button>

                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      label={t('moveUp')}
                      disabled={pending || index === 0}
                      onClick={() =>
                        run(() =>
                          moveBlockAction({ pageId, id: block.id, direction: 'up' }),
                        )
                      }
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={t('moveDown')}
                      disabled={pending || index === blocks.length - 1}
                      onClick={() =>
                        run(() =>
                          moveBlockAction({ pageId, id: block.id, direction: 'down' }),
                        )
                      }
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={block.enabled ? t('hide') : t('show')}
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          setBlockEnabledAction({
                            pageId,
                            id: block.id,
                            enabled: !block.enabled,
                          }),
                        )
                      }
                    >
                      {block.enabled ? (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      )}
                    </IconButton>
                    <IconButton
                      label={t('remove')}
                      danger
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(t('confirmRemove'))) return
                        run(() => removeBlockAction({ pageId, id: block.id }))
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                )}
              </div>

              {openId === block.id && (
                <BlockForm
                  pageId={pageId}
                  block={block}
                  canEdit={canEdit}
                  onSaved={(next) => setBlocks(next)}
                  onError={(text) => setMessage(text)}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function IconButton({
  label,
  danger = false,
  disabled,
  onClick,
  children,
}: {
  label: string
  danger?: boolean
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md p-1.5 hover:bg-neutral-100 disabled:opacity-40',
        danger ? 'text-danger-700' : 'text-neutral-500',
      )}
    >
      {children}
    </button>
  )
}

/** Source language first — it is the one that has to be filled in. */
const LOCALE_TABS = LOCALE_ORDER

/**
 * One block's fields.
 *
 * Config sits above the language tabs and text inside them, which is the whole
 * locale split made visible: an editor can see at a glance that changing the
 * limit affects every language and changing the heading affects one.
 */
function BlockForm({
  pageId,
  block,
  canEdit,
  onSaved,
  onError,
}: {
  pageId: string
  block: EditorBlock
  canEdit: boolean
  onSaved: (blocks: EditorBlock[]) => void
  onError: (message: string) => void
}) {
  const t = useTranslations('admin.blocks')
  const [config, setConfig] = useState<Record<string, unknown>>(block.config)
  const [text, setText] = useState<Record<string, Record<string, unknown>>>(block.text)
  const [anchor, setAnchor] = useState(block.anchor ?? '')
  const [locale, setLocale] = useState<string>(DEFAULT_LOCALE)
  const [pending, startTransition] = useTransition()

  const definition = blockDefinition(block.type)
  if (!definition) {
    return (
      <p className="text-warning-700 border-t border-[var(--border-subtle)] px-4 py-3 text-sm">
        {t('unknownType', { type: block.type })}
      </p>
    )
  }

  const configFields = definition.fields.filter((field) => !field.localized)
  const textFields = definition.fields.filter((field) => field.localized)

  return (
    <div className="space-y-5 border-t border-[var(--border-subtle)] px-4 py-4">
      {definition.dataDriven && (
        <p className="text-xs text-neutral-500">{t('dataDriven')}</p>
      )}

      {configFields.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {configFields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              label={t(`fields.${field.name}`)}
              value={config[field.name]}
              disabled={!canEdit || pending}
              onChange={(value) =>
                setConfig((prev) => ({ ...prev, [field.name]: value }))
              }
            />
          ))}
        </div>
      )}

      <div>
        <label
          htmlFor={`anchor-${block.id}`}
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          {t('fields.anchor')}
        </label>
        <input
          id={`anchor-${block.id}`}
          value={anchor}
          disabled={!canEdit || pending}
          placeholder={t('anchorHint')}
          onChange={(event) => setAnchor(event.target.value)}
          className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm sm:max-w-xs"
        />
      </div>

      {textFields.length > 0 && (
        <div>
          <div
            role="tablist"
            aria-label={t('languages')}
            className="mb-3 flex gap-1 border-b border-[var(--border-subtle)]"
          >
            {LOCALE_TABS.map((code) => (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={locale === code}
                onClick={() => setLocale(code)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-1.5 text-sm',
                  locale === code
                    ? 'border-primary-600 text-primary-800 font-medium'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800',
                )}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {textFields.map((field) => (
              <FieldInput
                key={`${locale}-${field.name}`}
                field={field}
                label={t(`fields.${field.name}`)}
                value={text[locale]?.[field.name]}
                disabled={!canEdit || pending}
                onChange={(value) =>
                  setText((prev) => ({
                    ...prev,
                    [locale]: { ...(prev[locale] ?? {}), [field.name]: value },
                  }))
                }
              />
            ))}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const outcome = await saveBlockAction({
                  pageId,
                  id: block.id,
                  anchor: anchor.trim() ? anchor.trim() : null,
                  config,
                  text,
                })
                if (outcome.ok) onSaved(outcome.blocks ?? [])
                else onError(outcome.message ?? t('failed'))
              })
            }
          >
            {pending ? t('saving') : t('save')}
          </Button>
          <span className="text-xs text-neutral-500">{t('saveHint')}</span>
        </div>
      )}
    </div>
  )
}

/** Fields whose meaning is not obvious from the label alone. */
const HELP_FOR: Record<string, string> = {
  focalX: 'focal',
  focalY: 'focal',
  videoUrl: 'video',
  mobileImageId: 'mobileImage',
  overlayStrength: 'overlay',
}

function FieldInput({
  field,
  label,
  value,
  disabled,
  onChange,
}: {
  field: BlockField
  label: string
  value: unknown
  disabled: boolean
  onChange: (value: unknown) => void
}) {
  const t = useTranslations('admin.blocks')
  const id = `block-field-${field.name}`
  const base =
    'w-full rounded-md border border-neutral-300 px-3 text-sm disabled:bg-neutral-50'

  return (
    <div
      className={
        field.kind === 'items' || field.kind === 'richText' ? 'sm:col-span-2' : ''
      }
    >
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>

      {/* Only where the setting genuinely needs explaining. A hint under every
          field is a hint nobody reads. */}
      {HELP_FOR[field.name] && (
        <p className="mb-2 text-xs leading-relaxed text-neutral-500">
          {t(`help.${HELP_FOR[field.name]}`)}
        </p>
      )}

      {field.kind === 'select' ? (
        <select
          id={id}
          value={typeof value === 'string' ? value : (field.options?.[0] ?? '')}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cn(base, 'h-10 bg-white')}
        >
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {t(`options.${option}`)}
            </option>
          ))}
        </select>
      ) : field.kind === 'number' ? (
        <input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          value={typeof value === 'number' ? value : ''}
          disabled={disabled}
          onChange={(event) =>
            onChange(event.target.value === '' ? undefined : Number(event.target.value))
          }
          className={cn(base, 'h-10 sm:max-w-32')}
        />
      ) : field.kind === 'textarea' ? (
        <textarea
          id={id}
          rows={3}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cn(base, 'py-2 leading-relaxed')}
        />
      ) : field.kind === 'richText' ? (
        <textarea
          id={id}
          rows={10}
          // Stored as a structured document, edited as paragraphs. The
          // round-trip is lossy for anything richer than paragraphs, so it is
          // only offered where the block has no other body field.
          value={richTextToPlainText(value)}
          disabled={disabled}
          placeholder={t('richTextHint')}
          onChange={(event) =>
            onChange(
              event.target.value.trim()
                ? plainTextDocument(event.target.value)
                : undefined,
            )
          }
          className={cn(base, 'py-2 leading-relaxed')}
        />
      ) : field.kind === 'media' ? (
        <MediaPickerField
          value={typeof value === 'string' ? value : null}
          accept="image"
          disabled={disabled}
          onChange={(id) => onChange(id ?? undefined)}
        />
      ) : field.kind === 'mediaList' ? (
        <MediaListInput value={value} disabled={disabled} onChange={onChange} />
      ) : field.kind === 'items' ? (
        <ItemsInput
          value={value}
          disabled={disabled}
          fields={field.itemFields ?? []}
          onChange={onChange}
        />
      ) : (
        <input
          id={id}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cn(base, 'h-10')}
        />
      )}
    </div>
  )
}

/**
 * A short repeating list — statistics, at present.
 *
 * Edited as one line per entry with the sub-fields separated by a pipe, rather
 * than as a grid of add/remove rows. For two columns and a handful of entries
 * that is faster to type, trivially reorderable, and pasteable from a
 * spreadsheet; a row-builder would be more chrome than content.
 */
function ItemsInput({
  value,
  fields,
  disabled,
  onChange,
}: {
  value: unknown
  fields: readonly string[]
  disabled: boolean
  onChange: (value: unknown) => void
}) {
  const t = useTranslations('admin.blocks')

  const rows = Array.isArray(value)
    ? value
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && !Array.isArray(item),
        )
        .map((item) =>
          fields
            .map((name) => (typeof item[name] === 'string' ? item[name] : ''))
            .join(' | '),
        )
        .join('\n')
    : ''

  return (
    <>
      <textarea
        rows={5}
        value={rows}
        disabled={disabled}
        placeholder={fields.join(' | ')}
        onChange={(event) => {
          const parsed = event.target.value
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const parts = line.split('|').map((part) => part.trim())
              return Object.fromEntries(
                fields.map((name, index) => [name, parts[index] ?? '']),
              )
            })
          onChange(parsed.length > 0 ? parsed : undefined)
        }}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm leading-relaxed disabled:bg-neutral-50"
      />
      <p className="mt-1 text-xs text-neutral-500">
        {t('itemsHint', { fields: fields.join(' | ') })}
      </p>
    </>
  )
}

/**
 * An ordered set of images.
 *
 * Order is the content decision here — the first picture is the one a visitor
 * sees largest — so the control is a row of thumbnails with move and remove,
 * not a file input. Reusing the media picker's dialog means images are chosen
 * from what has already been uploaded and described, rather than uploaded
 * again under a second name.
 */
function MediaListInput({
  value,
  disabled,
  onChange,
}: {
  value: unknown
  disabled: boolean
  onChange: (value: unknown) => void
}) {
  const t = useTranslations('admin.blocks')
  const [open, setOpen] = useState(false)

  const ids = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []

  const commit = (next: string[]) => onChange(next.length > 0 ? next : undefined)

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    const next = [...ids]
    const moved = next[index]!
    next[index] = next[target]!
    next[target] = moved
    commit(next)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {ids.map((id, index) => (
          <div
            key={id}
            className="flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1"
          >
            <span className="font-mono text-xs text-neutral-500">{index + 1}</span>
            <IconButton
              label={t('moveUp')}
              disabled={disabled || index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
            <IconButton
              label={t('moveDown')}
              disabled={disabled || index === ids.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
            <IconButton
              label={t('remove')}
              danger
              disabled={disabled}
              onClick={() => commit(ids.filter((entry) => entry !== id))}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <ImagePlus aria-hidden="true" />
          {t('addImages')}
        </Button>
      </div>

      {ids.length === 0 && (
        <p className="mt-1 text-xs text-neutral-500">{t('noImages')}</p>
      )}

      {open && (
        <MediaPickerDialog
          accept="image"
          multiple
          onClose={() => setOpen(false)}
          onPickMany={(items) => {
            // Appended, and de-duplicated: choosing the same picture twice is
            // a mis-click, not an instruction to show it twice.
            const additions = items
              .map((item) => item.id)
              .filter((id) => !ids.includes(id))
            commit([...ids, ...additions])
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
