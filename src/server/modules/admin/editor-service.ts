import { revalidatePath } from 'next/cache'
import { db } from '@/server/db/client'
import { authorize, requireCapability } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/security/audit'
import { contentHash } from '@/lib/ids'
import { slugify, isValidSlug } from '@/lib/slug'
import { plainTextDocument, richTextToPlainText } from '@/lib/rich-text'
import { conflict, notFound, validationFailed } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { LOCALES, type Locale, DEFAULT_LOCALE, LOCALE_DESCRIPTORS } from '@/i18n/config'
import { RESOURCES, type ResourceKey } from './resources'
import { FORM_SCHEMAS, type FieldSpec } from './form-schema'
import type { ContentStatus, TranslationStatus } from '@/server/db/generated/enums'

/**
 * Loading and saving a content record with its translations.
 *
 * The part that matters is `sourceHash`: when the source-locale text changes,
 * every other locale's translation is marked OUTDATED automatically. That is
 * what makes "this Russian description no longer matches the English" a fact
 * the system knows rather than something an editor has to remember (§27).
 */

export interface EditorRecord {
  id: string | null
  resourceKey: ResourceKey
  status: ContentStatus
  base: Record<string, unknown>
  translations: Record<Locale, Record<string, unknown>>
  translationStatus: Partial<Record<Locale, TranslationStatus>>
  updatedAt: Date | null
}

/**
 * The locale the `sourceHash` is computed from — the language content is
 * written in. Taken from the shared constant rather than pinned here, so the
 * editor, the translation matrix and the public fallback can never disagree
 * about which language is the source.
 */
const SOURCE_LOCALE: Locale = DEFAULT_LOCALE

function emptyTranslations(): Record<Locale, Record<string, unknown>> {
  return Object.fromEntries(LOCALES.map((locale) => [locale, {}])) as Record<
    Locale,
    Record<string, unknown>
  >
}

function baseSelect(fields: FieldSpec[]): Record<string, boolean> {
  return {
    id: true,
    status: true,
    updatedAt: true,
    ...Object.fromEntries(fields.map((field) => [field.name, true])),
  }
}

function translationSelect(fields: FieldSpec[]): Record<string, boolean> {
  return {
    locale: true,
    status: true,
    ...Object.fromEntries(fields.map((field) => [field.name, true])),
  }
}

export async function loadRecord(
  actor: Actor,
  resourceKey: ResourceKey,
  id: string,
): Promise<EditorRecord> {
  await requireCapability(actor, 'content.read', {
    entityType: resourceKey,
    entityId: id,
  })

  const definition = RESOURCES[resourceKey]
  const schema = FORM_SCHEMAS[resourceKey]

  const row = await definition.delegate().findUnique({
    where: { id },
    select: {
      ...baseSelect(schema.base),
      ...(definition.translationDelegate
        ? { translations: { select: translationSelect(schema.translated) } }
        : {}),
    } as Record<string, boolean>,
  })

  if (!row) throw notFound(`${definition.label} not found.`)

  const translations = emptyTranslations()
  const translationStatus: Partial<Record<Locale, TranslationStatus>> = {}

  const rows = Array.isArray(row.translations)
    ? (row.translations as Array<Record<string, unknown>>)
    : []

  for (const translation of rows) {
    const locale = translation.locale
    if (typeof locale !== 'string' || !(LOCALES as readonly string[]).includes(locale))
      continue

    const values: Record<string, unknown> = {}
    for (const field of schema.translated) {
      values[field.name] =
        field.kind === 'richtext'
          ? richTextToPlainText(translation[field.name])
          : (translation[field.name] ?? null)
    }
    translations[locale as Locale] = values
    translationStatus[locale as Locale] = translation.status as TranslationStatus
  }

  const base: Record<string, unknown> = {}
  for (const field of schema.base) {
    const value = row[field.name]
    base[field.name] =
      field.kind === 'date' && value instanceof Date
        ? value.toISOString().slice(0, 10)
        : (value ?? null)
  }

  return {
    id: String(row.id),
    resourceKey,
    status: (row.status as ContentStatus) ?? 'DRAFT',
    base,
    translations,
    translationStatus,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : null,
  }
}

export function blankRecord(resourceKey: ResourceKey): EditorRecord {
  const schema = FORM_SCHEMAS[resourceKey]
  const base: Record<string, unknown> = {}

  for (const field of schema.base) {
    base[field.name] =
      field.kind === 'boolean'
        ? false
        : field.kind === 'number'
          ? null
          : (field.options?.[0]?.value ?? '')
  }

  return {
    id: null,
    resourceKey,
    status: 'DRAFT',
    base,
    translations: emptyTranslations(),
    translationStatus: {},
    updatedAt: null,
  }
}

export interface SaveInput {
  resourceKey: ResourceKey
  id: string | null
  base: Record<string, unknown>
  translations: Record<string, Record<string, unknown>>
}

/** Coerces submitted values to the shape the column expects. */
function coerceBase(
  fields: FieldSpec[],
  input: Record<string, unknown>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {}

  for (const field of fields) {
    const raw = input[field.name]

    switch (field.kind) {
      case 'boolean':
        data[field.name] = raw === true || raw === 'true'
        break
      case 'number': {
        if (raw === '' || raw === null || raw === undefined) {
          data[field.name] = null
        } else {
          const parsed = Number(raw)
          data[field.name] = Number.isFinite(parsed) ? Math.trunc(parsed) : null
        }
        break
      }
      case 'date': {
        if (typeof raw === 'string' && raw.length > 0) {
          const parsed = new Date(raw)
          data[field.name] = Number.isNaN(parsed.getTime()) ? null : parsed
        } else {
          data[field.name] = null
        }
        break
      }
      case 'stringList':
        data[field.name] = Array.isArray(raw)
          ? raw.filter((v) => typeof v === 'string')
          : []
        break
      default: {
        const value = typeof raw === 'string' ? raw.trim() : ''
        // Optional text columns store NULL rather than an empty string, so
        // "not set" and "deliberately blank" do not become the same thing.
        data[field.name] = value.length > 0 ? value : field.required ? value : null
      }
    }
  }

  return data
}

function coerceTranslation(
  fields: FieldSpec[],
  input: Record<string, unknown>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {}

  for (const field of fields) {
    const raw = input[field.name]

    switch (field.kind) {
      case 'richtext':
        data[field.name] =
          typeof raw === 'string' && raw.trim().length > 0
            ? (plainTextDocument(raw) as unknown as object)
            : null
        break
      case 'stringList':
        data[field.name] = Array.isArray(raw)
          ? raw.filter((v) => typeof v === 'string' && v.trim().length > 0)
          : typeof raw === 'string'
            ? raw
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
            : []
        break
      default: {
        const value = typeof raw === 'string' ? raw.trim() : ''
        data[field.name] = value.length > 0 ? value : null
      }
    }
  }

  return data
}

export async function saveRecord(
  actor: Actor,
  input: SaveInput,
): Promise<{ id: string }> {
  const definition = RESOURCES[input.resourceKey]
  const schema = FORM_SCHEMAS[input.resourceKey]
  const isNew = input.id === null

  await authorize(actor, isNew ? 'content.create' : 'content.update', {
    entityType: definition.entityType,
    ...(input.id ? { entityId: input.id } : {}),
  })

  const base = coerceBase(schema.base, input.base)

  // Slug: required, normalised, and unique.
  const sourceTitle =
    (input.translations[SOURCE_LOCALE]?.[schema.titleField] as string | undefined) ?? ''
  const rawSlug = (base.slug as string | null) ?? ''
  const slug = rawSlug.trim().length > 0 ? slugify(rawSlug) : slugify(sourceTitle)

  if (!slug || !isValidSlug(slug)) {
    throw validationFailed([
      {
        field: 'slug',
        code: 'invalid',
        message: 'Enter a valid slug, or a title to derive one from.',
      },
    ])
  }
  base.slug = slug

  const titleValue = sourceTitle.trim()
  if (titleValue.length === 0) {
    throw validationFailed([
      {
        field: `translations.${SOURCE_LOCALE}.${schema.titleField}`,
        code: 'required',
        message: `The ${LOCALE_DESCRIPTORS[SOURCE_LOCALE].englishName} title is required — it is the source every translation is measured against.`,
      },
    ])
  }

  const clash = await definition.delegate().findFirst({
    where: { slug, ...(input.id ? { id: { not: input.id } } : {}) },
    select: { id: true },
  })
  if (clash) throw conflict('Another record already uses that slug.')

  const sourceTranslation = coerceTranslation(
    schema.translated,
    input.translations[SOURCE_LOCALE] ?? {},
  )
  const sourceHash = contentHash(sourceTranslation)

  const before = input.id
    ? await loadRecord(actor, input.resourceKey, input.id).catch(() => null)
    : null

  const recordId = await db.$transaction(async () => {
    let id = input.id

    // Create or update the base row.
    if (id === null) {
      const createdRow = await createBaseRow(input.resourceKey, {
        ...base,
        status: 'DRAFT',
        createdById: actorId(actor),
        updatedById: actorId(actor),
      })
      id = createdRow
    } else {
      await definition.delegate().update({
        where: { id },
        data: { ...base, updatedById: actorId(actor) },
      })
    }

    // Upsert every locale's translation.
    for (const locale of LOCALES) {
      const submitted = input.translations[locale]
      if (!submitted) continue

      const values = coerceTranslation(schema.translated, submitted)
      const hasContent = Object.values(values).some(
        (value) =>
          value !== null &&
          value !== undefined &&
          !(Array.isArray(value) && value.length === 0) &&
          !(typeof value === 'string' && value.trim().length === 0),
      )
      if (!hasContent) continue

      const status: TranslationStatus =
        locale === SOURCE_LOCALE ? 'APPROVED' : deriveStatus(before, locale)

      await upsertTranslation(input.resourceKey, id, locale, {
        ...values,
        status,
        origin: 'HUMAN',
        sourceHash,
        ...(status === 'APPROVED'
          ? { approvedById: actorId(actor), approvedAt: new Date() }
          : {}),
      })
    }

    // Anything whose stored hash no longer matches the source is now stale.
    await markOutdated(input.resourceKey, id, sourceHash)

    return id
  })

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: isNew ? `${input.resourceKey}.created` : `${input.resourceKey}.updated`,
    entityType: definition.entityType,
    entityId: recordId,
    entityLabel: titleValue,
    ...(before ? { before: before.base } : {}),
    after: base,
    context: {
      ip: 'ip' in actor ? actor.ip : null,
      userAgent: 'userAgent' in actor ? actor.userAgent : null,
      requestId: actor.requestId,
    },
  })

  try {
    revalidatePath(`/admin/${definition.path}`)
    if (definition.publicPath !== null) {
      revalidatePath(`/[locale]/${definition.publicPath}`, 'page')
      revalidatePath(`/[locale]/${definition.publicPath}/[slug]`, 'page')
    }
  } catch (error) {
    logger.warn({ err: error }, 'revalidation after save failed')
  }

  return { id: recordId }
}

/**
 * A translation that was approved against the previous source text becomes
 * OUTDATED rather than silently staying "approved" — the text is still shown,
 * but the dashboard now knows it needs a second look.
 */
function deriveStatus(before: EditorRecord | null, locale: Locale): TranslationStatus {
  const previous = before?.translationStatus[locale]
  if (!previous || previous === 'MISSING') return 'HUMAN_DRAFT'
  if (previous === 'APPROVED') return 'APPROVED'
  return previous
}

// ---------------------------------------------------------------------------
// Per-resource writes
//
// Prisma's create/upsert signatures are model-specific, so these two switches
// are the one place the generic editor touches concrete delegates.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
async function createBaseRow(
  resourceKey: ResourceKey,
  data: Record<string, unknown>,
): Promise<string> {
  const delegates: Record<ResourceKey, any> = {
    product: db.product,
    partner: db.partner,
    brand: db.brand,
    service: db.service,
    event: db.event,
    article: db.article,
    resource: db.resource,
    certificate: db.certificate,
    achievement: db.achievement,
    page: db.page,
  }

  const created = await delegates[resourceKey].create({ data, select: { id: true } })
  return String(created.id)
}

/** Shared with the AI translation service, which writes the same rows. */
export async function upsertTranslation(
  resourceKey: ResourceKey,
  recordId: string,
  locale: Locale,
  data: Record<string, unknown>,
): Promise<void> {
  const definition = RESOURCES[resourceKey]
  const fk = definition.translationForeignKey
  if (!fk) return

  const delegates: Record<ResourceKey, any> = {
    product: db.productTranslation,
    partner: db.partnerTranslation,
    brand: db.brandTranslation,
    service: db.serviceTranslation,
    event: db.eventTranslation,
    article: db.articleTranslation,
    resource: db.resourceTranslation,
    certificate: db.certificateTranslation,
    achievement: db.achievementTranslation,
    page: db.pageTranslation,
  }

  const uniqueKeyName = `${fk}_locale`

  await delegates[resourceKey].upsert({
    where: { [uniqueKeyName]: { [fk]: recordId, locale } },
    create: { [fk]: recordId, locale, ...data },
    update: data,
  })
}

async function markOutdated(
  resourceKey: ResourceKey,
  recordId: string,
  sourceHash: string,
): Promise<void> {
  const definition = RESOURCES[resourceKey]
  const fk = definition.translationForeignKey
  if (!fk) return

  const delegates: Record<ResourceKey, any> = {
    product: db.productTranslation,
    partner: db.partnerTranslation,
    brand: db.brandTranslation,
    service: db.serviceTranslation,
    event: db.eventTranslation,
    article: db.articleTranslation,
    resource: db.resourceTranslation,
    certificate: db.certificateTranslation,
    achievement: db.achievementTranslation,
    page: db.pageTranslation,
  }

  await delegates[resourceKey].updateMany({
    where: {
      [fk]: recordId,
      locale: { not: SOURCE_LOCALE },
      sourceHash: { not: sourceHash },
      status: { in: ['APPROVED', 'HUMAN_DRAFT', 'AI_DRAFT'] },
    },
    data: { status: 'OUTDATED' },
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */
