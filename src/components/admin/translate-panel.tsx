'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Languages, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { translateRecordAction } from '@/app/(admin)/admin/(workspace)/translate-actions'

/**
 * Machine translation, offered where the blank tabs are.
 *
 * Framed as a draft rather than a result: the button says "draft", the outcome
 * says which languages got one, and everything it writes is marked AI_DRAFT so
 * it stays off the public site until a person approves it. That framing is the
 * feature — an editor who believes the output is finished will not read it, and
 * unread machine translation on a medical supplier's site is a liability.
 */
export function TranslatePanel({
  resourceKey,
  recordId,
  localeNames,
  sourceLocale,
  onTranslated,
}: {
  resourceKey: string
  recordId: string
  localeNames: Record<string, string>
  sourceLocale: string
  /**
   * Hands the drafted text to the form.
   *
   * A `router.refresh()` here would fetch the new record but change nothing on
   * screen: the form holds its fields in component state, seeded once. Worse,
   * the refreshed record would then disagree with that state, so the editor
   * would report unsaved changes and saving would write the empty fields back
   * over the drafts that were just created.
   */
  onTranslated: (values: Record<string, Record<string, unknown>>) => void
}) {
  const t = useTranslations('admin.translate')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ translated: string[]; skipped: string[] } | null>(
    null,
  )

  const targets = Object.keys(localeNames).filter((locale) => locale !== sourceLocale)

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5 text-sm">
      <h2 className="mb-3 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
        {t('title')}
      </h2>

      <p className="mb-4 text-xs leading-relaxed text-neutral-500">
        {t('description', {
          source: localeNames[sourceLocale] ?? sourceLocale,
          languages: targets.map((l) => localeNames[l]).join(', '),
        })}
      </p>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        block
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            setDone(null)
            const outcome = await translateRecordAction({ resourceKey, id: recordId })
            if (outcome.ok) {
              setDone({
                translated: outcome.translated ?? [],
                skipped: outcome.skipped ?? [],
              })
              if (outcome.values) onTranslated(outcome.values)
            } else {
              setError(outcome.message ?? t('failed'))
            }
          })
        }
      >
        <Languages aria-hidden="true" />
        {pending ? t('working') : t('action')}
      </Button>

      {error && (
        <p role="alert" className="text-danger-700 mt-3 flex items-start gap-1.5 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {done && (
        <div className="mt-3 space-y-1 text-xs">
          {done.translated.length > 0 && (
            <p className="text-success-700 flex items-start gap-1.5">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {t('drafted', {
                  languages: done.translated
                    .map((locale) => localeNames[locale] ?? locale)
                    .join(', '),
                })}
              </span>
            </p>
          )}
          {done.skipped.length > 0 && (
            <p className="text-warning-700">
              {t('skipped', {
                languages: done.skipped
                  .map((locale) => localeNames[locale] ?? locale)
                  .join(', '),
              })}
            </p>
          )}
          <p className="text-neutral-500">{t('reviewHint')}</p>
        </div>
      )}
    </section>
  )
}
