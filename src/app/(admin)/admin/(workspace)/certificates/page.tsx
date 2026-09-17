import { ResourceList } from '@/components/admin/resource-list'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <ResourceList
      resourceKey="certificate"
      searchParams={await searchParams}
      description="Certificates, licences and quality documentation."
    />
  )
}
