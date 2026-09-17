'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/cn'
import { ImagePlaceholder } from '@/components/ui'

/**
 * Image gallery for detail pages.
 *
 * Thumbnails are real buttons in a tablist, so the gallery is operable from
 * the keyboard and announced correctly — a set of clickable divs would look
 * identical and be unusable without a mouse.
 */
export function MediaGallery({
  images,
  emptyLabel,
  altFallback,
}: {
  images: Array<{ url: string; alt: string | null }>
  emptyLabel: string
  altFallback: string
}) {
  const [active, setActive] = useState(0)

  if (images.length === 0) {
    return (
      <ImagePlaceholder
        label={emptyLabel}
        className="aspect-4/3 w-full rounded-xl border border-[var(--border-subtle)]"
      />
    )
  }

  const current = images[Math.min(active, images.length - 1)]

  return (
    <div>
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
        {current && (
          <Image
            src={current.url}
            alt={current.alt ?? altFallback}
            fill
            sizes="(min-width: 1024px) 560px, 100vw"
            className="object-contain p-4"
            priority
          />
        )}
      </div>

      {images.length > 1 && (
        <div
          role="tablist"
          aria-label={altFallback}
          className="mt-3 flex flex-wrap gap-2"
        >
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={image.alt ?? `${altFallback} ${index + 1}`}
              onClick={() => setActive(index)}
              className={cn(
                'relative h-16 w-16 overflow-hidden rounded-md border bg-white',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
                index === active
                  ? 'border-primary-600 ring-primary-600 ring-1'
                  : 'border-[var(--border-subtle)] hover:border-neutral-400',
              )}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
