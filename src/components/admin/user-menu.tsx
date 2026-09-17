'use client'

import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useTranslations } from 'next-intl'
import { ChevronDown, LogOut, ExternalLink, ShieldAlert } from 'lucide-react'

/**
 * Account menu.
 *
 * Signing out is a form submission rather than a link: it changes server state
 * and must not be triggered by a prefetch or a crawler.
 */
export function UserMenu({
  name,
  email,
  role,
  signOut,
  siteUrl,
}: {
  name: string
  email: string
  role: string
  signOut: () => Promise<void>
  siteUrl: string
}) {
  const t = useTranslations('admin.shell')
  const tNav = useTranslations('admin.nav')

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
        <span className="bg-primary-100 text-primary-800 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block leading-tight font-medium text-neutral-800">{name}</span>
          <span className="text-2xs block leading-tight text-neutral-500">{role}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 rounded-lg border border-[var(--border-subtle)] bg-white p-1.5 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-neutral-900">{name}</p>
            <p className="truncate text-xs text-neutral-500">{email}</p>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />

          <DropdownMenu.Item asChild>
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 outline-none data-highlighted:bg-neutral-100"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t('viewSite')}
            </a>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href="/admin/security"
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 outline-none data-highlighted:bg-neutral-100"
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              {tNav('security')}
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />

          <DropdownMenu.Item asChild>
            <form action={signOut}>
              <button
                type="submit"
                className="text-danger-700 data-highlighted:bg-danger-50 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {t('signOut')}
              </button>
            </form>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
