import { getActor } from '@/server/auth/context'
import { getMenuEditorData } from '@/server/modules/navigation/menu-admin'
import { MenuEditor } from '@/components/admin/menu-editor'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const actor = await getActor()
  const data = await getMenuEditorData(actor)

  return <MenuEditor data={data} canManage={actor.capabilities.has('menu.manage')} />
}
