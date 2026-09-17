import { getActor } from '@/server/auth/context'
import { getAdminLocale } from '@/server/admin/locale'
import { listMedia } from '@/server/modules/media/service'
import { MediaLibrary } from '@/components/admin/media-library'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value

  const [actor, locale] = await Promise.all([getActor(), getAdminLocale()])

  const page = Number.parseInt(first(params.page) ?? '1', 10)
  const result = await listMedia(actor, {
    query: first(params.q),
    kind: first(params.kind),
    page: Number.isFinite(page) ? page : 1,
    locale,
  })

  return (
    <MediaLibrary
      result={result}
      canUpload={actor.capabilities.has('media.upload')}
      canDelete={actor.capabilities.has('media.delete')}
      mfaRequired={actor.kind === 'user' ? actor.mfaSatisfied : false}
      filters={{ query: first(params.q) ?? '', kind: first(params.kind) ?? '' }}
    />
  )
}
