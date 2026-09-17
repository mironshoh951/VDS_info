import Link from 'next/link'
import Image from 'next/image'
import { BadgeCheck } from 'lucide-react'
import { Card, CardBody, CardFooter, Badge, ImagePlaceholder } from '@/components/ui'
import type { PartnerCard as PartnerCardData } from '@/server/modules/catalog/directory-queries'

export function PartnerCardView({
  partner,
  labels,
}: {
  partner: PartnerCardData
  labels: {
    verified: string
    partnershipType: string
    products: string
    brands: string
  }
}) {
  return (
    <Card interactive className="group">
      <div className="flex items-center gap-4 p-5 pb-0">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white">
          {partner.logoUrl ? (
            <Image
              src={partner.logoUrl}
              alt=""
              fill
              sizes="56px"
              className="object-contain p-1.5"
            />
          ) : (
            <ImagePlaceholder className="h-full w-full" label="" />
          )}
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-neutral-900">
            <Link
              href={partner.href}
              className="hover:text-primary-800 after:absolute after:inset-0 after:content-['']"
            >
              {partner.name}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
            {partner.city && <span>{partner.city}</span>}
            {partner.city && partner.countryCode && <span aria-hidden="true">·</span>}
            {partner.countryCode && <span>{partner.countryCode}</span>}
          </p>
        </div>
      </div>

      <CardBody className="pt-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="brand" size="sm">
            {labels.partnershipType}
          </Badge>
          {partner.verified && (
            <Badge variant="success" size="sm">
              <BadgeCheck className="h-3 w-3" aria-hidden="true" />
              {labels.verified}
            </Badge>
          )}
        </div>

        {partner.shortDescription && (
          <p className="line-clamp-2 text-sm leading-relaxed text-neutral-600">
            {partner.shortDescription}
          </p>
        )}
      </CardBody>

      {(partner.brandCount > 0 || partner.productCount > 0) && (
        <CardFooter className="gap-4 text-xs">
          {partner.brandCount > 0 && (
            <span>
              {partner.brandCount} {labels.brands}
            </span>
          )}
          {partner.productCount > 0 && (
            <span>
              {partner.productCount} {labels.products}
            </span>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
