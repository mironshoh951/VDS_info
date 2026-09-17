import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getTranslations, getFormatter } from 'next-intl/server'
import { Calendar, MapPin, Globe, Building2 } from 'lucide-react'
import { preparePage } from '@/server/modules/shared/page-context'
import { getEventBySlug } from '@/server/modules/catalog/directory-queries'
import {
  buildMetadata,
  metaDescription,
  seoOverride,
} from '@/server/modules/seo/metadata'
import { breadcrumbSchema, eventSchema } from '@/server/modules/seo/structured-data'
import { getLocaleSettings } from '@/server/modules/settings/service'
import { isLocale, type Locale } from '@/i18n/config'
import { PageHeader } from '@/components/site/page-header'
import { RichText } from '@/components/rich-text/rich-text'
import { JsonLd } from '@/components/site/json-ld'
import { Badge, ImagePlaceholder } from '@/components/ui'

export const revalidate = 300

async function load(params: Promise<{ locale: string; slug: string }>) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return null
  const { defaultLocale, publishAiDrafts } = await getLocaleSettings()
  const event = await getEventBySlug(slug, { locale, defaultLocale, publishAiDrafts })
  return event ? { event, locale: locale as Locale } : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const loaded = await load(params)
  if (!loaded) return {}
  const { event, locale } = loaded
  const override = await seoOverride('EVENT', event.id, locale)

  return buildMetadata({
    locale,
    path: `events/${event.slug}`,
    title: override?.title ?? event.title,
    description: override?.description ?? metaDescription(event.shortDescription),
    imageUrl: event.coverUrl,
    type: 'article',
    modifiedTime: event.updatedAt,
    ...(override?.noindex ? { noindex: true } : {}),
  })
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale } = await preparePage(params)
  const loaded = await load(params)
  if (!loaded) notFound()

  const { event } = loaded

  const [tNav, tEvent, format] = await Promise.all([
    getTranslations('nav'),
    getTranslations('event'),
    getFormatter(),
  ])

  const crumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('events'), href: `/${locale}/events` },
    { label: event.title },
  ]

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd
        data={eventSchema({
          name: event.title,
          description: event.shortDescription,
          startDate: event.startDate,
          endDate: event.endDate,
          venue: event.venue,
          city: event.city,
          countryCode: event.countryCode,
          url: `/${locale}/events/${event.slug}`,
          imageUrl: event.coverUrl,
        })}
      />

      <PageHeader
        eyebrow={event.isUpcoming ? tEvent('upcoming') : tEvent('past')}
        title={event.title}
        description={event.shortDescription}
        crumbs={crumbs}
      />

      <div className="content-container py-10 md:py-14">
        <div className="relative mb-10 aspect-21/9 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
          {event.coverUrl ? (
            <Image
              src={event.coverUrl}
              alt=""
              fill
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover"
              priority
            />
          ) : (
            <ImagePlaceholder className="h-full w-full" label={event.type} />
          )}
        </div>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <RichText document={event.description} />

            {event.summary ? (
              <section className="mt-12">
                <h2 className="text-xl font-semibold text-neutral-900">
                  {tEvent('summary')}
                </h2>
                <RichText document={event.summary} className="mt-4" />
              </section>
            ) : null}

            {event.partners.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-5 text-xl font-semibold text-neutral-900">
                  {tEvent('partnersHeading')}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {event.partners.map((partner) => (
                    <li key={partner.href}>
                      <Link
                        href={partner.href}
                        className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-white p-3.5 hover:shadow-sm"
                      >
                        {partner.logoUrl ? (
                          <span className="relative h-10 w-10 shrink-0">
                            <Image
                              src={partner.logoUrl}
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
                          {partner.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {event.gallery.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-5 text-xl font-semibold text-neutral-900">
                  {tEvent('galleryHeading')}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {event.gallery.map((image) => (
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
            <dl className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-white p-5 text-sm">
              <div>
                <dt className="text-xs tracking-wider text-neutral-500 uppercase">
                  {tEvent('when')}
                </dt>
                <dd className="mt-1 flex items-start gap-2 text-neutral-800">
                  <Calendar
                    className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
                    aria-hidden="true"
                  />
                  <span>
                    <time dateTime={event.startDate.toISOString()}>
                      {format.dateTime(event.startDate, 'long')}
                    </time>
                    {event.endDate && (
                      <>
                        {' – '}
                        <time dateTime={event.endDate.toISOString()}>
                          {format.dateTime(event.endDate, 'long')}
                        </time>
                      </>
                    )}
                  </span>
                </dd>
              </div>

              {(event.venue || event.city) && (
                <div>
                  <dt className="text-xs tracking-wider text-neutral-500 uppercase">
                    {tEvent('where')}
                  </dt>
                  <dd className="mt-1 flex items-start gap-2 text-neutral-800">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
                      aria-hidden="true"
                    />
                    <span>
                      {[event.venue, event.city, event.countryCode]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-xs tracking-wider text-neutral-500 uppercase">
                  {tEvent('participation')}
                </dt>
                <dd className="mt-1">
                  <Badge variant="brand">{event.participation}</Badge>
                  {event.boothNumber && (
                    <span className="ml-2 text-neutral-700">
                      {tEvent('booth')} {event.boothNumber}
                    </span>
                  )}
                </dd>
              </div>

              {event.organizer && (
                <div>
                  <dt className="text-xs tracking-wider text-neutral-500 uppercase">
                    {tEvent('organizer')}
                  </dt>
                  <dd className="mt-1 flex items-start gap-2 text-neutral-800">
                    <Building2
                      className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
                      aria-hidden="true"
                    />
                    {event.organizer}
                  </dd>
                </div>
              )}

              {event.website && (
                <div>
                  <dt className="text-xs tracking-wider text-neutral-500 uppercase">
                    {tEvent('website')}
                  </dt>
                  <dd className="mt-1">
                    <a
                      href={event.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-700 inline-flex items-center gap-1.5 break-all hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {event.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </aside>
        </div>
      </div>
    </>
  )
}
