import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActor } from '@/server/auth/context'
import { db } from '@/server/db/client'
import { getSettings } from '@/server/modules/settings/service'
import { AdminSidebar } from '@/components/admin/sidebar'
import { UserMenu } from '@/components/admin/user-menu'
import { DemoDataBanner } from '@/components/admin/demo-banner'
import { AdminLocaleSwitcher } from '@/components/admin/locale-switcher'
import { AdminThemeSwitcher } from '@/components/admin/theme-switcher'
import { getAdminTheme } from '@/server/admin/theme'
import { getAdminIntl } from '@/server/admin/locale'
import { signOutAction } from './actions'
import { setAdminLocaleAction } from './locale-actions'
import { setAdminThemeAction } from './theme-actions'

/**
 * Authenticated administration shell.
 *
 * The gate is here rather than in each page: a new admin page added under this
 * folder is protected by construction, which is the only way a surface this
 * large stays safe as it grows.
 */
export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const actor = await getActor()

  // An MFA-enrolled user who has not completed the challenge holds no
  // capabilities, so this also catches a half-finished sign-in.
  if (actor.kind !== 'user' || actor.capabilities.size === 0) {
    redirect('/admin/login')
  }

  const [{ locale, shell }, theme] = await Promise.all([getAdminIntl(), getAdminTheme()])

  const [inquiries, general] = await Promise.all([
    db.inquiry.count({ where: { status: 'NEW' } }).catch(() => 0),
    getSettings('site.general'),
  ])

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  return (
    <div className="flex min-h-screen bg-[var(--surface-subtle)]">
      {/*
        A column, not a block. The brand bar and the navigation share one
        screen-height box: as a block the nav's own `h-full` resolved to the
        full 100vh *below* the 56px bar, so the list ran past the bottom of the
        window and its last few items could not be reached at all.
      */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-white lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-[var(--border-subtle)] px-5">
          <Link
            href="/admin/dashboard"
            className="text-primary-900 truncate text-sm font-semibold"
          >
            {general.siteName || shell.navigation}
          </Link>
        </div>
        <AdminSidebar capabilities={[...actor.capabilities]} counts={{ inquiries }} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-white px-4 lg:px-6">
          <Link
            href="/admin/dashboard"
            className="text-primary-900 text-sm font-semibold lg:hidden"
          >
            {general.siteName || shell.navigation}
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <AdminThemeSwitcher current={theme} action={setAdminThemeAction} />
            <AdminLocaleSwitcher current={locale} action={setAdminLocaleAction} />
            <UserMenu
              name={actor.name}
              email={actor.email}
              role={actor.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Viewer'}
              signOut={signOutAction}
              siteUrl={siteUrl}
            />
          </div>
        </header>

        <DemoDataBanner />

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
