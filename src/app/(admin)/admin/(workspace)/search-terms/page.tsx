import { getActor } from '@/server/auth/context'
import { getSearchTerms } from '@/server/modules/analytics/service'
import { SearchTermsScreen } from '@/components/admin/search-terms-screen'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = Array.isArray(params.days) ? params.days[0] : params.days
  const parsed = Number.parseInt(raw ?? '30', 10)
  const days = Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? parsed : 30

  const actor = await getActor()
  const data = await getSearchTerms(actor, days)

  return <SearchTermsScreen data={data} />
}
