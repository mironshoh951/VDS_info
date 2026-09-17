import { getActor } from '@/server/auth/context'
import { requireCapability, hasCapability } from '@/server/auth/guard'
import { listUsers } from '@/server/modules/admin/users'
import { AdminPageHeader } from '@/components/admin/page-header'
import { UserTable } from '@/components/admin/user-table'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const actor = await getActor()
  await requireCapability(actor, 'user.read')

  const [users, canManage] = [await listUsers(actor), hasCapability(actor, 'user.manage')]

  return (
    <>
      <AdminPageHeader
        title="Users"
        description="Two roles only: Super Admin can change everything, Viewer can read. Changing an account requires password confirmation."
      />
      <UserTable users={users} canManage={canManage} />
    </>
  )
}
