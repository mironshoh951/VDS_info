import { HeroBlock } from './hero-block'
import { StatisticsBlock } from './statistics-block'
import { RichTextBlock } from './rich-text-block'
import { CtaBlock } from './cta-block'
import { GalleryBlock } from './gallery-block'
import {
  FeaturedCategoriesBlock,
  FeaturedProductsBlock,
  ServicesGridBlock,
  FeaturedPartnersBlock,
  BrandLogosBlock,
  LatestNewsBlock,
  ContactBlock,
} from './data-blocks'
import type { BlockComponent, BlockProps } from './types'

/**
 * Block registry (§32).
 *
 * The page renderer knows nothing about individual blocks; it looks up a
 * component by the `type` stored on the row. Adding a block type is one entry
 * here plus a component — the database, the admin editor and the renderer all
 * pick it up automatically.
 *
 * An unregistered type renders nothing in production (content should never be
 * able to break a page) and a visible marker in development (a silent no-op
 * would be maddening to debug).
 */
export const BLOCK_REGISTRY: Record<string, BlockComponent> = {
  // Presentational blocks: content comes entirely from the block's own props.
  hero: HeroBlock,
  statistics: StatisticsBlock,
  richText: RichTextBlock,
  cta: CtaBlock,
  gallery: GalleryBlock,

  // Data blocks: the block supplies the heading and options, and pulls the
  // items it lists from the database.
  featuredCategories: FeaturedCategoriesBlock,
  featuredProducts: FeaturedProductsBlock,
  servicesGrid: ServicesGridBlock,
  featuredPartners: FeaturedPartnersBlock,
  brandLogos: BrandLogosBlock,
  latestNews: LatestNewsBlock,
  contact: ContactBlock,
}

export const REGISTERED_BLOCK_TYPES = Object.keys(BLOCK_REGISTRY)

export function BlockRenderer({ block, locale }: BlockProps) {
  const Component = BLOCK_REGISTRY[block.type]

  if (!Component) {
    if (process.env.NODE_ENV === 'development') {
      return (
        <div className="content-container border-warning-500 bg-warning-50 text-warning-700 my-4 rounded-md border border-dashed px-4 py-3 text-sm">
          Unregistered block type: <code className="font-mono">{block.type}</code>
        </div>
      )
    }
    return null
  }

  return <Component block={block} locale={locale} />
}
