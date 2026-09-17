import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Globe, FileText } from 'lucide-react'
import { preparePage } from '@/server/modules/shared/page-context'
import { getBrandBySlug } from '@/server/modules/catalog/directory-queries'
import { listProducts } from '@/server/modules/catalog/queries'
import {
  buildMetadata,
  metaDescription,
  seoOverride,
} from '@/server/modules/seo/metadata'
import { breadcrumbSchema } from '@/server/modules/seo/structured-data'
import { getLocaleSettings } from '@/server/modules/settings/service'
import { isLocale, type Locale } from '@/i18n/config'
import { PageHeader } from '@/components/site/page-header'
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
  const brand = await getBrandBySlug(slug, context)
  return brand ? { brand, locale: locale as Locale, context } : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const loaded = await load(params)
  if (!loaded) return {}
  const { brand, locale } = loaded
  const override = await seoOverride('BRAND', brand.id, locale)

  return buildMetadata({
    locale,
    path: `brands/${brand.slug}`,
    title: override?.title ?? brand.name,
    description: override?.description ?? metaDescription(brand.shortDescription),
    imageUrl: brand.logoUrl,
    modifiedTime: brand.updatedAt,
    ...(override?.noindex ? { noindex: true } : {}),
  })
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, context } = await preparePage(params)
  const loaded = await load(params)
  if (!loaded) notFound()

  const { brand } = loaded

  const [tNav, tBrand, tCards, tCommon, products] = await Promise.all([
    getTranslations('nav'),
    getTranslations('brand'),
    getTranslations('cards'),
    getTranslations('common'),
    listProducts(context, { brandSlug: brand.slug, pageSize: 12 }),
  ])

  const crumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('brands'), href: `/${locale}/brands` },
    { label: brand.name },
  ]

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow={brand.tagline}
        title={brand.name}
        description={brand.shortDescription}
        crumbs={crumbs}
        aside={
          brand.logoUrl ? (
            <div className="relative h-20 w-40 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white">
              <Image
                src={brand.logoUrl}
                alt={brand.name}
                fill
                sizes="160px"
                className="object-contain p-3"
              />
            </div>
          ) : null
        }
      />

      <div className="content-container py-10 md:py-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-neutral-900">
              {tBrand('overview')}
            </h2>
            <RichText document={brand.description} className="mt-4" />

            {brand.documents.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-5 text-xl font-semibold text-neutral-900">
                  {tBrand('documentsHeading')}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {brand.documents.map((document) => (
                    <li key={`${document.title}-${document.url ?? ''}`}>
                      {document.url ? (
                        <a
                          href={document.url}
                          download
                          className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm hover:shadow-sm"
                        >
                          <FileText
                            className="text-primary-600 h-5 w-5 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate font-medium text-neutral-800">
                            {document.title}
                          </span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-3 text-sm text-neutral-500">
                          <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
                          {document.title}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <dl className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-white p-5 text-sm">
              {brand.partner && (
                <div>
                  <dt className="text-xs tracking-wider text-neutral-500 uppercase">
                    {tBrand('manufacturer')}
                  </dt>
                  <dd className="mt-1">
                    <Link
                      href={brand.partner.href}
                      className="text-primary-700 hover:underline"
                    >
                      {brand.partner.name}
                    </Link>
                  </dd>
                </div>
              )}
              {brand.countryCode && (
                <div>
                  <dt className="text-xs tracking-wider text-neutral-500 uppercase">
                    {tBrand('countryOfOrigin')}
                  </dt>
                  <dd className="mt-1 text-neutral-800">{brand.countryCode}</dd>
                </div>
              )}
              {brand.website && (
                <div>
                  <dt className="text-xs tracking-wider text-neutral-500 uppercase">
                    {tBrand('website')}
                  </dt>
                  <dd className="mt-1">
                    <a
                      href={brand.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-700 inline-flex items-center gap-1.5 break-all hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {brand.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </aside>
        </div>
      </div>

      <Section tone="subtle">
        <SectionHeader
          heading={tBrand('productsHeading')}
          action={
            products.total > 12 ? (
              <Link
                href={`/${locale}/products?brand=${brand.slug}`}
                className="text-primary-700 text-sm font-medium hover:underline"
              >
                {tCommon('viewAll')}
              </Link>
            ) : null
          }
        />
        {products.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-white px-6 py-12 text-center text-sm text-neutral-600">
            {tBrand('noProducts')}
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {products.items.map((product) => (
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
        )}
      </Section>
    </>
  )
}
