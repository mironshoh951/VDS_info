import { ResourceEditor } from '@/components/admin/resource-editor'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ResourceEditor resourceKey="event" id={id} />
}
