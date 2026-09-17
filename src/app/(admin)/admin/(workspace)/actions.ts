'use server'

import { redirect } from 'next/navigation'
import { getActor } from '@/server/auth/context'
import { logout } from '@/server/auth/logout'

export async function signOutAction(): Promise<void> {
  const actor = await getActor()
  await logout(actor)
  redirect('/admin/login')
}
