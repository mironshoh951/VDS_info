import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Globe, Mail, Phone, MapPin, FileText, BadgeCheck } from 'lucide-react'
import { preparePage } from '@/server/modules/shared/page-context'
import { getPartnerBySlug } from '@/server/modules/catalog/directory-queries'
import { listProducts } from '@/server/modules/catalog/queries'
import { getRenderedForm } from '@/server/modules/forms/service'
import {
  buildMetadata,
  metaDescription,
  seoOverride,
} from '@/server/modules/seo/metadata'
import { breadcrumbSchema } from '@/server/modules/seo/structured-data'
import { getLocaleSettings } from '@/server/modules/settings/service'
import { isLocale, type Locale } from '@/i18n/config'
import { PageHeader } from '@/components/site/page-header'
import { EnquiryForm } from '@/components/site/enquiry-form'
import { ProductCardView } from '@/components/cards/product-card'
import { RichText } from '@/components/rich-text/rich-text'
import { JsonLd } from '@/components/site/json-ld'
import { Badge, Section, SectionHeader, ImagePlaceholder } from '@/components/ui'

export const revalidate = 300

async function load(params: Promise<{ locale: string; slug: string }>) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return null
  const { defaultLocale, publishAiDrafts } = await getLocaleSettings()
  const context = { locale, defaultLocale, publishAiDrafts }
  const partner = await getPartnerBySlug(slug, context)
  return partner ? { partner, locale: locale as Locale, context } : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const loaded = await load(params)
  if (!loaded) return {}
  const { partner, locale } = loaded
  const override = await seoOverride('PARTNER', partner.id, locale)

  return buildMetadata({
    locale,
    path: `partners/${partner.slug}`,
    title: override?.title ?? partner.name,
    description: override?.description ?? metaDescription(partner.shortDescription),
    imageUrl: partner.logoUrl,
    modifiedTime: partner.updatedAt,
    ...(override?.noindex ? { noindex: true } : {}),
  })
}

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, context } = await preparePage(params)
  const loaded = await load(params)
  if (!loaded) notFound()

  const { partner } = loaded

  const [tNav, tPartner, tCards, tCommon, products, enquiryForm] = await Promise.all([
    getTranslations('nav'),
    getTranslations('partner'),
    getTranslations('cards'),
    getTranslations('common'),
    listProducts(context, { partnerSlug: partner.slug, pageSize: 8 }),
    getRenderedForm('partner-enquiry', context),
  ])

  const crumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('partners'), href: `/${locale}/partners` },
    { label: partner.name },
  ]

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow={tPartner(`types.${partner.partnershipType}`)}
        title={partner.name}
        description={partner.shortDescription}
        crumbs={crumbs}
        aside={
          partner.logoUrl ? (
            <div className="relative h-20 w-40 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white">
              <Image
                src={partner.logoUrl}
                alt={partner.name}
                fill
                sizes="160px"
                className="object-contain p-3"
              />
            </div>
          ) : null
        }
      />

      <div className="content-container py-10 md:py-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {partner.verified && (
              <p className="bg-success-50 text-success-700 mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                {tCards('verified')}
              </p>
            )}

            <h2 className="text-xl font-semibold text-neutral-900">
              {tPartner('overview')}
            </h2>
            <RichText document={partner.description} className="mt-4" />

            {partner.highlights.length > 0 && (
              <ul className="mt-6 space-y-2.5">
                {partner.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-3 text-sm text-neutral-700">
                    <span
                      aria-hidden="true"
                      className="bg-primary-500 mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                    />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            )}

            {partner.brands.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-5 text-xl font-semibold text-neutral-900">
                  {tPartner('brandsHeading')}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {partner.brands.map((brand) => (
                    <li key={brand.href}>
                      <Link
                        href={brand.href}
                        className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-white p-3.5 transition-shadow hover:shadow-sm"
                      >
                        {brand.logoUrl ? (
                          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded">
                            <Image
                              src={brand.logoUrl}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-contain"
                            />
                          </span>
                        ) : (
                          <ImagePlaceholder
                            className="h-10 w-10 shrink-0 rounded"
                            label=""
                          />
                        )}
                        <span className="text-sm font-medium text-neutral-800">
                          {brand.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {partner.documents.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-5 text-xl font-semibold text-neutral-900">
                  {tPartner('documentsHeading')}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {partner.documents.map((document) => (
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

            {partner.gallery.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-5 text-xl font-semibold text-neutral-900">
                  {tPartner('galleryHeading')}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {partner.gallery.map((image) => (
                    <li
                      key={image.url}
                      className="relative aspect-4/3 overflow-hidden rounded-lg border border-[var(--border-subtle)]"
                    >
                      <Image
                        src={image.url}
                        alt={image.alt ?? ''}
                        fill
                        sizes="(min-width: 1024px) 300px, 50vw"
                        className="object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
              <dl className="space-y-4 text-sm">
                <Row label={tPartner('type')}>
                  <Badge variant="brand">
                    {tPartner(`types.${partner.partnershipType}`)}
                  </Badge>
                </Row>
                {partner.foundedYear && (
                  <Row label={tPartner('founded')}>{partner.foundedYear}</Row>
                )}
                {partner.partnershipStart && (
                  <Row label={tPartner('since')}>
                    {partner.partnershipStart.getFullYear()}
                  </Row>
                )}
                {(partner.city || partner.countryCode) && (
                  <Row label={tPartner('location')}>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin
                        className="h-3.5 w-3.5 text-neutral-400"
                        aria-hidden="true"
                      />
                      {[partner.city, partner.countryCode].filter(Boolean).join(', ')}
                    </span>
                  </Row>
                )}
                {partner.website && (
                  <Row label={tPartner('website')}>
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-700 inline-flex items-center gap-1.5 break-all hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {partner.website.replace(/^https?:\/\//, '')}
                    </a>
                  </Row>
                )}
                {partner.email && (
                  <Row label={tPartner('email')}>
                    <a
                      href={`mailto:${partner.email}`}
                      className="text-primary-700 inline-flex items-center gap-1.5 break-all hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {partner.email}
                    </a>
                  </Row>
                )}
                {partner.phone && (
                  <Row label={tPartner('phone')}>
                    <a
                      href={`tel:${partner.phone.replace(/\s+/g, '')}`}
                      className="text-primary-700 inline-flex items-center gap-1.5 hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {partner.phone}
                    </a>
                  </Row>
                )}
              </dl>
            </div>
          </aside>
        </div>
      </div>

      {products.items.length > 0 && (
        <Section tone="subtle">
          <SectionHeader
            heading={tNav('products')}
            action={
              <Link
                href={`/${locale}/products?partner=${partner.slug}`}
                className="text-primary-700 text-sm font-medium hover:underline"
              >
                {tCommon('viewAll')}
              </Link>
            }
          />
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {products.items.slice(0, 8).map((product) => (
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

      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
              {tPartner('contactCta')}
            </h2>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
            {enquiryForm ? (
              <EnquiryForm
                formKey={enquiryForm.key}
                fields={enquiryForm.fields}
                locale={locale}
                related={{ partnerId: partner.id }}
                submitLabel={tPartner('contactCta')}
              />
            ) : (
              <p className="text-sm text-neutral-500">{tCommon('notAvailable')}</p>
            )}
          </div>
        </div>
      </Section>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-wider text-neutral-500 uppercase">{label}</dt>
      <dd className="mt-1 text-neutral-800">{children}</dd>
    </div>
  )
}
