import { RichText } from '@/components/rich-text/rich-text'
import { stringProp, type BlockProps } from './types'

/** Prose section: an optional heading plus a rich-text document. */
export function RichTextBlock({ block }: BlockProps) {
  const heading = stringProp(block.props, 'heading')
  const body = block.props.body

  return (
    <section id={block.anchor ?? undefined} className="content-container py-14 md:py-20">
      <div className="max-w-3xl">
        {heading && (
          <h2 className="mb-6 text-3xl font-semibold tracking-tight text-neutral-900">
            {heading}
          </h2>
        )}
        <RichText document={body} />
      </div>
    </section>
  )
}
