'use server'

import { getTranslations } from 'next-intl/server'
import { submitForm } from '@/server/modules/forms/service'
import { getRequestContext } from '@/server/security/request-context'
import { assertSameSite } from '@/server/security/csrf'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { isLocale, DEFAULT_LOCALE } from '@/i18n/config'

/**
 * Public enquiry submission.
 *
 * Returns state rather than throwing, so the form can show what went wrong
 * without losing what the visitor typed. Field-level problems come back keyed
 * by field so each input can be marked individually.
 */

export interface EnquiryFormState {
  status: 'idle' | 'success' | 'error'
  message?: string
  reference?: string
  fieldErrors?: Record<string, string>
}

/** Keys that carry submission metadata rather than form answers. */
const RESERVED_KEYS = new Set([
  'formKey',
  'locale',
  'renderedAt',
  'website',
  'productId',
  'partnerId',
  'serviceId',
  '$ACTION_ID',
])

export async function submitEnquiryAction(
  _previous: EnquiryFormState,
  formData: FormData,
): Promise<EnquiryFormState> {
  const context = await getRequestContext()

  // Server Actions are same-origin by design, but the check is cheap and this
  // is an unauthenticated write path.
  try {
    assertSameSite(context, 'POST')
  } catch {
    return { status: 'error', message: 'Request rejected.' }
  }

  const formKey = String(formData.get('formKey') ?? '')
  const rawLocale = String(formData.get('locale') ?? DEFAULT_LOCALE)
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE

  const t = await getTranslations({ locale, namespace: 'common' })
  const tErrors = await getTranslations({ locale, namespace: 'errors' })

  const payload: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (RESERVED_KEYS.has(key) || key.startsWith('$ACTION')) continue
    if (typeof value === 'string') payload[key] = value
  }

  const renderedAt = Number(formData.get('renderedAt') ?? 0)
  const elapsedMs = renderedAt > 0 ? Date.now() - renderedAt : undefined

  try {
    const result = await submitForm({
      formKey,
      payload,
      locale,
      sourcePath: context.origin ? null : null,
      referrer: null,
      ip: context.ip,
      userAgent: context.userAgent,
      honeypot: String(formData.get('website') ?? ''),
      ...(elapsedMs !== undefined ? { elapsedMs } : {}),
      relatedProductId: (formData.get('productId') as string | null) ?? null,
      relatedPartnerId: (formData.get('partnerId') as string | null) ?? null,
      relatedServiceId: (formData.get('serviceId') as string | null) ?? null,
    })

    return {
      status: 'success',
      message: t('requestInformation'),
      reference: result.reference,
    }
  } catch (error) {
    if (isAppError(error)) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of error.details ?? []) {
        fieldErrors[issue.field] = issue.code
      }
      return {
        status: 'error',
        message: error.message,
        ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
      }
    }

    logger.error({ err: error, formKey }, 'enquiry submission failed')
    return { status: 'error', message: tErrors('description') }
  }
}
