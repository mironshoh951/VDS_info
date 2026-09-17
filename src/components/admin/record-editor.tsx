'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Save } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useTranslations } from 'next-intl'
import { MediaPickerField } from '@/components/admin/media-picker'
import { GalleryEditor } from '@/components/admin/gallery-editor'
import { BlockEditor } from '@/components/admin/block-editor'
import { TranslatePanel } from '@/components/admin/translate-panel'
import { isGalleryOwner } from '@/lib/gallery'
import { saveRecordAction } from '@/app/(admin)/admin/(workspace)/editor-actions'
import type { FieldSpec, ResourceFormSchema } from '@/server/modules/admin/form-schema'
import type { EditorRecord } from '@/server/modules/admin/editor-service'

/**
 * The content editor.
 *
 * Two deliberate choices:
 *
 *  - **Language tabs, not separate screens.** Translating is a comparison
 *    task; switching tabs keeps the record's identity in view.
 *  - **An unsaved-change guard.** Losing twenty minutes of typing to a
 *    mis-click is the most common way a CMS makes someone hate it (§78).
 */
export function RecordEditor({
  record,
  schema,
  locales,
  localeNames,
  sourceLocale,
  canEdit,
  listHref,
  resourceLabel,
}: {
  record: EditorRecord
  schema: ResourceFormSchema
  locales: readonly string[]
  localeNames: Record<string, string>
  sourceLocale: string
  canEdit: boolean
  listHref: string
  resourceLabel: string
}) {
  const router = useRouter()
  const tEditor = useTranslations('admin.editor')
  const [pending, startTransition] = useTransition()
  const [activeLocale, setActiveLocale] = useState(sourceLocale)
  const [base, setBase] = useState<Record<string, unknown>>(record.base)
  const [translations, setTranslations] = useState<
    Record<string, Record<string, unknown>>
  >(record.translations)
  /**
   * What is currently stored, as far as this form knows.
   *
   * Not simply `record.translations`: the AI translation panel writes drafts to
   * the database while this form is open, so from that moment the loaded record
   * is out of date and comparing against it would report saved drafts as
   * unsaved changes.
   */
  const [savedTranslations, setSavedTranslations] = useState<
    Record<string, Record<string, unknown>>
  >(record.translations)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const dirty =
    JSON.stringify(base) !== JSON.stringify(record.base) ||
    JSON.stringify(translations) !== JSON.stringify(savedTranslations)

  // Browser-level guard. The in-app navigation guard is the confirm() below.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const setBaseValue = (name: string, value: unknown) => {
    setSaved(false)
    setBase((previous) => ({ ...previous, [name]: value }))
  }

  const setTranslationValue = (locale: string, name: string, value: unknown) => {
    setSaved(false)
    setTranslations((previous) => ({
      ...previous,
      [locale]: { ...(previous[locale] ?? {}), [name]: value },
    }))
  }

  const save = () => {
    setError(null)
    setFieldErrors({})
    setSaved(false)

    startTransition(async () => {
      const result = await saveRecordAction({
        resource: record.resourceKey,
        id: record.id,
        base,
        translations,
      })

      if (!result.ok) {
        setError(result.message ?? 'Could not save.')
        setFieldErrors(result.fieldErrors ?? {})
        return
      }

      setSaved(true)
      // What is on screen is now what is stored, so it is the new baseline.
      // Waiting for `record` to come back from the refresh would leave the form
      // reporting unsaved changes for the moment in between.
      setSavedTranslations(translations)

      if (!record.id && result.id) {
        router.replace(`${listHref}/${result.id}`)
      } else {
        router.refresh()
      }
    })
  }

  const leave = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?'))
      return
    router.push(listHref)
  }

  return (
    <div className="pb-24">
      {error && (
        <p
          role="alert"
          className="border-danger-500/30 bg-danger-50 text-danger-700 mb-5 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
            <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-2.5">
              <div role="tablist" aria-label="Language" className="flex flex-wrap gap-1">
                {locales.map((locale) => {
                  const status =
                    record.translationStatus[
                      locale as keyof typeof record.translationStatus
                    ]
                  return (
                    <button
                      key={locale}
                      type="button"
                      role="tab"
                      aria-selected={activeLocale === locale}
                      onClick={() => setActiveLocale(locale)}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
                        activeLocale === locale
                          ? 'text-primary-800 bg-white font-medium shadow-xs'
                          : 'text-neutral-600 hover:bg-white/60',
                      )}
                    >
                      {localeNames[locale] ?? locale}
                      {locale === sourceLocale && (
                        <span className="text-2xs text-neutral-400 uppercase">
                          source
                        </span>
                      )}
                      {status === 'OUTDATED' && (
                        <span
                          className="bg-accent-500 h-1.5 w-1.5 rounded-full"
                          title="Outdated"
                          aria-label="Outdated"
                        />
                      )}
                      {status === 'AI_DRAFT' && (
                        <span
                          className="bg-warning-500 h-1.5 w-1.5 rounded-full"
                          title="AI draft"
                          aria-label="AI draft"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2">
              {schema.translated.map((field) => (
                <Field
                  key={`${activeLocale}-${field.name}`}
                  field={field}
                  id={`t-${activeLocale}-${field.name}`}
                  value={translations[activeLocale]?.[field.name]}
                  disabled={!canEdit || pending}
                  error={fieldErrors[`translations.${activeLocale}.${field.name}`]}
                  onChange={(value) =>
                    setTranslationValue(activeLocale, field.name, value)
                  }
                />
              ))}
            </div>

            {activeLocale !== sourceLocale && (
              <p className="border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-3 text-xs text-neutral-600">
                Changes to the {localeNames[sourceLocale] ?? sourceLocale} text mark every
                other language as outdated, so nothing silently drifts out of sync.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
              Details
            </h2>
            <div className="space-y-4">
              {schema.base.map((field) => (
                <Field
                  key={field.name}
                  field={field}
                  id={`b-${field.name}`}
                  value={base[field.name]}
                  disabled={!canEdit || pending}
                  error={fieldErrors[field.name]}
                  onChange={(value) => setBaseValue(field.name, value)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5 text-sm">
            <h2 className="mb-3 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
              State
            </h2>
            <p className="flex items-center gap-2">
              <Badge
                variant={record.status === 'PUBLISHED' ? 'success' : 'neutral'}
                size="sm"
              >
                {record.status.toLowerCase()}
              </Badge>
              {record.id === null && (
                <span className="text-xs text-neutral-500">saves as a draft</span>
              )}
            </p>
            {record.updatedAt && (
              <p className="mt-2 text-xs text-neutral-500">
                Last saved{' '}
                {new Date(record.updatedAt).toISOString().slice(0, 16).replace('T', ' ')}
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-neutral-500">
              Publishing is done from the {resourceLabel.toLowerCase()} list, so reviewing
              and going live stay separate steps.
            </p>
          </section>

          {/* Offered only on a saved record with a source text to translate
              from, and only to someone who may edit it. */}
          {record.id && canEdit && (
            <TranslatePanel
              resourceKey={record.resourceKey}
              recordId={record.id}
              localeNames={localeNames}
              sourceLocale={sourceLocale}
              onTranslated={(drafted) => {
                // Only the languages that were drafted are replaced, so
                // anything half-typed in another tab survives. They go into the
                // saved baseline too, because they are already in the database.
                const merge = (
                  previous: Record<string, Record<string, unknown>>,
                ): Record<string, Record<string, unknown>> => {
                  const next = { ...previous }
                  for (const [locale, values] of Object.entries(drafted)) {
                    next[locale] = { ...(previous[locale] ?? {}), ...values }
                  }
                  return next
                }
                setTranslations(merge)
                setSavedTranslations(merge)
              }}
            />
          )}
        </aside>
      </div>

      {/* Galleries are relations, not columns, so they live outside the form and
          save on their own. Only an existing record can own one. */}
      {record.id && isGalleryOwner(record.resourceKey) && (
        <GalleryEditor owner={record.resourceKey} ownerId={record.id} canEdit={canEdit} />
      )}

      {/* A page's sections are rows too, and for the same reason they are not
          part of the form above. */}
      {record.id && record.resourceKey === 'page' && (
        <BlockEditor pageId={record.id} canEdit={canEdit} />
      )}

      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-subtle)] bg-white/95 px-4 py-3 backdrop-blur lg:pl-64">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            {dirty ? (
              <span className="text-warning-700 text-sm">{tEditor('unsaved')}</span>
            ) : saved ? (
              <span className="text-success-700 flex items-center gap-1.5 text-sm">
                <Check className="h-4 w-4" aria-hidden="true" />
                {tEditor('saved')}
              </span>
            ) : (
              <span className="text-sm text-neutral-500">{tEditor('noChanges')}</span>
            )}

            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={leave} disabled={pending}>
                {tEditor('backToList')}
              </Button>
              <Button onClick={save} disabled={pending || !dirty}>
                <Save className="h-4 w-4" aria-hidden="true" />
                {pending ? tEditor('saving') : tEditor('save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  field,
  id,
  value,
  disabled,
  error,
  onChange,
}: {
  field: FieldSpec
  id: string
  value: unknown
  disabled: boolean
  error?: string
  onChange: (value: unknown) => void
}) {
  const describedBy = error ? `${id}-error` : field.help ? `${id}-help` : undefined
  const inputClass = cn(
    'w-full rounded-md border px-3 text-sm disabled:bg-neutral-50',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
    error ? 'border-danger-500' : 'border-neutral-300',
  )

  return (
    <div className={field.span === 2 ? 'sm:col-span-2' : undefined}>
      {field.kind !== 'boolean' && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-700">
          {field.label}
          {field.required && <span className="text-danger-600 ml-1">*</span>}
        </label>
      )}

      {field.kind === 'boolean' ? (
        <label className="flex items-center gap-2.5 text-sm text-neutral-700">
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            className="text-primary-600 h-4 w-4 rounded border-neutral-300"
          />
          {field.label}
        </label>
      ) : field.kind === 'media' ? (
        <MediaPickerField
          value={typeof value === 'string' && value.length > 0 ? value : null}
          accept={field.accept ?? 'image'}
          disabled={disabled}
          onChange={(id) => onChange(id)}
        />
      ) : field.kind === 'textarea' ? (
        <textarea
          id={id}
          rows={3}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'py-2.5')}
        />
      ) : field.kind === 'richtext' ? (
        <textarea
          id={id}
          rows={12}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'py-2.5 leading-relaxed')}
          placeholder="Separate paragraphs with a blank line."
        />
      ) : field.kind === 'stringList' ? (
        <textarea
          id={id}
          rows={4}
          value={Array.isArray(value) ? (value as string[]).join('\n') : ''}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event) =>
            onChange(
              event.target.value
                .split('\n')
                .map((line) => line.trimStart())
                .filter((line, index, all) => line.length > 0 || index < all.length - 1),
            )
          }
          className={cn(inputClass, 'py-2.5')}
          placeholder="One per line"
        />
      ) : field.kind === 'select' ? (
        <select
          id={id}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'h-11 bg-white')}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.kind === 'number' ? (
        <input
          id={id}
          type="number"
          value={typeof value === 'number' ? value : ''}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event) =>
            onChange(event.target.value === '' ? null : Number(event.target.value))
          }
          className={cn(inputClass, 'h-11')}
        />
      ) : field.kind === 'date' ? (
        <input
          id={id}
          type="date"
          value={typeof value === 'string' ? value.slice(0, 10) : ''}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'h-11')}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'h-11', field.kind === 'slug' && 'font-mono')}
        />
      )}

      {field.help && !error && (
        <p id={`${id}-help`} className="mt-1 text-xs text-neutral-500">
          {field.help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-danger-700 mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
