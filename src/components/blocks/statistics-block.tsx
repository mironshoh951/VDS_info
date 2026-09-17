import { recordArrayProp, stringProp, type BlockProps } from './types'

/**
 * Statistics block.
 *
 * Deliberately renders only what an editor has entered. The platform never
 * ships invented figures — "500+ partners" is a business claim, and a claim
 * has to come from the business (§73, §79).
 */
export function StatisticsBlock({ block }: BlockProps) {
  const heading = stringProp(block.props, 'heading')
  const items = recordArrayProp(block.props, 'items').filter(
    (item) => typeof item.value === 'string' && (item.value as string).trim().length > 0,
  )

  if (items.length === 0) return null

  return (
    <section
      id={block.anchor ?? undefined}
      className="border-y border-[var(--border-subtle)] bg-white"
    >
      <div className="content-container py-14 md:py-16">
        {heading && (
          <h2 className="mb-10 text-center text-2xl font-semibold text-neutral-900">
            {heading}
          </h2>
        )}

        <dl className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
          {items.map((item, index) => (
            <div key={index} className="text-center">
              <dt className="order-2 mt-2 text-sm text-neutral-600">
                {typeof item.label === 'string' ? item.label : ''}
              </dt>
              <dd className="text-primary-800 order-1 text-3xl font-semibold tracking-tight md:text-4xl">
                {item.value as string}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
