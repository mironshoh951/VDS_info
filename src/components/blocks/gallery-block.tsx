import Image from 'next/image'
import { publicImageList } from '@/server/modules/media/public'
import { stringArrayProp, stringProp, type BlockProps } from './types'

/**
 * The company's own photographs.
 *
 * Every other block on this site shows what is sold — products, brands, the
 * catalogue. This is the only one that shows who is selling it: the premises,
 * the team, an installation in a clinic. That is what a visitor is actually
 * deciding about when they are deciding whether to buy equipment from a
 * supplier they have not met.
 *
 * Two layouts, because two things are being done:
 *
 *  - **mosaic** gives the first image the weight of a lead photograph and lets
 *    the others support it. Use it when one picture is the best one.
 *  - **row** treats them evenly. Use it for a set that belongs together — four
 *    rooms, four stages of an installation.
 *
 * Renders nothing at all when no images have been chosen. An empty frame
 * captioned "our facilities" is worse than no section.
 */
export async function GalleryBlock({ block, locale }: BlockProps) {
  const heading = stringProp(block.props, 'heading')
  const body = stringProp(block.props, 'body')
  const layout = stringProp(block.props, 'layout', 'mosaic')

  const images = await publicImageList(stringArrayProp(block.props, 'imageIds'), locale)
  if (images.length === 0) return null

  const mosaic = layout !== 'row' && images.length >= 3

  return (
    <section id={block.anchor ?? undefined} className="content-container py-16 md:py-24">
      {(heading || body) && (
        <div className="mb-10 max-w-2xl">
          {heading && (
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
              {heading}
            </h2>
          )}
          {body && (
            <p className="mt-3 text-lg leading-relaxed text-neutral-600">{body}</p>
          )}
        </div>
      )}

      <ul
        className={
          mosaic
            ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2'
            : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
        }
      >
        {images.map((image, index) => {
          // In the mosaic the first picture spans two columns and both rows,
          // which is what makes it read as the lead rather than as one of five.
          const lead = mosaic && index === 0

          return (
            <li
              key={image.id}
              className={lead ? 'lg:col-span-2 lg:row-span-2' : undefined}
            >
              <figure
                className="group relative h-full overflow-hidden rounded-xl"
                style={{ backgroundColor: image.dominantColor ?? undefined }}
              >
                <div className={lead ? 'aspect-4/3 lg:h-full' : 'aspect-4/3'}>
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes={
                      lead
                        ? '(max-width: 1024px) 100vw, 50vw'
                        : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'
                    }
                    className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
                  />
                </div>

                {image.caption && (
                  // The caption sits on the picture rather than under it so the
                  // grid stays a grid: captions of different lengths below the
                  // images would make every tile a different height.
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-sm text-white">
                    {image.caption}
                  </figcaption>
                )}
              </figure>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
