import Link from 'next/link'
import { Button } from '@/components/ui'
import { stringProp, type BlockProps } from './types'

/** Call-to-action band. Label and destination are both CMS-controlled. */
export function CtaBlock({ block }: BlockProps) {
  const heading = stringProp(block.props, 'heading')
  const body = stringProp(block.props, 'body')
  const label = stringProp(block.props, 'ctaLabel')
  const href = stringProp(block.props, 'ctaHref')

  if (!heading && !label) return null

  return (
    <section id={block.anchor ?? undefined} className="bg-primary-900">
      <div className="content-container flex flex-col items-start gap-6 py-14 md:flex-row md:items-center md:justify-between md:py-16">
        <div className="max-w-2xl">
          {heading && (
            <h2 className="text-2xl font-semibold text-white md:text-3xl">{heading}</h2>
          )}
          {body && <p className="text-primary-100 mt-3">{body}</p>}
        </div>
        {label && href && (
          <Button asChild size="lg" variant="accent" className="shrink-0">
            <Link href={href}>{label}</Link>
          </Button>
        )}
      </div>
    </section>
  )
}
