import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import {
  Button,
  Section,
  SectionHeader,
  Card,
  CardBody,
  ImagePlaceholder,
} from '@/components/ui'
import { ProductCardView } from '@/components/cards/product-card'
import { PartnerCardView } from '@/components/cards/partner-card'
import { ArticleCardView } from '@/components/cards/article-card'
import { getLocaleSettings } from '@/server/modules/settings/service'
import { listProducts, listCategoryTree } from '@/server/modules/catalog/queries'
import {
  listPartners,
  listServices,
  listArticles,
  listBrands,
} from '@/server/modules/catalog/directory-queries'
import { stringProp, numberProp, type BlockProps } from './types'
import type { Locale } from '@/i18n/config'

/**
 * Blocks that read from the database.
 *
 * Each one is a server component that fetches exactly what it renders. A block
 * with nothing to show renders nothing at all rather than an empty shell —
 * a homepage section with a heading and no content looks broken, and on a
 * brand-new install every one of these is empty until content is published.
 */

async function context(locale: Locale) {
  const { defaultLocale, publishAiDrafts } = await getLocaleSettings()
  return { locale, defaultLocale, publishAiDrafts }
}

function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={href}>
        {label}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </Button>
  )
}

/** Prefixes a CMS-entered path with the active locale. */
function localized(locale: Locale, href: string): string {
  if (!href) return `/${locale}`
  if (/^https?:\/\//i.test(href)) return href
  return `/${locale}${href.startsWith('/') ? href : `/${href}`}`
}

export async function FeaturedCategoriesBlock({ block, locale }: BlockProps) {
  const ctx = await context(locale)
  const categories = await listCategoryTree(ctx, { featuredOnly: true })
  const limit = numberProp(block.props, 'limit', 6)
  const shown = categories.slice(0, limit)

  if (shown.length === 0) return null

  const heading = stringProp(block.props, 'heading')
  const body = stringProp(block.props, 'body')

  return (
    <Section id={block.anchor ?? undefined} tone="subtle">
      {heading && <SectionHeader heading={heading} body={body || null} />}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((category) => (
          <li key={category.id}>
            <Card interactive className="h-full">
              <CardBody>
                <h3 className="text-base font-semibold text-neutral-900">
                  <Link
                    href={category.href}
                    className="hover:text-primary-800 after:absolute after:inset-0 after:content-['']"
                  >
                    {category.name}
                  </Link>
                </h3>
                {category.children.length > 0 && (
                  <p className="line-clamp-2 text-sm text-neutral-600">
                    {category.children.map((child) => child.name).join(' · ')}
                  </p>
                )}
                {category.productCount > 0 && (
                  <p className="mt-auto pt-2 text-xs text-neutral-500 tabular-nums">
                    {category.productCount}
                  </p>
                )}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export async function FeaturedProductsBlock({ block, locale }: BlockProps) {
  const ctx = await context(locale)
  const limit = numberProp(block.props, 'limit', 4)

  const { items } = await listProducts(ctx, { featuredOnly: true, pageSize: limit })
  // Falling back to the newest products keeps the homepage populated before
  // anyone has thought about which products to feature.
  const products =
    items.length > 0
      ? items
      : (await listProducts(ctx, { pageSize: limit, sort: 'newest' })).items

  if (products.length === 0) return null

  const t = await getTranslations('cards')
  const heading = stringProp(block.props, 'heading')
  const ctaLabel = stringProp(block.props, 'ctaLabel')
  const ctaHref = stringProp(block.props, 'ctaHref')

  return (
    <Section id={block.anchor ?? undefined}>
      {heading && (
        <SectionHeader
          heading={heading}
          action={
            ctaLabel && ctaHref ? (
              <MoreLink href={localized(locale, ctaHref)} label={ctaLabel} />
            ) : null
          }
        />
      )}

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id} className="flex">
            <div className="flex w-full">
              <ProductCardView
                product={product}
                labels={{ new: t('new'), sku: t('sku') }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export async function ServicesGridBlock({ block, locale }: BlockProps) {
  const ctx = await context(locale)
  const limit = numberProp(block.props, 'limit', 4)
  const services = await listServices(ctx, { limit })

  if (services.length === 0) return null

  const heading = stringProp(block.props, 'heading')
  const ctaLabel = stringProp(block.props, 'ctaLabel')
  const ctaHref = stringProp(block.props, 'ctaHref')

  return (
    <Section id={block.anchor ?? undefined} tone="subtle">
      {heading && (
        <SectionHeader
          heading={heading}
          action={
            ctaLabel && ctaHref ? (
              <MoreLink href={localized(locale, ctaHref)} label={ctaLabel} />
            ) : null
          }
        />
      )}

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <li key={service.id} className="flex">
            <Card interactive className="w-full">
              <CardBody>
                <h3 className="text-base font-semibold text-neutral-900">
                  <Link
                    href={service.href}
                    className="hover:text-primary-800 after:absolute after:inset-0 after:content-['']"
                  >
                    {service.name}
                  </Link>
                </h3>
                {service.shortDescription && (
                  <p className="line-clamp-3 text-sm leading-relaxed text-neutral-600">
                    {service.shortDescription}
                  </p>
                )}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export async function FeaturedPartnersBlock({ block, locale }: BlockProps) {
  const ctx = await context(locale)
  const limit = numberProp(block.props, 'limit', 6)

  const featured = await listPartners(ctx, { featuredOnly: true, pageSize: limit })
  const partners =
    featured.items.length > 0
      ? featured.items
      : (await listPartners(ctx, { pageSize: limit })).items

  if (partners.length === 0) return null

  const t = await getTranslations('cards')
  const tPartner = await getTranslations('partner.types')
  const heading = stringProp(block.props, 'heading')
  const body = stringProp(block.props, 'body')
  const ctaLabel = stringProp(block.props, 'ctaLabel')
  const ctaHref = stringProp(block.props, 'ctaHref')

  return (
    <Section id={block.anchor ?? undefined}>
      {heading && (
        <SectionHeader
          heading={heading}
          body={body || null}
          action={
            ctaLabel && ctaHref ? (
              <MoreLink href={localized(locale, ctaHref)} label={ctaLabel} />
            ) : null
          }
        />
      )}

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((partner) => (
          <li key={partner.id} className="flex">
            <div className="flex w-full">
              <PartnerCardView
                partner={partner}
                labels={{
                  verified: t('verified'),
                  partnershipType: tPartner(partner.partnershipType),
                  products: t('products'),
                  brands: t('brands'),
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export async function BrandLogosBlock({ block, locale }: BlockProps) {
  const ctx = await context(locale)
  const limit = numberProp(block.props, 'limit', 12)
  const brands = await listBrands(ctx, { limit })

  if (brands.length === 0) return null

  const heading = stringProp(block.props, 'heading')

  return (
    <Section id={block.anchor ?? undefined} tone="subtle" className="py-10 md:py-14">
      {heading && (
        <h2 className="mb-8 text-center text-sm font-semibold tracking-[0.12em] text-neutral-500 uppercase">
          {heading}
        </h2>
      )}

      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {brands.map((brand) => (
          <li key={brand.id}>
            <Link
              href={brand.href}
              className="hover:text-primary-800 flex h-12 items-center rounded-sm px-2 text-sm font-medium text-neutral-500 transition-colors"
            >
              {brand.logoUrl ? (
                <Image
                  src={brand.logoUrl}
                  alt={brand.name}
                  width={120}
                  height={40}
                  className="max-h-10 w-auto object-contain opacity-70 transition-opacity hover:opacity-100"
                />
              ) : (
                brand.name
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export async function LatestNewsBlock({ block, locale }: BlockProps) {
  const ctx = await context(locale)
  const limit = numberProp(block.props, 'limit', 3)
  const { items } = await listArticles(ctx, { limit })

  if (items.length === 0) return null

  const t = await getTranslations('cards')
  const heading = stringProp(block.props, 'heading')
  const ctaLabel = stringProp(block.props, 'ctaLabel')
  const ctaHref = stringProp(block.props, 'ctaHref')

  return (
    <Section id={block.anchor ?? undefined}>
      {heading && (
        <SectionHeader
          heading={heading}
          action={
            ctaLabel && ctaHref ? (
              <MoreLink href={localized(locale, ctaHref)} label={ctaLabel} />
            ) : null
          }
        />
      )}

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((article) => (
          <li key={article.id} className="flex">
            <div className="flex w-full">
              <ArticleCardView
                article={article}
                locale={locale}
                readingLabel={(minutes) => t('readingTime', { minutes })}
              />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export async function ContactBlock({ block, locale }: BlockProps) {
  const { ContactSection } = await import('@/components/site/contact-section')
  const heading = stringProp(block.props, 'heading')
  const officesHeading = stringProp(block.props, 'officesHeading')
  const formKey = stringProp(block.props, 'formKey', 'general-enquiry')

  return (
    <ContactSection
      locale={locale}
      formKey={formKey}
      heading={heading}
      officesHeading={officesHeading}
      anchor={block.anchor}
    />
  )
}

export { ImagePlaceholder }
