'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import type { NavigationItem } from '@/server/modules/navigation/service'

/**
 * Mobile navigation.
 *
 * Radix Dialog handles the parts that are easy to get wrong by hand: focus
 * trapping, restoring focus to the trigger on close, `aria-modal`, Escape
 * handling and inert background content.
 */
export function MobileNav({
  items,
  menuLabel,
  closeLabel,
}: {
  items: NavigationItem[]
  menuLabel: string
  closeLabel: string
}) {
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] lg:hidden"
        aria-label={menuLabel}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-neutral-900">
              {menuLabel}
            </Dialog.Title>
            <Dialog.Close
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
              aria-label={closeLabel}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <MobileLink item={item} onNavigate={() => setOpen(false)} />
                  {item.children.length > 0 && (
                    <ul className="mt-1 ml-3 space-y-1 border-l border-[var(--border-subtle)] pl-3">
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <MobileLink
                            item={child}
                            onNavigate={() => setOpen(false)}
                            nested
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function MobileLink({
  item,
  onNavigate,
  nested = false,
}: {
  item: NavigationItem
  onNavigate: () => void
  nested?: boolean
}) {
  const className = nested
    ? 'block rounded-md px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50'
    : 'block rounded-md px-3 py-3 text-base font-medium text-neutral-800 hover:bg-neutral-50'

  if (!item.href) return <span className={className}>{item.label}</span>

  return item.external ? (
    <a
      href={item.href}
      className={className}
      onClick={onNavigate}
      {...(item.openInNewTab ? { target: '_blank' } : {})}
      {...(item.rel ? { rel: item.rel } : {})}
    >
      {item.label}
    </a>
  ) : (
    <Link href={item.href} className={className} onClick={onNavigate}>
      {item.label}
    </Link>
  )
}
