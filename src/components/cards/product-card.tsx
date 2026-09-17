import Link from 'next/link'
import Image from 'next/image'
import { Card, CardBody, CardFooter, Badge, ImagePlaceholder } from '@/components/ui'
import type { ProductCard as ProductCardData } from '@/server/modules/catalog/queries'

/**
 * Product card.
 *
 * The whole card is a link, implemented with a stretched pseudo-element on the
 * title anchor: one tab stop, one announced link, and the entire surface is
 * still clickable. Nesting the card content inside an <a> would flatten the
 * heading structure for screen readers.
 */
export function ProductCardView({
  product,
  labels,
}: {
  product: ProductCardData
  labels: { new: string; sku: string }
}) {
  return (
    <Card interactive className="group">
      <div className="relative aspect-4/3 w-full overflow-hidden bg-neutral-50">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-6 transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out-soft)] group-hover:scale-[1.03]"
          />
        ) : (
          <ImagePlaceholder className="h-full w-full" />
        )}

        {product.isNew && (
          <Badge variant="accent" size="sm" className="absolute top-3 left-3">
            {labels.new}
          </Badge>
        )}
      </div>

      <CardBody>
        {product.brand && (
          <p className="text-primary-600 text-xs font-medium tracking-wider uppercase">
            {product.brand.name}
          </p>
        )}

        <h3 className="text-base leading-snug font-semibold text-neutral-900">
          <Link
            href={product.href}
            className="hover:text-primary-800 after:absolute after:inset-0 after:content-['']"
          >
            {product.name}
          </Link>
        </h3>

        {product.shortDescription && (
          <p className="line-clamp-2 text-sm leading-relaxed text-neutral-600">
            {product.shortDescription}
          </p>
        )}
      </CardBody>

      {(product.sku ?? product.categoryName) && (
        <CardFooter className="justify-between text-xs">
          {product.categoryName && (
            <span className="truncate">{product.categoryName}</span>
          )}
          {product.sku && (
            <span className="shrink-0 font-mono text-neutral-500">
              {labels.sku} {product.sku}
            </span>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
