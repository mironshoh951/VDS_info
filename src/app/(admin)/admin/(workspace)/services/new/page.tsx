import { ResourceEditor } from '@/components/admin/resource-editor'

export const dynamic = 'force-dynamic'

export default async function Page() {
  return <ResourceEditor resourceKey="service" id={null} />
}
