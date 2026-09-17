import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getTranslations, getFormatter } from 'next-intl/server'
import { Calendar, MapPin } from 'lucide-react'
import { preparePage } from '@/server/modules/shared/page-context'
import { listEvents, type EventCard } from '@/server/modules/catalog/directory-queries'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { PageHeader } from '@/components/site/page-header'
import { Badge, Card, CardBody, ImagePlaceholder, Section } from '@/components/ui'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const tNav = await getTranslations({ locale, namespace: 'nav' })
  return buildMetadata({ locale: locale as never, path: 'events', title: tNav('events') })
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale, context } = await preparePage(params)

  const [all, tNav, tEvent, tFilters, format] = await Promise.all([
    listEvents(context),
    getTranslations('nav'),
    getTranslations('event'),
    getTranslations('filters'),
    getFormatter(),
  ])

  const upcoming = all.filter((event) => event.isUpcoming)
  const past = all.filter((event) => !event.isUpcoming)

  const renderList = (events: EventCard[]) => (
    <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => (
        <li key={event.id} className="flex">
          <Card interactive className="w-full">
            <div className="relative aspect-16/9 border-b border-[var(--border-subtle)]">
              {event.coverUrl ? (
                <Image
                  src={event.coverUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 380px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <ImagePlaceholder className="h-full w-full" label={event.type} />
              )}
            </div>
            <CardBody>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={event.isUpcoming ? 'brand' : 'neutral'} size="sm">
                  {event.type}
                </Badge>
                {event.boothNumber && (
                  <Badge variant="accent" size="sm">
                    {tEvent('booth')} {event.boothNumber}
                  </Badge>
                )}
              </div>

              <h2 className="text-base font-semibold text-neutral-900">
                <Link
                  href={event.href}
                  className="hover:text-primary-800 after:absolute after:inset-0"
                >
                  {event.title}
                </Link>
              </h2>

              <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                <Calendar
                  className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                  aria-hidden="true"
                />
                <time dateTime={event.startDate.toISOString()}>
                  {format.dateTime(event.startDate, 'short')}
                </time>
                {event.endDate && (
                  <>
                    <span aria-hidden="true">–</span>
                    <time dateTime={event.endDate.toISOString()}>
                      {format.dateTime(event.endDate, 'short')}
                    </time>
                  </>
                )}
              </p>

              {(event.city || event.countryCode || event.venue) && (
                <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                  <MapPin
                    className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                    aria-hidden="true"
                  />
                  {[event.venue, event.city, event.countryCode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}

              {event.shortDescription && (
                <p className="line-clamp-2 text-sm text-neutral-500">
                  {event.shortDescription}
                </p>
              )}
            </CardBody>
          </Card>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <PageHeader
        title={tNav('events')}
        crumbs={[{ label: tNav('home'), href: `/${locale}` }, { label: tNav('events') }]}
      />

      {all.length === 0 ? (
        <div className="content-container py-16">
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-16 text-center text-sm text-neutral-600">
            {tFilters('noResults')}
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section>
              <h2 className="mb-8 text-2xl font-semibold tracking-tight text-neutral-900">
                {tEvent('upcoming')}
              </h2>
              {renderList(upcoming)}
            </Section>
          )}

          {past.length > 0 && (
            <Section tone={upcoming.length > 0 ? 'subtle' : 'default'}>
              <h2 className="mb-8 text-2xl font-semibold tracking-tight text-neutral-900">
                {tEvent('past')}
              </h2>
              {renderList(past)}
            </Section>
          )}
        </>
      )}
    </>
  )
}
