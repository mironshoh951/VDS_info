import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui'

export default async function NotFound() {
  const t = await getTranslations('errors')

  return (
    <div className="content-container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-primary-600 text-sm font-semibold tracking-[0.12em] uppercase">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-neutral-900">
        {t('notFoundTitle')}
      </h1>
      <p className="mt-4 max-w-md text-neutral-600">{t('notFoundDescription')}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t('notFoundTitle')}</Link>
      </Button>
    </div>
  )
}
