import { notFound } from 'next/navigation'
import { getActor } from '@/server/auth/context'
import { hasCapability, requireCapability } from '@/server/auth/guard'
import { loadRecord, blankRecord } from '@/server/modules/admin/editor-service'
import { FORM_SCHEMAS } from '@/server/modules/admin/form-schema'
import { RESOURCES, type ResourceKey } from '@/server/modules/admin/resources'
import { LOCALE_ORDER, LOCALE_DESCRIPTORS, DEFAULT_LOCALE } from '@/i18n/config'
import { isAppError } from '@/lib/errors'
import { AdminPageHeader } from './page-header'
import { RecordEditor } from './record-editor'

/**
 * Server half of the content editor: loads the record (or an empty one) and
 * hands it to the client form. Used by every content type.
 */
export async function ResourceEditor({
  resourceKey,
  id,
}: {
  resourceKey: ResourceKey
  id: string | null
}) {
  const definition = RESOURCES[resourceKey]
  const schema = FORM_SCHEMAS[resourceKey]
  const actor = await getActor()

  await requireCapability(actor, id === null ? 'content.create' : 'content.read')

  let record
  if (id === null) {
    record = blankRecord(resourceKey)
  } else {
    try {
      record = await loadRecord(actor, resourceKey, id)
    } catch (error) {
      if (isAppError(error) && error.code === 'NOT_FOUND') notFound()
      throw error
    }
  }

  const canEdit = hasCapability(actor, id === null ? 'content.create' : 'content.update')

  const localeNames = Object.fromEntries(
    LOCALE_ORDER.map((locale) => [locale, LOCALE_DESCRIPTORS[locale].nativeName]),
  )

  const title =
    id === null
      ? `New ${definition.label.toLowerCase()}`
      : ((record.translations[DEFAULT_LOCALE]?.[schema.titleField] as
          string | undefined) ??
        (record.base.slug as string | undefined) ??
        definition.label)

  return (
    <>
      <AdminPageHeader
        title={title}
        breadcrumb={{ label: definition.labelPlural, href: `/admin/${definition.path}` }}
        {...(canEdit
          ? {}
          : { description: 'Your account is read-only. This record cannot be changed.' })}
      />

      <RecordEditor
        record={record}
        schema={schema}
        locales={LOCALE_ORDER}
        localeNames={localeNames}
        sourceLocale={DEFAULT_LOCALE}
        canEdit={canEdit}
        listHref={`/admin/${definition.path}`}
        resourceLabel={definition.labelPlural}
      />
    </>
  )
}
