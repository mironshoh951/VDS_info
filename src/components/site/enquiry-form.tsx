'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { submitEnquiryAction, type EnquiryFormState } from '@/app/actions/enquiry'
import type { RenderedField } from '@/server/modules/forms/service'

const initialState: EnquiryFormState = { status: 'idle' }

/**
 * Public enquiry form.
 *
 * Rendered entirely from the stored field definitions, so adding a field in
 * the admin panel changes this form with no code change (§21).
 *
 * Accessibility details that are easy to miss and expensive to retrofit:
 * errors are tied to their input with `aria-describedby`, invalid fields carry
 * `aria-invalid`, and the success and failure messages are announced through a
 * live region rather than only appearing visually.
 */
export function EnquiryForm({
  formKey,
  fields,
  locale,
  related,
  submitLabel,
}: {
  formKey: string
  fields: RenderedField[]
  locale: string
  related?: { productId?: string; partnerId?: string; serviceId?: string }
  submitLabel: string
}) {
  const t = useTranslations('validation')
  const [state, action] = useActionState(submitEnquiryAction, initialState)
  /**
   * Anti-spam time-trap.
   *
   * The timestamp is written by an effect rather than during render: reading
   * the clock while rendering is impure, and a value baked into the server
   * render would be the time the page was cached, not the time this visitor
   * opened it. A submission with no timestamp (scripting disabled) simply
   * skips this check — the honeypot and the rate limiter still apply.
   */
  const renderedAtInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renderedAtInput.current) {
      renderedAtInput.current.value = String(Date.now())
    }
  }, [])

  const errorFor = (key: string) =>
    state.status === 'error' ? state.fieldErrors?.[key] : undefined

  const messageForCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    switch (code) {
      case 'consent_required':
        return t('consent')
      case 'invalid_phone':
        return t('phone')
      default:
        return code.includes('email') ? t('email') : t('required')
    }
  }

  if (state.status === 'success') {
    return (
      <div
        role="status"
        className="border-success-500/30 bg-success-50 flex items-start gap-3 rounded-xl border px-5 py-4"
      >
        <CheckCircle2
          className="text-success-700 mt-0.5 h-5 w-5 shrink-0"
          aria-hidden="true"
        />
        <div className="text-sm">
          <p className="text-success-700 font-medium">{state.message}</p>
          {state.reference && (
            <p className="text-success-700/80 mt-1 font-mono text-xs">
              {state.reference}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="formKey" value={formKey} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="renderedAt" ref={renderedAtInput} defaultValue="" />
      {related?.productId && (
        <input type="hidden" name="productId" value={related.productId} />
      )}
      {related?.partnerId && (
        <input type="hidden" name="partnerId" value={related.partnerId} />
      )}
      {related?.serviceId && (
        <input type="hidden" name="serviceId" value={related.serviceId} />
      )}

      {/* Honeypot: hidden from people, irresistible to naive bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${formKey}-website`}>Leave this field empty</label>
        <input
          id={`${formKey}-website`}
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state.status === 'error' && state.message && (
        <div
          role="alert"
          className="border-danger-500/30 bg-danger-50 text-danger-700 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm sm:col-span-2"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )}

      {fields.map((field) => {
        const id = `${formKey}-${field.key}`
        const errorCode = errorFor(field.key)
        const errorMessage = messageForCode(errorCode)
        const describedBy = [
          field.helpText ? `${id}-help` : null,
          errorMessage ? `${id}-error` : null,
        ]
          .filter(Boolean)
          .join(' ')

        const wrapperClass = cn(
          field.width === 'full' ? 'sm:col-span-2' : 'sm:col-span-1',
        )

        if (field.type === 'CONSENT') {
          return (
            <div key={field.key} className={wrapperClass}>
              <label className="flex items-start gap-3 text-sm text-neutral-600">
                <input
                  id={id}
                  name={field.key}
                  type="checkbox"
                  required={field.required}
                  aria-invalid={errorMessage ? true : undefined}
                  aria-describedby={describedBy || undefined}
                  className="text-primary-700 mt-0.5 h-4 w-4 rounded border-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                />
                <span>{field.label}</span>
              </label>
              {errorMessage && (
                <p id={`${id}-error`} className="text-danger-700 mt-1.5 text-xs">
                  {errorMessage}
                </p>
              )}
            </div>
          )
        }

        return (
          <div key={field.key} className={wrapperClass}>
            <label
              htmlFor={id}
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              {field.label}
              {field.required && (
                <span className="text-danger-500 ml-0.5" aria-hidden="true">
                  *
                </span>
              )}
            </label>

            {field.type === 'TEXTAREA' ? (
              <textarea
                id={id}
                name={field.key}
                rows={5}
                required={field.required}
                placeholder={field.placeholder ?? undefined}
                maxLength={field.validation.maxLength}
                aria-invalid={errorMessage ? true : undefined}
                aria-describedby={describedBy || undefined}
                className={inputClass(Boolean(errorMessage))}
              />
            ) : field.type === 'SELECT' ? (
              <select
                id={id}
                name={field.key}
                required={field.required}
                aria-invalid={errorMessage ? true : undefined}
                aria-describedby={describedBy || undefined}
                className={cn(inputClass(Boolean(errorMessage)), 'h-11')}
                defaultValue=""
              >
                <option value="" disabled />
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={field.key}
                type={
                  field.type === 'EMAIL'
                    ? 'email'
                    : field.type === 'PHONE'
                      ? 'tel'
                      : field.type === 'NUMBER'
                        ? 'number'
                        : field.type === 'DATE'
                          ? 'date'
                          : 'text'
                }
                required={field.required}
                placeholder={field.placeholder ?? undefined}
                maxLength={field.validation.maxLength}
                autoComplete={autoCompleteFor(field.key, field.type)}
                aria-invalid={errorMessage ? true : undefined}
                aria-describedby={describedBy || undefined}
                className={cn(inputClass(Boolean(errorMessage)), 'h-11')}
              />
            )}

            {field.helpText && (
              <p id={`${id}-help`} className="mt-1.5 text-xs text-neutral-500">
                {field.helpText}
              </p>
            )}
            {errorMessage && (
              <p id={`${id}-error`} className="text-danger-700 mt-1.5 text-xs">
                {errorMessage}
              </p>
            )}
          </div>
        )
      })}

      <div className="sm:col-span-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  )
}

function inputClass(hasError: boolean): string {
  return cn(
    'w-full rounded-md border bg-white px-3 py-2.5 text-base text-neutral-900',
    'placeholder:text-neutral-400',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
    hasError ? 'border-danger-500' : 'border-neutral-300',
  )
}

function autoCompleteFor(key: string, type: string): string | undefined {
  if (type === 'EMAIL') return 'email'
  if (type === 'PHONE') return 'tel'
  if (key === 'name') return 'name'
  if (key === 'company') return 'organization'
  return undefined
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {label}
    </Button>
  )
}
