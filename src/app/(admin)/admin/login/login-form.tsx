'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui'
import { loginAction, verifyMfaAction, type LoginFormState } from './actions'

const initialState: LoginFormState = { status: 'idle' }

/**
 * Sign-in form.
 *
 * Two steps in one component so the transition to MFA does not lose the
 * session that was just established. Errors are announced via `role="alert"`
 * so a screen-reader user hears them without re-reading the form.
 *
 * It reads its language from the same admin locale cookie as the rest of the
 * panel. Sign-in is the first screen an operator ever sees, so leaving it in
 * English while the panel behind it is in Uzbek would be the one place the
 * interface language setting visibly does not apply.
 */
export function LoginForm() {
  const t = useTranslations('admin.login')
  const [state, formAction] = useActionState(loginAction, initialState)
  const [mfaState, mfaAction] = useActionState(verifyMfaAction, initialState)

  const showMfa = state.status === 'mfa_required' || mfaState.status === 'mfa_required'
  const error = showMfa ? mfaState.message : state.message

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-xl font-semibold text-neutral-900">
        {showMfa ? t('mfaTitle') : t('title')}
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        {showMfa ? t('mfaSubtitle') : t('subtitle')}
      </p>

      {error && (
        <div
          role="alert"
          className="border-danger-500/30 bg-danger-50 text-danger-700 mt-5 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {showMfa ? (
        <form action={mfaAction} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="code"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              {t('code')}
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={12}
              className="h-11 w-full rounded-md border border-neutral-300 px-3 font-mono text-base tracking-[0.3em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            />
          </div>
          <SubmitButton label={t('verify')} pendingLabel={t('verifying')} />
        </form>
      ) : (
        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              {t('email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              className="h-11 w-full rounded-md border border-neutral-300 px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-md border border-neutral-300 px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            />
          </div>
          <SubmitButton label={t('submit')} pendingLabel={t('submitting')} />
        </form>
      )}
    </div>
  )
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" block size="lg" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  )
}
