import { db } from '@/server/db/client'
import { AlertTriangle } from 'lucide-react'

/**
 * Warns that development seed data is present.
 *
 * Seeded partners, brands and products are fictional. Shipping them to a live
 * site would misrepresent the business, so the warning stays visible until
 * every seeded record has been removed or replaced — the check is a real
 * count, not a flag someone can forget to unset.
 */
export async function DemoDataBanner() {
  const seeded = await db.siteSetting
    .findUnique({
      where: { namespace_key: { namespace: 'site.general', key: 'demoContent' } },
      select: { value: true },
    })
    .catch(() => null)

  if (seeded?.value !== true) return null

  return (
    <div
      role="status"
      className="border-warning-500/30 bg-warning-50 text-warning-700 flex items-start gap-3 border-b px-4 py-3 text-sm lg:px-8"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <strong className="font-semibold">Development data is loaded.</strong> Every
        partner, brand and product is fictional and must be replaced before this site goes
        live. Clear this notice in Settings once real content is in place.
      </p>
    </div>
  )
}
