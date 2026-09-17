import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import { preparePage } from '@/server/modules/shared/page-context'
import { listServices } from '@/server/modules/catalog/directory-queries'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { PageHeader } from '@/components/site/page-header'
import { Card, CardBody } from '@/components/ui'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const tNav = await getTranslations({ locale, namespace: 'nav' })
  return buildMetadata({
    locale: locale as never,
    path: 'services',
    title: tNav('services'),
  })
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale, context } = await preparePage(params)

  const [services, tNav, tFilters] = await Promise.all([
    listServices(context),
    getTranslations('nav'),
    getTranslations('filters'),
  ])

  return (
    <>
      <PageHeader
        title={tNav('services')}
        crumbs={[
          { label: tNav('home'), href: `/${locale}` },
          { label: tNav('services') },
        ]}
      />

      <div className="content-container py-10 md:py-14">
        {services.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-16 text-center text-sm text-neutral-600">
            {tFilters('noResults')}
          </p>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <li key={service.id} className="flex">
                <Card interactive className="w-full">
                  <CardBody className="gap-3 p-6">
                    <h2 className="text-lg font-semibold text-neutral-900">
                      <Link
                        href={service.href}
                        className="hover:text-primary-800 after:absolute after:inset-0"
                      >
                        {service.name}
                      </Link>
                    </h2>
                    {service.shortDescription && (
                      <p className="text-sm leading-relaxed text-neutral-600">
                        {service.shortDescription}
                      </p>
                    )}
                    <span className="text-primary-700 mt-2 inline-flex items-center gap-1.5 text-sm font-medium">
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
