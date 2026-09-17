'use client'

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ShieldAlert, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { requestStepUpAction } from '@/app/(admin)/admin/(workspace)/content-actions'

/**
 * Password confirmation for destructive actions (§7).
 *
 * The dialog does not perform the action. It exchanges the password for a
 * short-lived, single-use, scope-bound token and hands it back to the caller,
 * which then retries the action carrying that token. Keeping the two steps
 * separate is what makes a confirmation impossible to replay against a
 * different action.
 */
export function StepUpDialog({
  open,
  onOpenChange,
  scope,
  mfaRequired,
  title,
  warning,
  confirmLabel,
  onConfirmed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: string
  mfaRequired: boolean
  title: string
  warning: string
  confirmLabel: string
  onConfirmed: (token: string) => void | Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await requestStepUpAction({
        scope,
        password,
        ...(totpCode ? { totpCode } : {}),
      })

      if (!result.ok || !result.token) {
        setError(result.message ?? 'Confirmation failed.')
        return
      }

      setPassword('')
      setTotpCode('')
      onOpenChange(false)
      await onConfirmed(result.token)
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-subtle)] bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-start gap-3">
            <span className="bg-danger-50 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <ShieldAlert className="text-danger-700 h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <Dialog.Title className="text-base font-semibold text-neutral-900">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-neutral-600">
                {warning}
              </Dialog.Description>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                htmlFor="step-up-password"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Confirm your password
              </label>
              <input
                id="step-up-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-md border border-neutral-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              />
            </div>

            {mfaRequired && (
              <div>
                <label
                  htmlFor="step-up-totp"
                  className="mb-1.5 block text-sm font-medium text-neutral-700"
                >
                  Verification code
                </label>
                <input
                  id="step-up-totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={12}
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  className="h-11 w-full rounded-md border border-neutral-300 px-3 font-mono text-sm tracking-[0.25em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                />
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="border-danger-500/30 bg-danger-50 text-danger-700 flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" variant="danger" disabled={pending || !password}>
                {pending ? 'Confirming…' : confirmLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
