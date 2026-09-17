import { redirect } from 'next/navigation'
import { getActor } from '@/server/auth/context'

export const dynamic = 'force-dynamic'

export default async function AdminRoot() {
  const actor = await getActor()
  redirect(actor.kind === 'user' ? '/admin/dashboard' : '/admin/login')
}
