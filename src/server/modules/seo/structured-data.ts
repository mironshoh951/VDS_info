import { getSettings } from '@/server/modules/settings/service'
import type { Locale } from '@/i18n/config'

/**
 * JSON-LD structured data (§38).
 *
 * Only facts that exist in the database are emitted. Structured data that
 * asserts a rating, a price or a certification the company has not entered
 * would be a fabricated claim in machine-readable form — which is worse than
 * one in prose, because aggregators repeat it.
 */

type Json = Record<string, unknown>

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export async function organizationSchema(locale: Locale): Promise<Json | null> {
  const [general, contact, seo] = await Promise.all([
    getSettings('site.general', locale),
    getSettings('site.contact', locale),
    getSettings('site.seo', locale),
  ])

  if (!general.siteName) return null

  const schema: Json = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: general.siteName,
    url: siteUrl(),
  }

  if (general.legalName) schema.legalName = general.legalName
  if (contact.primaryEmail) schema.email = contact.primaryEmail
  if (contact.primaryPhone) schema.telephone = contact.primaryPhone
  if (seo.defaultDescription) schema.description = seo.defaultDescription

  // Any extra fields a Super Admin entered win over the derived ones.
  return { ...schema, ...(seo.organizationSchema as Json) }
}

export function breadcrumbSchema(
  crumbs: Array<{ label: string; href?: string }>,
): Json | null {
  const withHref = crumbs.filter(
    (crumb) => crumb.href || crumb === crumbs[crumbs.length - 1],
  )
  if (withHref.length < 2) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: withHref.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      ...(crumb.href ? { item: `${siteUrl()}${crumb.href}` } : {}),
    })),
  }
}

export function productSchema(input: {
  name: string
  description?: string | null
  sku?: string | null
  brandName?: string | null
  imageUrl?: string | null
  url: string
  countryOfOrigin?: string | null
}): Json {
  const schema: Json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    url: `${siteUrl()}${input.url}`,
  }

  if (input.description) schema.description = input.description
  if (input.sku) schema.sku = input.sku
  if (input.brandName) schema.brand = { '@type': 'Brand', name: input.brandName }
  if (input.imageUrl) schema.image = input.imageUrl
  if (input.countryOfOrigin) schema.countryOfOrigin = input.countryOfOrigin

  // No `offers` block: the catalogue publishes no prices, and inventing an
  // availability or price would be a false claim.
  return schema
}

export function articleSchema(input: {
  title: string
  description?: string | null
  imageUrl?: string | null
  url: string
  publishedAt?: Date | null
  modifiedAt?: Date | null
  authorName?: string | null
  publisherName?: string | null
}): Json {
  const schema: Json = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    mainEntityOfPage: `${siteUrl()}${input.url}`,
  }

  if (input.description) schema.description = input.description
  if (input.imageUrl) schema.image = input.imageUrl
  if (input.publishedAt) schema.datePublished = input.publishedAt.toISOString()
  if (input.modifiedAt) schema.dateModified = input.modifiedAt.toISOString()
  if (input.authorName) schema.author = { '@type': 'Person', name: input.authorName }
  if (input.publisherName) {
    schema.publisher = { '@type': 'Organization', name: input.publisherName }
  }

  return schema
}

export function eventSchema(input: {
  name: string
  description?: string | null
  startDate: Date
  endDate?: Date | null
  venue?: string | null
  city?: string | null
  countryCode?: string | null
  url: string
  imageUrl?: string | null
}): Json {
  const schema: Json = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    startDate: input.startDate.toISOString(),
    url: `${siteUrl()}${input.url}`,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  }

  if (input.endDate) schema.endDate = input.endDate.toISOString()
  if (input.description) schema.description = input.description
  if (input.imageUrl) schema.image = input.imageUrl

  if (input.venue || input.city) {
    schema.location = {
      '@type': 'Place',
      ...(input.venue ? { name: input.venue } : {}),
      address: {
        '@type': 'PostalAddress',
        ...(input.city ? { addressLocality: input.city } : {}),
        ...(input.countryCode ? { addressCountry: input.countryCode } : {}),
      },
    }
  }

  return schema
}

export function faqSchema(
  items: Array<{ question: string; answer: string }>,
): Json | null {
  if (items.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}
