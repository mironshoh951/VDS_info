import { db } from '@/server/db/client'
import { requireCapability, hasCapability } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/security/audit'
import { getSettings } from '@/server/modules/settings/service'
import { notFound } from '@/lib/errors'
import type { InquiryStatus, InquiryType } from '@/server/db/generated/enums'

/**
 * Inquiry management (§20).
 *
 * A Viewer may read inquiries but, by default, sees contact details masked.
 * Masking happens here rather than in the template, so an API consumer and the
 * screen cannot disagree about what a Viewer is allowed to see.
 */

export interface InquiryRow {
  id: string
  reference: string
  type: InquiryType
  status: InquiryStatus
  name: string
  company: string | null
  email: string
  phone: string | null
  countryCode: string | null
  locale: string | null
  createdAt: Date
  relatedLabel: string | null
  masked: boolean
}

export interface InquiryDetail extends InquiryRow {
  message: string
  sourcePath: string | null
  respondedAt: Date | null
  resolvedAt: Date | null
  assignedTo: { id: string; name: string } | null
  notes: Array<{ id: string; body: string; authorName: string | null; createdAt: Date }>
}

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  const head = local.slice(0, 1)
  const domainParts = domain.split('.')
  const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : ''
  return `${head}${'•'.repeat(Math.max(local.length - 1, 2))}@${'•'.repeat(3)}${tld ? `.${tld}` : ''}`
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length <= 4
    ? '••••'
    : `${'•'.repeat(digits.length - 3)}${digits.slice(-3)}`
}

async function shouldMask(actor: Actor): Promise<boolean> {
  if (hasCapability(actor, 'inquiry.update')) return false
  const policy = await getSettings('security.policy')
  return !policy.inquiryViewerSeesPii
}

export interface InquiryFilters {
  status?: InquiryStatus
  type?: InquiryType
  query?: string
  page?: number
  pageSize?: number
}

export async function listInquiries(
  actor: Actor,
  filters: InquiryFilters = {},
): Promise<{ rows: InquiryRow[]; total: number; page: number; totalPages: number }> {
  await requireCapability(actor, 'inquiry.read')

  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25))
  const masked = await shouldMask(actor)

  const where = {
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.query
      ? {
          OR: [
            { reference: { contains: filters.query, mode: 'insensitive' as const } },
            { name: { contains: filters.query, mode: 'insensitive' as const } },
            { company: { contains: filters.query, mode: 'insensitive' as const } },
            { email: { contains: filters.query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    db.inquiry.count({ where }),
    db.inquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        reference: true,
        type: true,
        status: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        countryCode: true,
        locale: true,
        createdAt: true,
        product: { select: { slug: true } },
        partner: { select: { displayName: true } },
        service: { select: { slug: true } },
      },
    }),
  ])

  return {
    rows: rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      type: row.type,
      status: row.status,
      name: row.name,
      company: row.company,
      email: masked ? maskEmail(row.email) : row.email,
      phone: row.phone ? (masked ? maskPhone(row.phone) : row.phone) : null,
      countryCode: row.countryCode,
      locale: row.locale,
      createdAt: row.createdAt,
      relatedLabel:
        row.product?.slug ?? row.partner?.displayName ?? row.service?.slug ?? null,
      masked,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getInquiry(actor: Actor, id: string): Promise<InquiryDetail> {
  await requireCapability(actor, 'inquiry.read')
  const masked = await shouldMask(actor)

  const row = await db.inquiry.findUnique({
    where: { id },
    select: {
      id: true,
      reference: true,
      type: true,
      status: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      countryCode: true,
      locale: true,
      message: true,
      sourcePath: true,
      createdAt: true,
      respondedAt: true,
      resolvedAt: true,
      assignedTo: { select: { id: true, name: true } },
      product: { select: { slug: true } },
      partner: { select: { displayName: true } },
      service: { select: { slug: true } },
      notes: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  })

  if (!row) throw notFound('Inquiry not found.')

  return {
    id: row.id,
    reference: row.reference,
    type: row.type,
    status: row.status,
    name: row.name,
    company: row.company,
    email: masked ? maskEmail(row.email) : row.email,
    phone: row.phone ? (masked ? maskPhone(row.phone) : row.phone) : null,
    countryCode: row.countryCode,
    locale: row.locale,
    createdAt: row.createdAt,
    message: row.message,
    sourcePath: row.sourcePath,
    respondedAt: row.respondedAt,
    resolvedAt: row.resolvedAt,
    assignedTo: row.assignedTo,
    relatedLabel:
      row.product?.slug ?? row.partner?.displayName ?? row.service?.slug ?? null,
    masked,
    notes: row.notes.map((note) => ({
      id: note.id,
      body: note.body,
      authorName: note.author?.name ?? null,
      createdAt: note.createdAt,
    })),
  }
}

export async function updateInquiryStatus(
  actor: Actor,
  id: string,
  status: InquiryStatus,
): Promise<void> {
  await requireCapability(actor, 'inquiry.update')

  const before = await db.inquiry.findUnique({
    where: { id },
    select: { status: true, reference: true },
  })
  if (!before) throw notFound('Inquiry not found.')

  await db.inquiry.update({
    where: { id },
    data: {
      status,
      ...(status === 'CONTACTED' ? { respondedAt: new Date() } : {}),
      ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
    },
  })

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'inquiry.updated',
    entityType: 'INQUIRY',
    entityId: id,
    entityLabel: before.reference,
    before: { status: before.status },
    after: { status },
    context: {
      ip: 'ip' in actor ? actor.ip : null,
      requestId: actor.requestId,
    },
  })
}

export async function addInquiryNote(
  actor: Actor,
  id: string,
  body: string,
): Promise<void> {
  await requireCapability(actor, 'inquiry.update')

  const trimmed = body.trim().slice(0, 4000)
  if (trimmed.length === 0) return

  await db.inquiryNote.create({
    data: { inquiryId: id, authorId: actorId(actor), body: trimmed },
  })

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'inquiry.updated',
    entityType: 'INQUIRY',
    entityId: id,
    entityLabel: 'note added',
    context: { ip: 'ip' in actor ? actor.ip : null, requestId: actor.requestId },
  })
}

export async function inquiryCounts(actor: Actor): Promise<Record<string, number>> {
  await requireCapability(actor, 'inquiry.read')

  const statuses: InquiryStatus[] = [
    'NEW',
    'IN_PROGRESS',
    'CONTACTED',
    'RESOLVED',
    'ARCHIVED',
    'SPAM',
  ]

  const entries = await Promise.all(
    statuses.map(
      async (status) => [status, await db.inquiry.count({ where: { status } })] as const,
    ),
  )

  return { ...Object.fromEntries(entries), ALL: await db.inquiry.count() }
}
