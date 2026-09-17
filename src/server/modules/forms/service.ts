import { z } from 'zod'
import { db } from '@/server/db/client'
import { newInquiryReference, sha256 } from '@/lib/ids'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { validationFailed, notFound, type FieldIssue } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { pickTranslation, type LocaleContext } from '@/server/modules/shared/localize'
import type { FormFieldType, InquiryType } from '@/server/db/generated/enums'

/**
 * Form definitions and submissions (§20, §21).
 *
 * The same field definition drives the rendered form and the server-side
 * validation. The browser copy is a convenience; this module's schema is the
 * one that decides whether a submission is accepted, because the browser's
 * can be bypassed by anyone with a terminal.
 */

export interface RenderedField {
  key: string
  type: FormFieldType
  required: boolean
  width: string
  label: string
  placeholder: string | null
  helpText: string | null
  options: Array<{ value: string; label: string }>
  validation: {
    minLength?: number
    maxLength?: number
    pattern?: string
  }
}

export interface RenderedForm {
  id: string
  key: string
  inquiryType: InquiryType
  requireCaptcha: boolean
  minFillSeconds: number
  fields: RenderedField[]
}

export async function getRenderedForm(
  key: string,
  context: LocaleContext,
): Promise<RenderedForm | null> {
  const form = await db.form.findFirst({
    where: { key, enabled: true, deletedAt: null },
    select: {
      id: true,
      key: true,
      inquiryType: true,
      requireCaptcha: true,
      minFillSeconds: true,
      fields: {
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          key: true,
          type: true,
          required: true,
          width: true,
          validation: true,
          options: true,
          translations: {
            where: { locale: { in: [context.locale, context.defaultLocale] } },
            select: {
              locale: true,
              label: true,
              placeholder: true,
              helpText: true,
              optionLabels: true,
            },
          },
        },
      },
    },
  })

  if (!form) return null

  return {
    id: form.id,
    key: form.key,
    inquiryType: form.inquiryType,
    requireCaptcha: form.requireCaptcha,
    minFillSeconds: form.minFillSeconds,
    fields: form.fields.flatMap((field): RenderedField[] => {
      const picked = pickTranslation(field.translations, context)
      if (!picked) return []

      const optionLabels = (picked.translation.optionLabels ?? {}) as Record<
        string,
        string
      >
      const rawOptions = Array.isArray(field.options)
        ? (field.options as Array<{ value: string }>)
        : []

      return [
        {
          key: field.key,
          type: field.type,
          required: field.required,
          width: field.width,
          label: picked.translation.label,
          placeholder: picked.translation.placeholder,
          helpText: picked.translation.helpText,
          options: rawOptions.map((option) => ({
            value: option.value,
            label: optionLabels[option.value] ?? option.value,
          })),
          validation: (field.validation ?? {}) as RenderedField['validation'],
        },
      ]
    }),
  }
}

/**
 * Builds the server-side schema from the stored field definitions. This is the
 * authority on what a valid submission looks like.
 */
function buildSchema(form: RenderedForm): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of form.fields) {
    let schema: z.ZodTypeAny

    switch (field.type) {
      case 'EMAIL':
        schema = z.string().trim().email()
        break
      case 'PHONE':
        schema = z
          .string()
          .trim()
          .regex(/^[+()\d\s-]{5,40}$/, 'invalid_phone')
        break
      case 'NUMBER':
        schema = z.coerce.number()
        break
      case 'CONSENT':
        schema = field.required
          ? z.literal('on', { message: 'consent_required' })
          : z.string().optional()
        break
      case 'CHECKBOX':
        schema = z.array(z.string()).or(z.string()).optional()
        break
      case 'SELECT':
      case 'RADIO': {
        const values = field.options.map((option) => option.value)
        schema = values.length > 0 ? z.enum(values as [string, ...string[]]) : z.string()
        break
      }
      case 'DATE':
        schema = z.string().trim()
        break
      default:
        schema = z.string().trim()
    }

    if (schema instanceof z.ZodString) {
      let stringSchema: z.ZodString = schema
      if (field.validation.minLength)
        stringSchema = stringSchema.min(field.validation.minLength)
      if (field.validation.maxLength)
        stringSchema = stringSchema.max(field.validation.maxLength)
      if (field.validation.pattern) {
        stringSchema = stringSchema.regex(new RegExp(field.validation.pattern))
      }
      schema = stringSchema
    }

    if (!field.required && field.type !== 'CONSENT') {
      schema = schema.optional().or(z.literal(''))
    }

    shape[field.key] = schema
  }

  return z.object(shape).passthrough() as z.ZodType<Record<string, unknown>>
}

export interface SubmitInput {
  formKey: string
  payload: Record<string, unknown>
  locale: string
  sourcePath: string | null
  referrer: string | null
  ip: string | null
  userAgent: string | null
  /** Hidden field that must stay empty — bots fill it in. */
  honeypot?: string
  /** Milliseconds between the form rendering and the submission. */
  elapsedMs?: number
  relatedProductId?: string | null
  relatedPartnerId?: string | null
  relatedServiceId?: string | null
}

export interface SubmitResult {
  reference: string
}

const SPAM_SALT = 'vds-submission'

export async function submitForm(input: SubmitInput): Promise<SubmitResult> {
  await enforceRateLimit('public.form', input.ip ?? 'unknown')

  const context: LocaleContext = {
    locale: input.locale as LocaleContext['locale'],
    defaultLocale: 'en',
    publishAiDrafts: false,
  }

  const form = await getRenderedForm(input.formKey, context)
  if (!form) throw notFound('That form is not available.')

  // Two cheap bot filters before anything is written. Both are silent: a bot
  // that learns which check caught it can route around the next one.
  const looksAutomated =
    Boolean(input.honeypot && input.honeypot.trim().length > 0) ||
    (input.elapsedMs !== undefined && input.elapsedMs < form.minFillSeconds * 1000)

  const parsed = buildSchema(form).safeParse(input.payload)

  if (!parsed.success) {
    const details: FieldIssue[] = parsed.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? 'form'),
      code: issue.message || 'invalid',
    }))
    throw validationFailed(details)
  }

  const data = parsed.data

  const reference = newInquiryReference()

  // Submission and inquiry are written together: a stored submission with no
  // inquiry would be a lead nobody sees.
  await db.$transaction(async (tx) => {
    const submission = await tx.formSubmission.create({
      data: {
        formId: form.id,
        payload: data as object,
        locale: input.locale,
        sourcePath: input.sourcePath,
        referrer: input.referrer,
        ipHash: input.ip ? sha256(`${SPAM_SALT}:${input.ip}`) : null,
        userAgent: input.userAgent,
        spamScore: looksAutomated ? 1 : 0,
      },
      select: { id: true },
    })

    await tx.inquiry.create({
      data: {
        reference,
        type: form.inquiryType,
        status: looksAutomated ? 'SPAM' : 'NEW',
        name: String(data.name ?? '').slice(0, 200),
        company: data.company ? String(data.company).slice(0, 200) : null,
        email: String(data.email ?? '').slice(0, 320),
        phone: data.phone ? String(data.phone).slice(0, 40) : null,
        message: String(data.message ?? '').slice(0, 8000),
        locale: input.locale,
        sourcePath: input.sourcePath,
        submissionId: submission.id,
        productId: input.relatedProductId ?? null,
        partnerId: input.relatedPartnerId ?? null,
        serviceId: input.relatedServiceId ?? null,
      },
    })

    if (input.relatedProductId) {
      await tx.product.update({
        where: { id: input.relatedProductId },
        data: { inquiryCount: { increment: 1 } },
      })
    }
  })

  logger.info(
    { formKey: input.formKey, reference, flagged: looksAutomated },
    'form submission stored',
  )

  // A flagged submission still returns success. Telling a bot it was detected
  // only helps it try again differently, and a false positive would otherwise
  // show a real customer an error for a message that was in fact saved.
  return { reference }
}
