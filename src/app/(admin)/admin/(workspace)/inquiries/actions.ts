'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActor } from '@/server/auth/context'
import { updateInquiryStatus, addInquiryNote } from '@/server/modules/inquiries/service'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

const STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'CONTACTED',
  'RESOLVED',
  'ARCHIVED',
  'SPAM',
] as const

export interface InquiryActionResult {
  ok: boolean
  message?: string
}

function fail(error: unknown): InquiryActionResult {
  if (isAppError(error)) return { ok: false, message: error.message }
  logger.error({ err: error }, 'inquiry action failed')
  return { ok: false, message: 'Something went wrong. Please try again.' }
}

export async function setInquiryStatusAction(input: {
  id: string
  status: string
}): Promise<InquiryActionResult> {
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(STATUSES) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid request.' }

  try {
    const actor = await getActor()
    await updateInquiryStatus(actor, parsed.data.id, parsed.data.status)
    revalidatePath('/admin/inquiries')
    revalidatePath(`/admin/inquiries/${parsed.data.id}`)
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function addNoteAction(input: {
  id: string
  body: string
}): Promise<InquiryActionResult> {
  const parsed = z
    .object({ id: z.string().uuid(), body: z.string().trim().min(1).max(4000) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Write a note first.' }

  try {
    const actor = await getActor()
    await addInquiryNote(actor, parsed.data.id, parsed.data.body)
    revalidatePath(`/admin/inquiries/${parsed.data.id}`)
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}
