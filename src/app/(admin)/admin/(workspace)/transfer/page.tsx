import { getActor } from '@/server/auth/context'
import { transferCounts } from '@/server/modules/admin/transfer'
import { RESOURCES, RESOURCE_KEYS } from '@/server/modules/admin/resources'
import { AdminPageHeader } from '@/components/admin/page-header'
import { TransferPanel } from '@/components/admin/transfer-panel'

export const dynamic = 'force-dynamic'

/**
 * Bulk import and export.
 *
 * One screen for every content type rather than a button on each list, because
 * the useful mental model is "move content in and out", not "products have an
 * export". The row counts are loaded here so the page can say what an export
 * would actually contain before anyone downloads it.
 */
export default async function TransferPage() {
  const actor = await getActor()
  const counts = await transferCounts(actor)

  const resources = RESOURCE_KEYS.map((key) => ({
    key,
    label: RESOURCES[key].labelPlural,
    count: counts[key] ?? 0,
  }))

  return (
    <>
      <AdminPageHeader
        title="Import and export"
        description="Move content in and out as a spreadsheet. Exports carry every language; imports go through the same rules as the editor, and never publish anything."
      />

      <TransferPanel
        resources={resources}
        canImport={actor.kind === 'user' && actor.capabilities.has('import.run')}
      />
    </>
  )
}
