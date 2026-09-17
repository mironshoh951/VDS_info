import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getTranslations, getFormatter } from 'next-intl/server'
import { ExternalLink, Award } from 'lucide-react'
import { preparePage } from '@/server/modules/shared/page-context'
import { listAchievements } from '@/server/modules/catalog/content-queries'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { PageHeader } from '@/components/site/page-header'
import { RichText } from '@/components/rich-text/rich-text'
import { Badge, ImagePlaceholder } from '@/components/ui'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'achievements' })
  return buildMetadata({
    locale: locale as never,
    path: 'achievements',
    title: t('title'),
    description: t('description'),
  })
}

export default async function AchievementsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale, context } = await preparePage(params)

  const [achievements, tNav, t, format] = await Promise.all([
    listAchievements(context),
    getTranslations('nav'),
    getTranslations('achievements'),
    getFormatter(),
  ])

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        crumbs={[
          { label: tNav('home'), href: `/${locale}` },
          { label: tNav('achievements') },
        ]}
      />

      <div className="content-container py-10 md:py-16">
        {achievements.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-16 text-center text-sm text-neutral-600">
            {t('noItems')}
          </p>
        ) : (
          /* A vertical timeline: achievements are chronological by nature and
             read better as a sequence than as a grid of equal tiles. */
          <ol className="relative space-y-10 border-l border-[var(--border-subtle)] pl-6 md:pl-10">
            {achievements.map((achievement) => (
              <li key={achievement.id} className="relative">
                <span
                  aria-hidden="true"
                  className="bg-primary-600 absolute top-1.5 -left-[1.6rem] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white md:-left-[3.1rem]"
                >
                  <Award className="h-3 w-3 text-white" />
                </span>

                <div className="flex flex-col gap-5 rounded-xl border border-[var(--border-subtle)] bg-white p-5 md:flex-row">
                  <div className="relative aspect-4/3 w-full shrink-0 overflow-hidden rounded-lg md:w-48">
                    {achievement.imageUrl ? (
                      <Image
                        src={achievement.imageUrl}
                        alt=""
                        fill
                        sizes="192px"
                        className="object-cover"
                      />
                    ) : (
                      <ImagePlaceholder
                        className="h-full w-full"
                        label={achievement.category}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="accent" size="sm">
                        {achievement.category}
                      </Badge>
                      {achievement.achievedOn && (
                        <time
                          dateTime={achievement.achievedOn.toISOString()}
                          className="text-sm text-neutral-500"
                        >
                          {format.dateTime(achievement.achievedOn, 'long')}
                        </time>
                      )}
                    </div>

                    <h2 className="mt-2 text-lg font-semibold text-neutral-900">
                      {achievement.title}
                    </h2>

                    <RichText
                      document={achievement.description}
                      className="mt-2 text-sm"
                    />

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
                      {achievement.issuer && <span>{achievement.issuer}</span>}
                      {achievement.location && (
                        <span>
                          {t('location')}: {achievement.location}
                        </span>
                      )}
                      {achievement.partner && (
                        <Link
                          href={achievement.partner.href}
                          className="text-primary-700 hover:underline"
                        >
                          {achievement.partner.name}
                        </Link>
                      )}
                      {achievement.externalUrl && (
                        <a
                          href={achievement.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-700 inline-flex items-center gap-1.5 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('learnMore')}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  )
}
