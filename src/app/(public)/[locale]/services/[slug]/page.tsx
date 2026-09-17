import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { preparePage } from '@/server/modules/shared/page-context'
import { getServiceBySlug } from '@/server/modules/catalog/directory-queries'
import { listProducts } from '@/server/modules/catalog/queries'
import { getRenderedForm } from '@/server/modules/forms/service'
import {
  buildMetadata,
  metaDescription,
  seoOverride,
} from '@/server/modules/seo/metadata'
import { breadcrumbSchema, faqSchema } from '@/server/modules/seo/structured-data'
import { getLocaleSettings } from '@/server/modules/settings/service'
import { isLocale, type Locale } from '@/i18n/config'
import { richTextToPlainText } from '@/lib/rich-text'
import { PageHeader } from '@/components/site/page-header'
import { EnquiryForm } from '@/components/site/enquiry-form'
import { ProductCardView } from '@/components/cards/product-card'
import { RichText } from '@/components/rich-text/rich-text'
import { JsonLd } from '@/components/site/json-ld'
import { Section, SectionHeader } from '@/components/ui'

export const revalidate = 300

async function load(params: Promise<{ locale: string; slug: string }>) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return null
  const { defaultLocale, publishAiDrafts } = await getLocaleSettings()
  const context = { locale, defaultLocale, publishAiDrafts }
  const service = await getServiceBySlug(slug, context)
  return service ? { service, locale: locale as Locale, context } : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const loaded = await load(params)
  if (!loaded) return {}
  const { service, locale } = loaded
  const override = await seoOverride('SERVICE', service.id, locale)

  return buildMetadata({
    locale,
    path: `services/${service.slug}`,
    title: override?.title ?? service.name,
    description: override?.description ?? metaDescription(service.shortDescription),
    modifiedTime: service.updatedAt,
    ...(override?.noindex ? { noindex: true } : {}),
  })
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, context } = await preparePage(params)
  const loaded = await load(params)
  if (!loaded) notFound()

  const { service } = loaded

  const [tNav, tService, tCards, tCommon, enquiryForm, related] = await Promise.all([
    getTranslations('nav'),
    getTranslations('service'),
    getTranslations('cards'),
    getTranslations('common'),
    getRenderedForm('service-enquiry', context),
    service.relatedProductSlugs.length > 0
      ? listProducts(context, { pageSize: 8 })
      : Promise.resolve(null),
  ])

  const relatedProducts =
    related?.items.filter((product) =>
      service.relatedProductSlugs.includes(product.slug),
    ) ?? []

  const crumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('services'), href: `/${locale}/services` },
    { label: service.name },
  ]

  const faqItems = service.faqs.map((faq) => ({
    question: faq.question,
    answer: richTextToPlainText(faq.answer),
  }))

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd data={faqSchema(faqItems.filter((item) => item.answer.length > 0))} />

      <PageHeader
        title={service.name}
        description={service.shortDescription}
        crumbs={crumbs}
      />

      <div className="content-container py-10 md:py-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="min-w-0">
            <RichText document={service.description} />

            {service.benefits.length > 0 && (
              <section className="mt-10">
                <h2 className="text-xl font-semibold text-neutral-900">
                  {tService('benefits')}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {service.benefits.map((benefit) => (
                    <li key={benefit} className="flex gap-3 text-sm text-neutral-700">
                      <span
                        aria-hidden="true"
                        className="bg-primary-500 mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                      />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {service.processSteps.length > 0 && (
              <section className="mt-12">
                <h2 className="text-xl font-semibold text-neutral-900">
                  {tService('process')}
                </h2>
                <ol className="mt-6 space-y-6">
                  {service.processSteps.map((step, index) => (
                    <li key={step.title} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="bg-primary-50 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                      >
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-medium text-neutral-900">{step.title}</h3>
                        {step.description && (
                          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {service.faqs.length > 0 && (
              <section className="mt-12">
                <h2 className="text-xl font-semibold text-neutral-900">
                  {tService('faq')}
                </h2>
                <dl className="mt-6 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
                  {service.faqs.map((faq) => (
                    <div key={faq.question} className="py-5">
                      <dt className="font-medium text-neutral-900">{faq.question}</dt>
                      <dd className="mt-2">
                        <RichText document={faq.answer} className="text-sm" />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
              <h2 className="text-base font-semibold text-neutral-900">
                {service.ctaLabel ?? tService('cta')}
              </h2>
              <div className="mt-5">
                {enquiryForm ? (
                  <EnquiryForm
                    formKey={enquiryForm.key}
                    fields={enquiryForm.fields}
                    locale={locale}
                    related={{ serviceId: service.id }}
                    submitLabel={service.ctaLabel ?? tService('cta')}
                  />
                ) : (
                  <p className="text-sm text-neutral-500">{tCommon('notAvailable')}</p>
                )}
              </div>
            </div>

            <Link
              href={`/${locale}/services`}
              className="text-primary-700 mt-5 inline-block text-sm hover:underline"
            >
              {tService('allServices')}
            </Link>
          </aside>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <Section tone="subtle">
          <SectionHeader heading={tService('relatedProducts')} />
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {relatedProducts.map((product) => (
              <li key={product.id} className="flex">
                <div className="flex w-full">
                  <ProductCardView
                    product={product}
                    labels={{ new: tCards('new'), sku: tCards('sku') }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
