import { getActor } from '@/server/auth/context'
import { listCategories } from '@/server/modules/catalog/categories'
import { CategoryManager } from '@/components/admin/category-manager'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const actor = await getActor()
  const trees = await listCategories(actor)

  return (
    <CategoryManager
      trees={trees}
      canEdit={actor.capabilities.has('content.update')}
      canDelete={actor.capabilities.has('content.delete.soft')}
    />
  )
}
