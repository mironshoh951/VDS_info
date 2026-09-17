import { db } from '@/server/db/client'
import type { Prisma } from '@/server/db/generated/client'
import {
  pickTranslation,
  translationFilter,
  resolveSlug,
  localePath,
  type LocaleContext,
} from '@/server/modules/shared/localize'
import { mediaUrl, type Paginated } from './queries'
import type { ResourceType, AchievementCategory } from '@/server/db/generated/enums'

/**
 * Public read model for the resource centre, trust centre, achievements and
 * offices.
 *
 * Same conventions as the other query modules: published-only,
 * locale-resolved, shaped for the template that consumes it.
 */

const published = { status: 'PUBLISHED' as const, deletedAt: null }

// ---------------------------------------------------------------------------
// Resource centre (§18)
// ---------------------------------------------------------------------------

export interface ResourceCard {
  id: string
  slug: string
  href: string
  title: string
  description: string | null
  type: ResourceType
  contentLocale: string | null
  fileUrl: string | null
  externalUrl: string | null
  thumbnailUrl: string | null
  sizeBytes: number | null
  downloadCount: number
  partner: { name: string; href: string } | null
  updatedAt: Date
}

export interface ResourceFilters {
  query?: string
  type?: ResourceType
  contentLocale?: string
  partnerSlug?: string
  page?: number
  pageSize?: number
}

export async function listResources(
  context: LocaleContext,
  filters: ResourceFilters = {},
): Promise<Paginated<ResourceCard>> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(60, Math.max(1, filters.pageSize ?? 24))

  const where: Prisma.ResourceWhereInput = {
    ...published,
    visibility: 'PUBLIC',
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.contentLocale ? { contentLocale: filters.contentLocale } : {}),
    ...(filters.partnerSlug ? { partner: { slug: filters.partnerSlug } } : {}),
    ...(filters.query
      ? {
          translations: {
            some: {
              ...translationFilter(context),
              OR: [
                { title: { contains: filters.query, mode: 'insensitive' } },
                { description: { contains: filters.query, mode: 'insensitive' } },
              ],
            },
          },
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    db.resource.count({ where }),
    db.resource.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { publishedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        type: true,
        contentLocale: true,
        externalUrl: true,
        downloadCount: true,
        updatedAt: true,
        file: { select: { storageKey: true, sizeBytes: true } },
        thumbnail: { select: { storageKey: true } },
        partner: {
          select: {
            slug: true,
            displayName: true,
            translations: {
              where: translationFilter(context),
              select: { locale: true, name: true, slug: true },
            },
          },
        },
        translations: {
          where: translationFilter(context),
          select: { locale: true, slug: true, title: true, description: true },
        },
      },
    }),
  ])

  const items: ResourceCard[] = []

  for (const row of rows) {
    const picked = pickTranslation(row.translations, context)
    if (!picked) continue

    const partnerPicked = row.partner
      ? pickTranslation(row.partner.translations, context)
      : null

    items.push({
      id: row.id,
      slug: resolveSlug(row.slug, picked.translation),
      href: localePath(
        context.locale,
        'resources',
        resolveSlug(row.slug, picked.translation),
      ),
      title: picked.translation.title,
      description: picked.translation.description,
      type: row.type,
      contentLocale: row.contentLocale,
      fileUrl: mediaUrl(row.file?.storageKey),
      externalUrl: row.externalUrl,
      thumbnailUrl: mediaUrl(row.thumbnail?.storageKey),
      sizeBytes: row.file?.sizeBytes ?? null,
      downloadCount: row.downloadCount,
      partner:
        row.partner && partnerPicked
          ? {
              name: partnerPicked.translation.name,
              href: localePath(
                context.locale,
                'partners',
                resolveSlug(row.partner.slug, partnerPicked.translation),
              ),
            }
          : null,
      updatedAt: row.updatedAt,
    })
  }

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** The distinct resource types that actually have published content. */
export async function listResourceTypes(): Promise<ResourceType[]> {
  const rows = await db.resource.findMany({
    where: { ...published, visibility: 'PUBLIC' },
    distinct: ['type'],
    select: { type: true },
  })
  return rows.map((row) => row.type)
}

// ---------------------------------------------------------------------------
// Trust centre (§19)
// ---------------------------------------------------------------------------

export interface CertificateCard {
  id: string
  slug: string
  title: string
  description: string | null
  issuer: string | null
  kind: string
  referenceNo: string | null
  issuedOn: Date | null
  expiresOn: Date | null
  fileUrl: string | null
  thumbnailUrl: string | null
  /** Derived, not stored: recomputed on every render so it cannot go stale. */
  expiryState: 'valid' | 'expiring' | 'expired' | 'not-applicable'
}

const EXPIRY_WARNING_DAYS = 60

function expiryState(expiresOn: Date | null): CertificateCard['expiryState'] {
  if (!expiresOn) return 'not-applicable'
  const now = Date.now()
  const expires = expiresOn.getTime()
  if (expires < now) return 'expired'
  if (expires - now < EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000) return 'expiring'
  return 'valid'
}

export async function listCertificates(
  context: LocaleContext,
): Promise<CertificateCard[]> {
  const rows = await db.certificate.findMany({
    where: { ...published, visibility: 'PUBLIC' },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { issuedOn: 'desc' }],
    select: {
      id: true,
      slug: true,
      kind: true,
      issuer: true,
      referenceNo: true,
      issuedOn: true,
      expiresOn: true,
      file: { select: { storageKey: true } },
      thumbnail: { select: { storageKey: true } },
      translations: {
        where: translationFilter(context),
        select: {
          locale: true,
          slug: true,
          title: true,
          description: true,
          issuerLocalized: true,
        },
      },
    },
  })

  const items: CertificateCard[] = []

  for (const row of rows) {
    const picked = pickTranslation(row.translations, context)
    if (!picked) continue

    items.push({
      id: row.id,
      slug: resolveSlug(row.slug, picked.translation),
      title: picked.translation.title,
      description: picked.translation.description,
      issuer: picked.translation.issuerLocalized ?? row.issuer,
      kind: row.kind,
      referenceNo: row.referenceNo,
      issuedOn: row.issuedOn,
      expiresOn: row.expiresOn,
      fileUrl: mediaUrl(row.file?.storageKey),
      thumbnailUrl: mediaUrl(row.thumbnail?.storageKey),
      expiryState: expiryState(row.expiresOn),
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Achievements (§15)
// ---------------------------------------------------------------------------

export interface AchievementCard {
  id: string
  slug: string
  title: string
  description: unknown
  category: AchievementCategory
  achievedOn: Date | null
  location: string | null
  issuer: string | null
  externalUrl: string | null
  imageUrl: string | null
  documentUrl: string | null
  partner: { name: string; href: string } | null
}

export async function listAchievements(
  context: LocaleContext,
): Promise<AchievementCard[]> {
  const rows = await db.achievement.findMany({
    where: published,
    orderBy: [{ featured: 'desc' }, { achievedOn: 'desc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      slug: true,
      category: true,
      achievedOn: true,
      location: true,
      externalUrl: true,
      image: { select: { storageKey: true } },
      document: { select: { storageKey: true } },
      partner: {
        select: {
          slug: true,
          translations: {
            where: translationFilter(context),
            select: { locale: true, name: true, slug: true },
          },
        },
      },
      translations: {
        where: translationFilter(context),
        select: {
          locale: true,
          slug: true,
          title: true,
          description: true,
          issuer: true,
        },
      },
    },
  })

  const items: AchievementCard[] = []

  for (const row of rows) {
    const picked = pickTranslation(row.translations, context)
    if (!picked) continue

    const partnerPicked = row.partner
      ? pickTranslation(row.partner.translations, context)
      : null

    items.push({
      id: row.id,
      slug: resolveSlug(row.slug, picked.translation),
      title: picked.translation.title,
      description: picked.translation.description,
      category: row.category,
      achievedOn: row.achievedOn,
      location: row.location,
      issuer: picked.translation.issuer,
      externalUrl: row.externalUrl,
      imageUrl: mediaUrl(row.image?.storageKey),
      documentUrl: mediaUrl(row.document?.storageKey),
      partner:
        row.partner && partnerPicked
          ? {
              name: partnerPicked.translation.name,
              href: localePath(
                context.locale,
                'partners',
                resolveSlug(row.partner.slug, partnerPicked.translation),
              ),
            }
          : null,
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Offices (§41)
// ---------------------------------------------------------------------------

export interface OfficeView {
  id: string
  name: string
  countryCode: string
  city: string
  addressLine: string | null
  contactPerson: string | null
  note: string | null
  phone: string | null
  phoneSecondary: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  mapEmbedUrl: string | null
  isHeadquarters: boolean
  workingHours: Array<{ days: number[]; open: string; close: string }>
}

export async function listOffices(context: LocaleContext): Promise<OfficeView[]> {
  const rows = await db.office.findMany({
    where: { visible: true },
    orderBy: [{ isHeadquarters: 'desc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      countryCode: true,
      city: true,
      phone: true,
      phoneSecondary: true,
      email: true,
      latitude: true,
      longitude: true,
      mapEmbedUrl: true,
      isHeadquarters: true,
      workingHours: true,
      translations: {
        where: { locale: { in: [context.locale, context.defaultLocale] } },
        select: {
          locale: true,
          name: true,
          addressLine: true,
          cityLocalized: true,
          contactPerson: true,
          note: true,
        },
      },
    },
  })

  const items: OfficeView[] = []

  for (const row of rows) {
    const picked = pickTranslation(row.translations, context)
    if (!picked) continue

    items.push({
      id: row.id,
      name: picked.translation.name,
      countryCode: row.countryCode,
      city: picked.translation.cityLocalized ?? row.city,
      addressLine: picked.translation.addressLine,
      contactPerson: picked.translation.contactPerson,
      note: picked.translation.note,
      phone: row.phone,
      phoneSecondary: row.phoneSecondary,
      email: row.email,
      latitude: row.latitude,
      longitude: row.longitude,
      mapEmbedUrl: row.mapEmbedUrl,
      isHeadquarters: row.isHeadquarters,
      workingHours: parseWorkingHours(row.workingHours),
    })
  }

  return items
}

function parseWorkingHours(value: unknown): OfficeView['workingHours'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const record = entry as Record<string, unknown>
    const days = Array.isArray(record.days)
      ? record.days.filter((d): d is number => typeof d === 'number')
      : []
    const open = typeof record.open === 'string' ? record.open : null
    const close = typeof record.close === 'string' ? record.close : null
    if (days.length === 0 || !open || !close) return []
    return [{ days, open, close }]
  })
}

// ---------------------------------------------------------------------------
// Team and milestones (§9)
// ---------------------------------------------------------------------------

export interface TeamMemberView {
  id: string
  name: string
  position: string | null
  bio: unknown
  photoUrl: string | null
  languages: string[]
  email: string | null
}

export async function listTeam(context: LocaleContext): Promise<TeamMemberView[]> {
  const rows = await db.teamMember.findMany({
    where: { visible: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      languages: true,
      email: true,
      photo: { select: { storageKey: true } },
      translations: {
        where: { locale: { in: [context.locale, context.defaultLocale] } },
        select: { locale: true, name: true, position: true, bio: true },
      },
    },
  })

  const items: TeamMemberView[] = []

  for (const row of rows) {
    const picked = pickTranslation(row.translations, context)
    if (!picked) continue

    items.push({
      id: row.id,
      name: picked.translation.name,
      position: picked.translation.position,
      bio: picked.translation.bio,
      photoUrl: mediaUrl(row.photo?.storageKey),
      languages: row.languages,
      email: row.email,
    })
  }

  return items
}

export interface MilestoneView {
  id: string
  year: number
  month: number | null
  title: string
  description: string | null
  imageUrl: string | null
}

export async function listMilestones(context: LocaleContext): Promise<MilestoneView[]> {
  const rows = await db.milestone.findMany({
    where: { visible: true },
    orderBy: [{ year: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      year: true,
      month: true,
      image: { select: { storageKey: true } },
      translations: {
        where: { locale: { in: [context.locale, context.defaultLocale] } },
        select: { locale: true, title: true, description: true },
      },
    },
  })

  const items: MilestoneView[] = []

  for (const row of rows) {
    const picked = pickTranslation(row.translations, context)
    if (!picked) continue

    items.push({
      id: row.id,
      year: row.year,
      month: row.month,
      title: picked.translation.title,
      description: picked.translation.description,
      imageUrl: mediaUrl(row.image?.storageKey),
    })
  }

  return items
}
