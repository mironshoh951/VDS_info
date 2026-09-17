'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui'

/**
 * Public error boundary.
 *
 * Shows the request digest and nothing else. Stack traces and messages stay
 * server-side, where they are logged against the same identifier (§87).
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')

  useEffect(() => {
    // The server already logged the detail; this records that the user saw it.
    console.error('render error', error.digest)
  }, [error])

  return (
    <div className="content-container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">{t('title')}</h1>
      <p className="mt-4 max-w-md text-neutral-600">{t('description')}</p>
      {error.digest && (
        <p className="mt-6 font-mono text-xs text-neutral-400">
          {t('reference', { requestId: error.digest })}
        </p>
      )}
      <Button className="mt-8" onClick={reset}>
        {t('title')}
      </Button>
    </div>
  )
}
