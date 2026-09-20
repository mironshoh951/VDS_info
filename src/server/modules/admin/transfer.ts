import { authorize } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/security/audit'
import { toCsv, parseCsvRecords } from '@/lib/csv'
import { slugify, isValidSlug } from '@/lib/slug'
import { richTextToPlainText } from '@/lib/rich-text'
import { validationFailed, isAppError } from '@/lib/errors'
import { LOCALES, type Locale, DEFAULT_LOCALE } from '@/i18n/config'
import { RESOURCES, type ResourceKey } from './resources'
import { FORM_SCHEMAS, type FieldSpec } from './form-schema'
import { loadRecord, saveRecord } from './editor-service'

/**
 * Bulk content in and out.
 *
 * Two decisions shape everything here.
 *
 * The first is that importing goes through `saveRecord` — the same function
 * the editor screen calls — rather than writing rows directly. A spreadsheet
 * is a bulk editor, so it must obey the editor's rules: slugs normalised and
 * unique, the source-language title required, translations of changed source
 * text marked outdated, every write audited. An import path with its own
 * shortcut to the database is how a CMS ends up with two sets of rules and a
 * table full of records the editor then refuses to open.
 *
 * The second is that a column absent from the file means "leave this alone",
 * not "clear it". Someone who exports a catalogue, fixes the Russian names in
 * three rows and imports a two-column file back expects to have changed three
 * Russian names. Merging over the stored record is what makes that true;
 * without it the same file would erase every other field of every row it
 * touched.
 *
 * Publication status is deliberately read-only. It appears in the export
 * because it is useful to see, and is ignored on the way back in: publishing
 * is a capability of its own (`content.publish`), and putting the word
 * PUBLISHED in a cell is not a decision anyone should be able to make from a
 * spreadsheet.
 */

export type TransferFormat = 'csv' | 'json'

export interface ExportFile {
  filename: string
  mimeType: string
  body: string
  rowCount: number
}

export type ImportAction = 'create' | 'update' | 'error'

export interface ImportRowOutcome {
  /** Row number as the author sees it in a spreadsheet — the header is 1. */
  line: number
  action: ImportAction
  slug: string | null
  title: string | null
  message?: string
}

export interface ImportReport {
  dryRun: boolean
  resourceKey: ResourceKey
  total: number
  created: number
  updated: number
  failed: number
  rows: ImportRowOutcome[]
}

interface RecordShape {
  base: Record<string, unknown>
  translations: Record<string, Record<string, unknown>>
}

/** Column name for a translated field: `ru.name`, `zh.shortDescription`. */
function localeColumn(locale: Locale, field: string): string {
  return `${locale}.${field}`
}

/**
 * A cell is always a string, and the empty string always means "no value".
 *
 * Lists are joined with newlines rather than a separator like `|`, because
 * `coerceTranslation` already splits on newlines and because a newline inside
 * a quoted CSV field is legal — so a benefits list survives the round trip
 * without inventing an escaping convention of its own.
 */
function toCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join('\n')
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

interface StoredRecord extends RecordShape {
  id: string
  status: string
}

/**
 * Reads every record of one type, with all four languages.
 *
 * Deliberately not paginated. An export that silently stopped at page one
 * would be worse than no export at all — the editor would reimport it and
 * wonder where the rest went — and these tables are measured in thousands of
 * rows, not millions.
 */
async function readAll(resourceKey: ResourceKey): Promise<StoredRecord[]> {
  const definition = RESOURCES[resourceKey]
  const schema = FORM_SCHEMAS[resourceKey]

  const rows = await definition.delegate().findMany({
    select: {
      id: true,
      ...(definition.hasStatus ? { status: true } : {}),
      ...Object.fromEntries(schema.base.map((field) => [field.name, true])),
      ...(definition.translationDelegate
        ? {
            translations: {
              select: {
                locale: true,
                ...Object.fromEntries(
                  schema.translated.map((field) => [field.name, true]),
                ),
              },
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map((row) => {
    const translations: Record<string, Record<string, unknown>> = {}
    const translationRows = Array.isArray(row.translations)
      ? (row.translations as Array<Record<string, unknown>>)
      : []

    for (const translation of translationRows) {
      const locale = translation.locale
      if (typeof locale !== 'string') continue
      const values: Record<string, unknown> = {}
      for (const field of schema.translated) {
        // Rich text leaves as plain paragraphs, which is what the editor's
        // rich-text field accepts back. A spreadsheet cell cannot hold a
        // document tree, and shipping JSON inside a CSV cell would make the
        // file unusable for the one job it exists to do.
        values[field.name] =
          field.kind === 'richtext'
            ? richTextToPlainText(translation[field.name])
            : (translation[field.name] ?? null)
      }
      translations[locale] = values
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
      status: typeof row.status === 'string' ? row.status : 'DRAFT',
      base,
      translations,
    }
  })
}

function headerFor(resourceKey: ResourceKey): string[] {
  const schema = FORM_SCHEMAS[resourceKey]
  return [
    'id',
    'status',
    ...schema.base.map((field) => field.name),
    ...LOCALES.flatMap((locale) =>
      schema.translated.map((field) => localeColumn(locale, field.name)),
    ),
  ]
}

export async function exportResource(
  actor: Actor,
  input: { resourceKey: ResourceKey; format: TransferFormat },
): Promise<ExportFile> {
  const definition = RESOURCES[input.resourceKey]

  await authorize(actor, 'export.run', { entityType: definition.entityType })

  const schema = FORM_SCHEMAS[input.resourceKey]
  const records = await readAll(input.resourceKey)
  const stamp = new Date().toISOString().slice(0, 10)

  if (input.format === 'json') {
    await auditTransfer(actor, 'export', input.resourceKey, records.length, {
      format: 'json',
    })
    return {
      filename: `${definition.path}-${stamp}.json`,
      mimeType: 'application/json',
      body: `${JSON.stringify(records, null, 2)}\n`,
      rowCount: records.length,
    }
  }

  const rows = records.map((record) => [
    record.id,
    record.status,
    ...schema.base.map((field) => toCell(record.base[field.name])),
    ...LOCALES.flatMap((locale) =>
      schema.translated.map((field) => toCell(record.translations[locale]?.[field.name])),
    ),
  ])

  await auditTransfer(actor, 'export', input.resourceKey, records.length, {
    format: 'csv',
  })

  return {
    filename: `${definition.path}-${stamp}.csv`,
    mimeType: 'text/csv',
    body: toCsv([headerFor(input.resourceKey), ...rows]),
    rowCount: records.length,
  }
}

/** A file of just the headers, for someone starting from nothing. */
export async function exportTemplate(
  actor: Actor,
  resourceKey: ResourceKey,
): Promise<ExportFile> {
  const definition = RESOURCES[resourceKey]
  await authorize(actor, 'export.run', { entityType: definition.entityType })

  return {
    filename: `${definition.path}-template.csv`,
    mimeType: 'text/csv',
    body: toCsv([headerFor(resourceKey)]),
    rowCount: 0,
  }
}

interface ParsedRow extends RecordShape {
  line: number
  id: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** First value that was actually supplied; `undefined` means "not in the file". */
function pick(flat: unknown, nested: unknown): unknown {
  return flat !== undefined ? flat : nested
}

/**
 * A CSV cell is always a string; a JSON field may already be typed. Both end
 * up in the shape `coerceBase` and `coerceTranslation` expect.
 */
function normalise(field: FieldSpec, value: unknown): unknown {
  if (field.kind === 'stringList') {
    if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
    if (typeof value !== 'string') return []
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
  if (field.kind === 'boolean') {
    if (typeof value === 'boolean') return value
    return typeof value === 'string' && ['true', '1', 'yes'].includes(value.toLowerCase())
  }
  return value
}

function parseJsonRecords(text: string): Array<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw validationFailed([
      { field: 'file', code: 'invalid', message: 'That is not valid JSON.' },
    ])
  }
  if (!Array.isArray(parsed)) {
    throw validationFailed([
      {
        field: 'file',
        code: 'invalid',
        message: 'The JSON must be an array of records.',
      },
    ])
  }
  return parsed.filter(isRecord)
}

/**
 * Turns a file into rows the editor would accept.
 *
 * Only declared columns are read. A spreadsheet that has grown a "notes for
 * me" column still imports; an unrecognised column is not an error, because
 * refusing the whole file over one would send the author back to a 60-column
 * sheet with no idea which cell to look at.
 */
export function parseRows(
  resourceKey: ResourceKey,
  format: TransferFormat,
  text: string,
): ParsedRow[] {
  const schema = FORM_SCHEMAS[resourceKey]

  const records: Array<Record<string, unknown>> =
    format === 'json' ? parseJsonRecords(text) : parseCsvRecords(text)

  return records.map((record, index) => {
    const base: Record<string, unknown> = {}
    const translations: Record<string, Record<string, unknown>> = {}

    // A JSON export nests; a CSV flattens. Accept either shape from either
    // format, so a hand-written file is not rejected on a technicality.
    const nestedBase = isRecord(record.base) ? record.base : {}
    const nestedTranslations = isRecord(record.translations) ? record.translations : {}

    for (const field of schema.base) {
      const value = pick(record[field.name], nestedBase[field.name])
      if (value !== undefined) base[field.name] = normalise(field, value)
    }

    for (const locale of LOCALES) {
      const values: Record<string, unknown> = {}
      const nested = isRecord(nestedTranslations[locale])
        ? (nestedTranslations[locale] as Record<string, unknown>)
        : {}

      for (const field of schema.translated) {
        const value = pick(record[localeColumn(locale, field.name)], nested[field.name])
        if (value !== undefined) values[field.name] = normalise(field, value)
      }

      if (Object.keys(values).length > 0) translations[locale] = values
    }

    const rawId = record.id
    const id = typeof rawId === 'string' && rawId.trim().length > 0 ? rawId.trim() : null

    return { line: index + 2, id, base, translations }
  })
}

/** Merges a row over what is already stored, so absent columns change nothing. */
function mergeOver(existing: RecordShape, row: ParsedRow): RecordShape {
  const translations: Record<string, Record<string, unknown>> = {}

  for (const locale of LOCALES) {
    const incoming = row.translations[locale]
    const stored = existing.translations[locale] ?? {}
    // Only send locales the file mentions or the record already has, so an
    // untouched language is not rewritten as a row full of nulls.
    if (incoming) translations[locale] = { ...stored, ...incoming }
    else if (Object.keys(stored).length > 0) translations[locale] = stored
  }

  return { base: { ...existing.base, ...row.base }, translations }
}

function deriveSlug(payload: RecordShape, titleField: string): string {
  const raw = typeof payload.base.slug === 'string' ? payload.base.slug : ''
  const title = payload.translations[DEFAULT_LOCALE]?.[titleField]
  return raw.trim().length > 0
    ? slugify(raw)
    : slugify(typeof title === 'string' ? title : '')
}

function assertImportable(payload: RecordShape, titleField: string, slug: string): void {
  const title = payload.translations[DEFAULT_LOCALE]?.[titleField]
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw validationFailed([
      {
        field: `${DEFAULT_LOCALE}.${titleField}`,
        code: 'required',
        message: `The ${DEFAULT_LOCALE} title is required — it is the source every translation is measured against.`,
      },
    ])
  }
  if (!slug || !isValidSlug(slug)) {
    throw validationFailed([
      {
        field: 'slug',
        code: 'invalid',
        message: 'Enter a valid slug, or a title to derive one from.',
      },
    ])
  }
}

/** An explicit id wins; otherwise the slug identifies an existing record. */
async function resolveId(
  resourceKey: ResourceKey,
  row: ParsedRow,
  rawSlug: string,
): Promise<string | null> {
  const definition = RESOURCES[resourceKey]

  if (row.id) {
    const byId = await definition
      .delegate()
      .findFirst({ where: { id: row.id }, select: { id: true } })
    if (byId) return String(byId.id)
    // An id matching nothing is a mistake worth naming, not a new record to
    // create under an id the database would ignore anyway.
    throw validationFailed([
      { field: 'id', code: 'not_found', message: `No record with id ${row.id}.` },
    ])
  }

  if (rawSlug.trim().length === 0) return null

  const bySlug = await definition
    .delegate()
    .findFirst({ where: { slug: slugify(rawSlug) }, select: { id: true } })
  return bySlug ? String(bySlug.id) : null
}

async function assertSlugFree(
  resourceKey: ResourceKey,
  slug: string,
  exceptId: string | null,
): Promise<void> {
  const clash = await RESOURCES[resourceKey].delegate().findFirst({
    where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  })
  if (clash) {
    throw validationFailed([
      {
        field: 'slug',
        code: 'conflict',
        message: 'Another record already uses that slug.',
      },
    ])
  }
}

export async function importResource(
  actor: Actor,
  input: {
    resourceKey: ResourceKey
    format: TransferFormat
    text: string
    dryRun: boolean
  },
): Promise<ImportReport> {
  const definition = RESOURCES[input.resourceKey]
  const schema = FORM_SCHEMAS[input.resourceKey]

  // Both capabilities: an import creates and updates content, so holding
  // `import.run` without the content rights would be a way around them.
  await authorize(actor, 'import.run', { entityType: definition.entityType })
  await authorize(actor, 'content.update', { entityType: definition.entityType })

  const rows = parseRows(input.resourceKey, input.format, input.text)

  const report: ImportReport = {
    dryRun: input.dryRun,
    resourceKey: input.resourceKey,
    total: rows.length,
    created: 0,
    updated: 0,
    failed: 0,
    rows: [],
  }

  for (const row of rows) {
    const rawSlug = typeof row.base.slug === 'string' ? row.base.slug : ''
    const rawTitle = row.translations[DEFAULT_LOCALE]?.[schema.titleField]
    const title = typeof rawTitle === 'string' ? rawTitle : null

    try {
      const existingId = await resolveId(input.resourceKey, row, rawSlug)
      const isUpdate = existingId !== null

      const payload = isUpdate
        ? mergeOver(await loadRecord(actor, input.resourceKey, existingId), row)
        : { base: row.base, translations: row.translations }

      const slug = deriveSlug(payload, schema.titleField)

      if (input.dryRun) {
        // Everything that can be checked without writing is checked, so a
        // preview reading "12 updates, no errors" means exactly that.
        assertImportable(payload, schema.titleField, slug)
        await assertSlugFree(input.resourceKey, slug, existingId)
      } else {
        await saveRecord(actor, {
          resourceKey: input.resourceKey,
          id: existingId,
          base: payload.base,
          translations: payload.translations,
        })
      }

      if (isUpdate) report.updated += 1
      else report.created += 1

      report.rows.push({
        line: row.line,
        action: isUpdate ? 'update' : 'create',
        slug,
        title,
      })
    } catch (error) {
      // One bad row does not stop the file. Bulk editing is iterative, and an
      // all-or-nothing import means fixing sixty rows one failure at a time.
      report.failed += 1
      report.rows.push({
        line: row.line,
        action: 'error',
        slug: rawSlug || null,
        title,
        message: isAppError(error)
          ? (error.details?.[0]?.message ?? error.message)
          : 'Could not import this row.',
      })
    }
  }

  // A dry run is a read. Auditing it as a change would make the log lie about
  // what happened to the content.
  if (!input.dryRun) {
    await auditTransfer(actor, 'import', input.resourceKey, report.total, {
      created: report.created,
      updated: report.updated,
      failed: report.failed,
      format: input.format,
    })
  }

  return report
}

async function auditTransfer(
  actor: Actor,
  verb: 'export' | 'import',
  resourceKey: ResourceKey,
  rowCount: number,
  detail: Record<string, unknown>,
): Promise<void> {
  const definition = RESOURCES[resourceKey]
  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: `${verb}.${resourceKey}`,
    entityType: definition.entityType,
    entityLabel: `${rowCount} ${rowCount === 1 ? definition.label : definition.labelPlural}`,
    after: { rowCount, ...detail },
    context: {
      ip: 'ip' in actor ? actor.ip : null,
      userAgent: 'userAgent' in actor ? actor.userAgent : null,
      requestId: actor.requestId,
    },
  })
}

/** Row counts per type, so the screen can say what an export would contain. */
export async function transferCounts(actor: Actor): Promise<Record<ResourceKey, number>> {
  await authorize(actor, 'export.run', {})

  const entries = await Promise.all(
    (Object.keys(RESOURCES) as ResourceKey[]).map(async (key) => {
      const count = await RESOURCES[key]
        .delegate()
        .count({})
        .catch(() => 0)
      return [key, count] as const
    }),
  )

  return Object.fromEntries(entries) as Record<ResourceKey, number>
}
