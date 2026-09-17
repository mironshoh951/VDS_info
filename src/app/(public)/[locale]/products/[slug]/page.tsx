import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Download, ExternalLink, FileText } from 'lucide-react'
import { preparePage } from '@/server/modules/shared/page-context'
import { getProductBySlug } from '@/server/modules/catalog/queries'
import { getRenderedForm } from '@/server/modules/forms/service'
import {
  buildMetadata,
  metaDescription,
  seoOverride,
} from '@/server/modules/seo/metadata'
import { productSchema, breadcrumbSchema } from '@/server/modules/seo/structured-data'
import { isLocale, type Locale } from '@/i18n/config'
import { PageHeader } from '@/components/site/page-header'
import { MediaGallery } from '@/components/site/media-gallery'
import { EnquiryForm } from '@/components/site/enquiry-form'
import { ProductCardView } from '@/components/cards/product-card'
import { RichText } from '@/components/rich-text/rich-text'
import { JsonLd } from '@/components/site/json-ld'
import { Badge, Section, SectionHeader } from '@/components/ui'
import { getLocaleSettings } from '@/server/modules/settings/service'

export const revalidate = 300

async function load(params: Promise<{ locale: string; slug: string }>) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return null

  const { defaultLocale, publishAiDrafts } = await getLocaleSettings()
  const product = await getProductBySlug(slug, {
    locale,
    defaultLocale,
    publishAiDrafts,
  })

  return product ? { product, locale: locale as Locale } : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const loaded = await load(params)
  if (!loaded) return {}

  const { product, locale } = loaded
  const override = await seoOverride('PRODUCT', product.id, locale)

  return buildMetadata({
    locale,
    path: `products/${product.slug}`,
    title: override?.title ?? product.name,
    description: override?.description ?? metaDescription(product.shortDescription),
    imageUrl: product.imageUrl,
    modifiedTime: product.updatedAt,
    ...(override?.noindex ? { noindex: true } : {}),
  })
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, context } = await preparePage(params)
  const loaded = await load(params)
  if (!loaded) notFound()

  const { product } = loaded

  const [tNav, tProduct, tCards, tCommon, enquiryForm] = await Promise.all([
    getTranslations('nav'),
    getTranslations('product'),
    getTranslations('cards'),
    getTranslations('common'),
    getRenderedForm('product-enquiry', context),
  ])

  const crumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('products'), href: `/${locale}/products` },
    ...(product.categoryName ? [{ label: product.categoryName }] : []),
    { label: product.name },
  ]

  // Specifications are grouped so the table reads as sections rather than one
  // undifferentiated list.
  const specGroups = new Map<string, typeof product.specifications>()
  for (const spec of product.specifications) {
    const list = specGroups.get(spec.group) ?? []
    list.push(spec)
    specGroups.set(spec.group, list)
  }

  return (
    <>
      <JsonLd
        data={productSchema({
          name: product.name,
          description: product.shortDescription,
          sku: product.sku,
          brandName: product.brand?.name ?? null,
          imageUrl: product.imageUrl,
          url: `/${locale}/products/${product.slug}`,
          countryOfOrigin: product.countryOfOrigin,
        })}
      />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow={product.brand?.name ?? null}
        title={product.name}
        description={product.shortDescription}
        crumbs={crumbs}
      />

      <div className="content-container py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <MediaGallery
              images={
                product.gallery.length > 0
                  ? product.gallery
                  : product.imageUrl
                    ? [{ url: product.imageUrl, alt: product.name }]
                    : []
              }
              emptyLabel={tProduct('noImage')}
              altFallback={product.name}
            />
          </div>

          <div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-[var(--border-subtle)] pb-6 text-sm">
              {product.sku && <Fact label={tCards('sku')} value={product.sku} mono />}
              {product.productCode && (
                <Fact label={tProduct('productCode')} value={product.productCode} mono />
              )}
              {product.brand && (
                <Fact
                  label={tProduct('brand')}
                  value={
                    <Link
                      href={product.brand.href}
                      className="text-primary-700 hover:underline"
                    >
                      {product.brand.name}
                    </Link>
                  }
                />
              )}
              {product.partner && (
                <Fact
                  label={tProduct('manufacturer')}
                  value={
                    <Link
                      href={product.partner.href}
                      className="text-primary-700 hover:underline"
                    >
                      {product.partner.name}
                    </Link>
                  }
                />
              )}
              {product.countryOfOrigin && (
                <Fact
                  label={tProduct('countryOfOrigin')}
                  value={product.countryOfOrigin}
                />
              )}
              {product.packaging && (
                <Fact label={tProduct('packaging')} value={product.packaging} />
              )}
              {product.unit && <Fact label={tProduct('unit')} value={product.unit} />}
            </dl>

            {product.benefits.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-neutral-900">
                  {tProduct('benefits')}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {product.benefits.map((benefit) => (
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

            {product.applications.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-neutral-900">
                  {tProduct('applications')}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {product.applications.map((application) => (
                    <li key={application}>
                      <Badge variant="brand">{application}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {product.description ? (
          <section className="mt-14 max-w-3xl">
            <RichText document={product.description} />
          </section>
        ) : null}

        {specGroups.size > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">
              {tProduct('specifications')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-sm">
                <tbody>
                  {[...specGroups.entries()].map(([group, specs]) => (
                    <Fragment key={group}>
                      {specGroups.size > 1 && (
                        <tr>
                          <th
                            colSpan={2}
                            scope="colgroup"
                            className="bg-[var(--surface-subtle)] px-4 py-2.5 text-left text-xs font-semibold tracking-wider text-neutral-600 uppercase"
                          >
                            {group}
                          </th>
                        </tr>
                      )}
                      {specs.map((spec) => (
                        <tr
                          key={`${group}-${spec.label}`}
                          className="border-b border-[var(--border-subtle)]"
                        >
                          <th
                            scope="row"
                            className="w-1/2 px-4 py-3 text-left font-medium text-neutral-600"
                          >
                            {spec.label}
                          </th>
                          <td className="px-4 py-3 text-neutral-900">
                            {spec.value}
                            {spec.unit ? ` ${spec.unit}` : ''}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {product.documents.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">
              {tProduct('documents')}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {product.documents.map((document) => (
                <li key={`${document.title}-${document.url ?? ''}`}>
                  {document.url ? (
                    <a
                      href={document.url}
                      className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-white px-4 py-3.5 text-sm transition-shadow hover:shadow-sm"
                      download
                    >
                      <FileText
                        className="text-primary-600 h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-neutral-800">
                          {document.title}
                        </span>
                        <span className="text-xs tracking-wider text-neutral-500 uppercase">
                          {document.kind}
                        </span>
                      </span>
                      <Download
                        className="h-4 w-4 shrink-0 text-neutral-400"
                        aria-hidden="true"
                      />
                    </a>
                  ) : (
                    <span className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-3.5 text-sm text-neutral-500">
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

      <Section tone="subtle" id="enquiry">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
              {tProduct('inquiryTitle')}
            </h2>
            <p className="mt-3 max-w-lg text-neutral-600">{tProduct('inquiryBody')}</p>

            {(product.relatedServices.length > 0 ||
              product.relatedArticles.length > 0) && (
              <div className="mt-8 space-y-6">
                {product.relatedServices.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold tracking-wider text-neutral-500 uppercase">
                      {tProduct('relatedServices')}
                    </h3>
                    <ul className="mt-3 space-y-1.5">
                      {product.relatedServices.map((service) => (
                        <li key={service.href}>
                          <Link
                            href={service.href}
                            className="text-primary-700 text-sm hover:underline"
                          >
                            {service.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {product.relatedArticles.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold tracking-wider text-neutral-500 uppercase">
                      {tProduct('relatedArticles')}
                    </h3>
                    <ul className="mt-3 space-y-1.5">
                      {product.relatedArticles.map((article) => (
                        <li key={article.href}>
                          <Link
                            href={article.href}
                            className="text-primary-700 inline-flex items-center gap-1.5 text-sm hover:underline"
                          >
                            {article.title}
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
            {enquiryForm ? (
              <EnquiryForm
                formKey={enquiryForm.key}
                fields={enquiryForm.fields}
                locale={locale}
                related={{ productId: product.id }}
                submitLabel={tProduct('inquiryCta')}
              />
            ) : (
              <p className="text-sm text-neutral-500">{tCommon('notAvailable')}</p>
            )}
          </div>
        </div>
      </Section>

      {product.relatedProducts.length > 0 && (
        <Section>
          <SectionHeader heading={tProduct('relatedProducts')} />
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {product.relatedProducts.map((related) => (
              <li key={related.id} className="flex">
                <div className="flex w-full">
                  <ProductCardView
                    product={related}
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

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs tracking-wider text-neutral-500 uppercase">{label}</dt>
      <dd className={`mt-1 text-neutral-900 ${mono ? 'font-mono text-sm' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
