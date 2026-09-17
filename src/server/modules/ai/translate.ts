import { authorize } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/security/audit'
import { conflict, notFound } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { LOCALES, LOCALE_DESCRIPTORS, DEFAULT_LOCALE, type Locale } from '@/i18n/config'
import { RESOURCES, type ResourceKey } from '@/server/modules/admin/resources'
import { FORM_SCHEMAS } from '@/server/modules/admin/form-schema'
import { loadRecord, upsertTranslation } from '@/server/modules/admin/editor-service'
import { complete, parseJsonReply } from '@/server/ai/complete'
import { richTextToPlainText, plainTextDocument } from '@/lib/rich-text'
import type { FieldSpec } from '@/server/modules/admin/form-schema'

/**
 * Machine translation of a content record (§27).
 *
 * The point of this feature is not to produce final copy. It is to turn the
 * blank Russian, Uzbek and Chinese tabs of a newly written record into
 * something an editor can correct in two minutes instead of write in twenty.
 * Everything it writes is marked `AI_DRAFT` with origin `AI`, which is what
 * keeps it out of the public site until a person approves it — and what makes
 * the translation matrix tell the truth about how much of the site is really
 * finished.
 *
 * The source language is whatever `DEFAULT_LOCALE` says — the same language
 * the `sourceHash` is computed from — so a translation produced here is
 * measured against exactly the text it was made from.
 */

const SOURCE_LOCALE: Locale = DEFAULT_LOCALE

/** Fields worth sending to a model. Slugs, codes and numbers are not prose. */
const TRANSLATABLE_KINDS = new Set(['text', 'textarea', 'richtext'])

function translatableFields(fields: FieldSpec[]): FieldSpec[] {
  return fields.filter(
    (field) => TRANSLATABLE_KINDS.has(field.kind) && field.name !== 'slug',
  )
}

export interface TranslationOutcome {
  locale: Locale
  fields: string[]
}

export interface TranslateResult {
  translated: TranslationOutcome[]
  skipped: Locale[]
  costMicros: number
  /**
   * What was written, shaped the way the editor holds it — rich text as
   * paragraphs, not as a document.
   *
   * The drafts are already in the database by the time this returns, but the
   * form on screen was built before the call and has no way to know. Handing
   * the values back lets it show them without a round trip, and without the
   * editor's unsaved-changes guard mistaking freshly saved drafts for edits
   * that still need saving.
   */
  values: Record<string, Record<string, unknown>>
}

/**
 * Reads a field for the prompt.
 *
 * Rich text is flattened to paragraphs and rebuilt afterwards. Sending the
 * document structure to a model and asking for it back invites malformed JSON
 * that has to be rejected wholesale; the paragraphs are what carry the meaning,
 * and an editor restores emphasis far more cheaply than they retype a page.
 */
function readField(field: FieldSpec, value: unknown): string {
  if (field.kind === 'richtext') return richTextToPlainText(value)
  return typeof value === 'string' ? value : ''
}

function writeField(field: FieldSpec, text: string): unknown {
  if (field.kind === 'richtext') return text.trim() ? plainTextDocument(text) : null
  return text
}

export async function translateRecord(
  actor: Actor,
  input: { resourceKey: ResourceKey; id: string; targetLocales?: Locale[] },
): Promise<TranslateResult> {
  const definition = RESOURCES[input.resourceKey]
  await authorize(actor, 'translation.ai.run', {
    entityType: definition.entityType,
    entityId: input.id,
  })

  const schema = FORM_SCHEMAS[input.resourceKey]
  const fields = translatableFields(schema.translated)
  if (fields.length === 0) {
    throw conflict('This content type has nothing to translate.')
  }

  const record = await loadRecord(actor, input.resourceKey, input.id)
  if (!record.id) throw notFound('Record not found.')

  const source: Record<string, string> = {}
  for (const field of fields) {
    const text = readField(field, record.translations[SOURCE_LOCALE]?.[field.name])
    if (text.trim()) source[field.name] = text
  }

  if (Object.keys(source).length === 0) {
    throw conflict(
      `There is no ${LOCALE_DESCRIPTORS[SOURCE_LOCALE].englishName} text to translate from. ` +
        'Write the source language first.',
    )
  }

  const targets = (input.targetLocales ?? LOCALES).filter(
    (locale) => locale !== SOURCE_LOCALE,
  )
  if (targets.length === 0) throw conflict('Choose at least one target language.')

  const translated: TranslationOutcome[] = []
  const skipped: Locale[] = []
  const editorValues: Record<string, Record<string, unknown>> = {}
  let costMicros = 0

  // One request per language rather than one for all of them. A single call
  // asking for four languages is cheaper, but when the model drops a language
  // or malforms one branch of the JSON, the whole batch is lost — and the
  // failure mode of "three languages arrived, one did not" is far easier to
  // recover from than "the reply could not be parsed".
  for (const locale of targets) {
    const descriptor = LOCALE_DESCRIPTORS[locale]

    try {
      const result = await complete(
        {
          temperature: 0,
          json: true,
          maxOutputTokens: 4096,
          messages: [
            {
              role: 'system',
              content: [
                `You translate website content for a dental equipment supplier into ${descriptor.englishName}.`,
                'Rules:',
                '- Reply with a JSON object only. Use exactly the keys you are given.',
                '- Translate the values. Never translate the keys.',
                '- Keep product names, brand names, model numbers and units unchanged.',
                '- Preserve paragraph breaks exactly as blank lines.',
                '- Match the register of the source: plain, professional, not promotional.',
                '- If a value cannot be translated, repeat it unchanged rather than omitting the key.',
              ].join('\n'),
            },
            { role: 'user', content: JSON.stringify(source, null, 2) },
          ],
        },
        {
          taskType: 'TRANSLATE',
          route: 'translate',
          surface: 'admin',
          userId: actorId(actor) ?? undefined,
          locale,
          entityType: definition.entityType,
          entityId: record.id,
        },
      )

      costMicros += result.costMicros

      const parsed = parseJsonReply<Record<string, unknown>>(result.text)
      if (!parsed) {
        logger.warn(
          { locale, resource: input.resourceKey },
          'AI translation was not JSON',
        )
        skipped.push(locale)
        continue
      }

      const values: Record<string, unknown> = {}
      const forEditor: Record<string, unknown> = {}
      const written: string[] = []
      for (const field of fields) {
        const value = parsed[field.name]
        if (typeof value !== 'string' || !value.trim()) continue
        values[field.name] = writeField(field, value)
        // The editor edits rich text as paragraphs, so it gets the plain
        // string rather than the document that was stored.
        forEditor[field.name] = value
        written.push(field.name)
      }

      if (written.length === 0) {
        skipped.push(locale)
        continue
      }

      await upsertTranslation(input.resourceKey, record.id, locale, {
        ...values,
        // AI_DRAFT is what keeps this off the public site until someone
        // approves it, unless the operator has explicitly opted into
        // publishing drafts in Settings.
        status: 'AI_DRAFT',
        origin: 'AI',
      })

      editorValues[locale] = forEditor
      translated.push({ locale, fields: written })
    } catch (error) {
      // One language failing must not discard the ones that succeeded. A
      // budget stop or an unconfigured provider, though, will fail every
      // language identically, so it is re-thrown on the first attempt rather
      // than repeated three more times.
      if (translated.length === 0 && skipped.length === 0) throw error
      logger.warn({ err: error, locale }, 'AI translation failed for one locale')
      skipped.push(locale)
    }
  }

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: `${input.resourceKey}.translated`,
    entityType: definition.entityType,
    entityId: record.id,
    entityLabel: String(record.translations[SOURCE_LOCALE]?.[schema.titleField] ?? ''),
    after: {
      translated: translated.map((entry) => entry.locale),
      skipped,
      costMicros,
    },
  })

  return { translated, skipped, costMicros, values: editorValues }
}
