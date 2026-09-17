import { redirect } from 'next/navigation'
import { getActor } from '@/server/auth/context'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

/**
 * Sign-in screen.
 *
 * Reachable only on the administration host; the public host returns 404 for
 * anything under this prefix (see middleware). Nothing on the public website
 * links here (§4, §81).
 */
export default async function LoginPage() {
  const actor = await getActor()
  if (actor.kind === 'user' && actor.capabilities.size > 0) {
    redirect('/admin/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-white p-8 shadow-sm">
        <LoginForm />
      </div>
    </div>
  )
}
