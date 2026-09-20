'use server'

import { z } from 'zod'
import { askAssistant, type AssistantSource } from '@/server/modules/ai/assistant'
import { getLocaleSettings } from '@/server/modules/settings/service'
import { getRequestContext } from '@/server/security/request-context'
import { assertSameSite } from '@/server/security/csrf'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { LOCALES } from '@/i18n/config'

/**
 * The public assistant's one entry point.
 *
 * Returns state instead of throwing, for the same reason the enquiry form
 * does: a visitor who hits the rate limit or an unconfigured provider should
 * see a sentence explaining it, not a crashed page — and should not lose the
 * conversation they were having.
 */

export interface AssistantActionResult {
  ok: boolean
  answer?: string
  sources?: AssistantSource[]
  grounded?: boolean
  message?: string
}

const schema = z.object({
  question: z.string().trim().min(2).max(500),
  locale: z.enum(LOCALES),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      }),
    )
    .max(12)
    .default([]),
})

export async function askAssistantAction(input: {
  question: string
  locale: string
  history?: Array<{ role: string; content: string }>
}): Promise<AssistantActionResult> {
  const context = await getRequestContext()

  try {
    assertSameSite(context, 'POST')
  } catch {
    return { ok: false, message: 'Request rejected.' }
  }

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Ask a question of at least two characters.' }
  }

  try {
    const { defaultLocale, publishAiDrafts } = await getLocaleSettings()

    const answer = await askAssistant({
      question: parsed.data.question,
      locale: parsed.data.locale,
      context: {
        locale: parsed.data.locale,
        defaultLocale,
        publishAiDrafts,
      },
      history: parsed.data.history,
      ip: context.ip,
    })

    return { ok: true, ...answer }
  } catch (error) {
    // Rate limits, a spent budget and a missing API key all carry a message
    // written for a person; anything else gets a generic one and a log line.
    if (isAppError(error)) return { ok: false, message: error.message }
    logger.error({ err: error }, 'public assistant failed')
    return { ok: false, message: 'The assistant is unavailable right now.' }
  }
}
