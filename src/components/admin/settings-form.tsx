'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui'
import { StepUpDialog } from './step-up-dialog'
import { saveSettingsBatchAction } from '@/app/(admin)/admin/(workspace)/settings/actions'
import type { StepUpScope } from '@/server/auth/capabilities'

export type SettingKind = 'text' | 'textarea' | 'boolean' | 'number' | 'select' | 'list'

export interface SettingField {
  namespace: string
  key: string
  label: string
  help?: string
  kind: SettingKind
  value: unknown
  options?: Array<{ value: string; label: string }>
  /** For multi-select lists rendered as checkboxes. */
  multiple?: boolean
}

const fieldId = (field: SettingField) => `${field.namespace}.${field.key}`

/**
 * Editable settings group.
 *
 * The group saves as a whole. Settings inside one are almost always changed
 * together — a site name with its tagline, a maintenance flag with the message
 * shown while it is on — and the previous per-field save asked for a password
 * on every one of them, which made a two-minute edit into a dozen prompts and
 * quietly trained people to avoid the screen.
 *
 * The audit trail does not suffer: the batch is still written one setting at a
 * time underneath, so the log continues to show each value's before and after.
 * Only the confirmation is shared.
 */
export function SettingsForm({
  fields,
  canEdit,
}: {
  fields: SettingField[]
  canEdit: boolean
}) {
  const t = useTranslations('admin.settings')
  const router = useRouter()

  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map((field) => [fieldId(field), field.value])),
  )
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [challenge, setChallenge] = useState<{
    scope: StepUpScope
    mfaRequired: boolean
  } | null>(null)
  const [pending, startTransition] = useTransition()

  const original = useMemo(
    () => Object.fromEntries(fields.map((field) => [fieldId(field), field.value])),
    [fields],
  )

  const changed = fields.filter(
    (field) =>
      JSON.stringify(values[fieldId(field)]) !== JSON.stringify(original[fieldId(field)]),
  )

  const save = (token?: string) => {
    setError(null)
    setSavedAt(null)

    startTransition(async () => {
      const result = await saveSettingsBatchAction({
        changes: changed.map((field) => ({
          namespace: field.namespace,
          key: field.key,
          value: values[fieldId(field)],
        })),
        ...(token ? { challengeToken: token } : {}),
      })

      if (result.stepUp) {
        setChallenge(result.stepUp)
        return
      }
      if (!result.ok) {
        setError(result.message ?? t('saveFailed'))
        return
      }

      setSavedAt(Date.now())
      router.refresh()
    })
  }

  const discard = () => {
    setValues({ ...original })
    setError(null)
  }

  return (
    <div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {fields.map((field) => (
          <SettingRow
            key={fieldId(field)}
            field={field}
            value={values[fieldId(field)]}
            disabled={!canEdit || pending}
            dirty={
              JSON.stringify(values[fieldId(field)]) !==
              JSON.stringify(original[fieldId(field)])
            }
            onChange={(next) =>
              setValues((current) => ({ ...current, [fieldId(field)]: next }))
            }
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="text-danger-700 mt-3 flex items-start gap-1.5 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {savedAt && changed.length === 0 && (
        <p className="text-success-700 mt-3 flex items-center gap-1.5 text-sm">
          <Check className="h-4 w-4" aria-hidden="true" />
          {t('saved')}
        </p>
      )}

      {canEdit && changed.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3">
          <span className="text-sm text-neutral-700">
            {t('pendingChanges', { count: changed.length })}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" disabled={pending} onClick={discard}>
              <Undo2 aria-hidden="true" />
              {t('discard')}
            </Button>
            <Button size="sm" disabled={pending} onClick={() => save()}>
              {pending ? t('saving') : t('saveAll')}
            </Button>
          </div>
        </div>
      )}

      {challenge && (
        <StepUpDialog
          open
          onOpenChange={(next) => {
            if (!next) setChallenge(null)
          }}
          scope={challenge.scope}
          mfaRequired={challenge.mfaRequired}
          title={t('confirmTitle')}
          warning={t('confirmWarning', { count: changed.length })}
          confirmLabel={t('confirmButton')}
          onConfirmed={(token) => {
            setChallenge(null)
            save(token)
          }}
        />
      )}
    </div>
  )
}

function SettingRow({
  field,
  value,
  disabled,
  dirty,
  onChange,
}: {
  field: SettingField
  value: unknown
  disabled: boolean
  dirty: boolean
  onChange: (value: unknown) => void
}) {
  const t = useTranslations('admin.settings')
  const inputId = `setting-${field.namespace}-${field.key}`.replace(/\./g, '-')
  const inputClass =
    'w-full rounded-md border border-neutral-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:bg-neutral-50'

  return (
    <div className="grid gap-3 py-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-8">
      <div>
        <label htmlFor={inputId} className="block text-sm font-medium text-neutral-800">
          {field.label}
          {dirty && (
            <span className="bg-primary-50 text-primary-800 text-2xs ml-2 rounded-full px-1.5 py-0.5 align-middle">
              {t('changed')}
            </span>
          )}
        </label>
        {field.help && (
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{field.help}</p>
        )}
      </div>

      <div className="min-w-0">
        {field.kind === 'boolean' ? (
          <label className="flex items-center gap-2.5 text-sm text-neutral-700">
            <input
              id={inputId}
              type="checkbox"
              checked={value === true}
              disabled={disabled}
              onChange={(event) => onChange(event.target.checked)}
              className="text-primary-600 h-4 w-4 rounded border-neutral-300"
            />
            {t('enabled')}
          </label>
        ) : field.kind === 'textarea' ? (
          <textarea
            id={inputId}
            rows={3}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClass} p-3`}
          />
        ) : field.kind === 'number' ? (
          <input
            id={inputId}
            type="number"
            value={typeof value === 'number' ? value : 0}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
            className={`${inputClass} h-11 w-40`}
          />
        ) : field.kind === 'select' && !field.multiple ? (
          <select
            id={inputId}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClass} h-11 max-w-sm bg-white`}
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.kind === 'select' && field.multiple ? (
          <fieldset className="flex flex-wrap gap-4" id={inputId}>
            <legend className="sr-only">{field.label}</legend>
            {field.options?.map((option) => {
              const list = Array.isArray(value) ? (value as string[]) : []
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm text-neutral-700"
                >
                  <input
                    type="checkbox"
                    checked={list.includes(option.value)}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...list, option.value]
                          : list.filter((item) => item !== option.value),
                      )
                    }
                    className="text-primary-600 h-4 w-4 rounded border-neutral-300"
                  />
                  {option.label}
                </label>
              )
            })}
          </fieldset>
        ) : field.kind === 'list' ? (
          <textarea
            id={inputId}
            rows={3}
            value={Array.isArray(value) ? (value as string[]).join('\n') : ''}
            disabled={disabled}
            placeholder={t('onePerLine')}
            onChange={(event) =>
              onChange(
                event.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean),
              )
            }
            className={`${inputClass} p-3 font-mono text-xs`}
          />
        ) : (
          <input
            id={inputId}
            type="text"
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClass} h-11`}
          />
        )}
      </div>
    </div>
  )
}
