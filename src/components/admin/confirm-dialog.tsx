'use client'

import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Button } from '@/components/ui'

/**
 * Ordinary (non-destructive) confirmation.
 *
 * Uses `AlertDialog` rather than `Dialog`: the role and focus behaviour differ,
 * and a screen reader should announce this as an alert that interrupts, not as
 * a panel the user opened.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-subtle)] bg-white p-6 shadow-xl">
          <AlertDialog.Title className="text-base font-semibold text-neutral-900">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-neutral-600">
            {description}
          </AlertDialog.Description>

          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={destructive ? 'danger' : 'primary'}
                onClick={() => void onConfirm()}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
