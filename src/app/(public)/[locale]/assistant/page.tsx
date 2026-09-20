import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { preparePage } from '@/server/modules/shared/page-context'
import { isAssistantEnabled } from '@/server/modules/ai/assistant'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { PageHeader } from '@/components/site/page-header'
import { AssistantChat } from '@/components/site/assistant-chat'

/**
 * The assistant page.
 *
 * Dynamic, and 404 when the feature is off. A disabled assistant should not be
 * a page that loads and then apologises — if the operator has not turned it on,
 * the URL simply is not part of this site.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'assistant' })

  return buildMetadata({
    locale: locale as never,
    path: 'assistant',
    title: t('title'),
    description: t('intro'),
    // Not indexed: the page is a tool, and its useful content already lives on
    // the catalogue pages the assistant points at.
    noindex: true,
  })
}

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await preparePage(params)

  if (!(await isAssistantEnabled())) notFound()

  const t = await getTranslations('assistant')

  return (
    <>
      <PageHeader title={t('title')} description={t('intro')} />

      <section className="pb-16">
        <AssistantChat
          locale={locale}
          contactHref={`/${locale}/contact`}
          suggestions={[t('suggestion1'), t('suggestion2'), t('suggestion3')]}
        />
      </section>
    </>
  )
}
