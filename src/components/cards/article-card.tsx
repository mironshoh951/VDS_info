import Link from 'next/link'
import Image from 'next/image'
import { Card, CardBody, ImagePlaceholder } from '@/components/ui'
import type { ArticleCard as ArticleCardData } from '@/server/modules/catalog/directory-queries'

export function ArticleCardView({
  article,
  locale,
  readingLabel,
}: {
  article: ArticleCardData
  locale: string
  readingLabel: (minutes: number) => string
}) {
  const published = article.publishedAt

  return (
    <Card interactive className="group">
      <div className="relative aspect-16/9 w-full overflow-hidden bg-neutral-50">
        {article.coverUrl ? (
          <Image
            src={article.coverUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out-soft)] group-hover:scale-[1.03]"
          />
        ) : (
          <ImagePlaceholder className="h-full w-full" />
        )}
      </div>

      <CardBody>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          {article.categoryName && (
            <span className="text-primary-600 font-medium">{article.categoryName}</span>
          )}
          {article.categoryName && published && <span aria-hidden="true">·</span>}
          {published && (
            <time dateTime={published.toISOString()}>
              {new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(published)}
            </time>
          )}
          {article.readingMinutes ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{readingLabel(article.readingMinutes)}</span>
            </>
          ) : null}
        </div>

        <h3 className="text-base leading-snug font-semibold text-neutral-900">
          <Link
            href={article.href}
            className="hover:text-primary-800 after:absolute after:inset-0 after:content-['']"
          >
            {article.title}
          </Link>
        </h3>

        {article.excerpt && (
          <p className="line-clamp-3 text-sm leading-relaxed text-neutral-600">
            {article.excerpt}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
