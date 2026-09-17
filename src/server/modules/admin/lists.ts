import { requireCapability } from '@/server/auth/guard'
import type { Actor } from '@/server/auth/actor'
import { LOCALES, type Locale, DEFAULT_LOCALE } from '@/i18n/config'
import { RESOURCES, type ResourceKey } from './resources'
import type { ContentStatus, TranslationStatus } from '@/server/db/generated/enums'

/**
 * Admin list queries.
 *
 * Unlike the public read model, these return every status including drafts and
 * (when asked) trashed records, and they carry the per-locale translation
 * state so the table can show at a glance what still needs work — which is the
 * single most useful column on a multilingual CMS list (§2.1, §78).
 */

export interface AdminRow {
  id: string
  title: string
  slug: string
  status: ContentStatus | null
  featured: boolean
  updatedAt: Date
  deletedAt: Date | null
  translations: Partial<Record<Locale, TranslationStatus>>
}

export interface AdminListResult {
  rows: AdminRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AdminListOptions {
  query?: string
  status?: ContentStatus
  /** Show trashed records instead of live ones. */
  trashed?: boolean
  page?: number
  pageSize?: number
  sort?: 'updated' | 'title' | 'status'
}

const DEFAULT_PAGE_SIZE = 25

export async function listForAdmin(
  actor: Actor,
  resourceKey: ResourceKey,
  options: AdminListOptions = {},
): Promise<AdminListResult> {
  await requireCapability(actor, 'content.read', { entityType: resourceKey })

  const definition = RESOURCES[resourceKey]
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, options.pageSize ?? DEFAULT_PAGE_SIZE))

  const where: Record<string, unknown> = {
    // `deletedAt: undefined` is the documented opt-out from the soft-delete
    // extension; combined with the explicit filter below it gives us the
    // trash view without a second code path.
    deletedAt: options.trashed ? { not: null } : null,
    ...(options.status ? { status: options.status } : {}),
  }

  if (options.query) {
    const contains = { contains: options.query, mode: 'insensitive' as const }
    const or: Record<string, unknown>[] = [{ slug: contains }]

    if (definition.titleField) or.push({ [definition.titleField]: contains })
    if (definition.translationDelegate) {
      or.push({
        translations: { some: { [definition.translationTitleField]: contains } },
      })
    }
    where.OR = or
  }

  const orderBy =
    options.sort === 'title'
      ? definition.titleField
        ? { [definition.titleField]: 'asc' }
        : { slug: 'asc' }
      : options.sort === 'status'
        ? { status: 'asc' }
        : { updatedAt: 'desc' }

  const delegate = options.trashed ? definition.rawDelegate() : definition.delegate()

  const select: Record<string, unknown> = {
    id: true,
    slug: true,
    updatedAt: true,
    deletedAt: true,
    ...(definition.hasStatus ? { status: true } : {}),
    ...(definition.hasFeatured ? { featured: true } : {}),
    ...(definition.titleField ? { [definition.titleField]: true } : {}),
    ...(definition.translationDelegate
      ? {
          translations: {
            select: {
              locale: true,
              status: true,
              [definition.translationTitleField]: true,
            },
          },
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    delegate.count({ where }),
    delegate.findMany({
      where,
      select,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return {
    rows: rows.map((row) =>
      toAdminRow(row, definition.titleField, definition.translationTitleField),
    ),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

function toAdminRow(
  row: Record<string, unknown>,
  titleField: string | null,
  translationTitleField: string,
): AdminRow {
  const translations = Array.isArray(row.translations)
    ? (row.translations as Array<Record<string, unknown>>)
    : []

  const byLocale: Partial<Record<Locale, TranslationStatus>> = {}
  for (const translation of translations) {
    const locale = translation.locale
    if (typeof locale === 'string' && (LOCALES as readonly string[]).includes(locale)) {
      byLocale[locale as Locale] = translation.status as TranslationStatus
    }
  }

  // Prefer the source language's title, then any translation, then the base
  // column, then the slug — so a row always shows something a human can
  // recognise. The source language is the one an editor actually typed in, so
  // it is the most likely to be filled.
  const source = translations.find((t) => t.locale === DEFAULT_LOCALE)
  const fallbackTranslation = translations[0]
  const title =
    (typeof source?.[translationTitleField] === 'string'
      ? (source[translationTitleField] as string)
      : undefined) ??
    (typeof fallbackTranslation?.[translationTitleField] === 'string'
      ? (fallbackTranslation[translationTitleField] as string)
      : undefined) ??
    (titleField && typeof row[titleField] === 'string'
      ? (row[titleField] as string)
      : undefined) ??
    (typeof row.slug === 'string' ? row.slug : '—')

  return {
    id: String(row.id),
    title,
    slug: typeof row.slug === 'string' ? row.slug : '',
    status: (row.status as ContentStatus | undefined) ?? null,
    featured: row.featured === true,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
    deletedAt: row.deletedAt instanceof Date ? row.deletedAt : null,
    translations: byLocale,
  }
}

/** Counts per status, used by the filter chips above a list. */
export async function statusCounts(
  actor: Actor,
  resourceKey: ResourceKey,
): Promise<Record<string, number>> {
  await requireCapability(actor, 'content.read')

  const definition = RESOURCES[resourceKey]
  if (!definition.hasStatus) return {}

  const delegate = definition.delegate()
  const statuses: ContentStatus[] = [
    'DRAFT',
    'REVIEW',
    'SCHEDULED',
    'PUBLISHED',
    'ARCHIVED',
  ]

  const entries = await Promise.all(
    statuses.map(
      async (status) => [status, await delegate.count({ where: { status } })] as const,
    ),
  )

  const total = await delegate.count({})
  const trashed = await definition
    .rawDelegate()
    .count({ where: { deletedAt: { not: null } } })

  return { ...Object.fromEntries(entries), ALL: total, TRASH: trashed }
}
