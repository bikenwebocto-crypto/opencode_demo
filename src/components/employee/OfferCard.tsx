'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Star, Tag, Store } from 'lucide-react'
import { SaveButton } from './SaveButton'

export interface OfferCardData {
  id: string
  title: string
  description: string | null
  shortDescription: string | null
  offerType: string
  discountValue: number | string
  discountPercent?: number | null
  imageUrls: string[]
  isFeatured?: boolean
  isExclusive?: boolean
  endDate: string | Date
  merchant: {
    id: string
    businessName: string
    logoUrl: string | null
    averageRating: number | string
    city: string | null
    state: string | null
  }
  isSaved: boolean
  isRedeemed: boolean
}

const TYPE_LABELS: Record<string, string> = {
  FLAT: 'Flat',
  PERCENTAGE: '% Off',
  BUY_X_GET_Y: 'BOGO',
  fixed_amount: 'Fixed',
  percentage: '% Off',
  flat_rate: 'Flat',
  buy_x_get_y: 'BOGO',
}

function formatDiscount(o: OfferCardData): string {
  switch (o.offerType) {
    case 'PERCENTAGE':
    case 'percentage':
      return `${o.discountPercent ?? Math.round(Number(o.discountValue))}% OFF`
    case 'BUY_X_GET_Y':
    case 'buy_x_get_y':
      return 'BOGO'
    case 'FLAT':
    case 'flat_rate':
    case 'fixed_amount':
      return `$${Number(o.discountValue).toFixed(2)} OFF`
    default:
      return `${o.discountValue}`
  }
}

function getBadgeColor(offerType: string): string {
  if (offerType === 'PERCENTAGE' || offerType === 'percentage') return 'bg-purple-100 text-purple-800'
  if (offerType === 'BUY_X_GET_Y' || offerType === 'buy_x_get_y') return 'bg-pink-100 text-pink-800'
  if (offerType === 'FLAT' || offerType === 'flat_rate' || offerType === 'fixed_amount') return 'bg-orange-100 text-orange-800'
  return 'bg-blue-100 text-blue-800'
}

interface Props {
  offer: OfferCardData
  onRedeem?: (offer: OfferCardData) => void
}

export function OfferCard({ offer, onRedeem }: Props) {
  const discount = formatDiscount(offer)
  const initials = offer.merchant.businessName
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <div
        className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${getBadgeColor(offer.offerType)}`}
      >
        {discount}
      </div>
      <div className="absolute left-3 top-3">
        <SaveButton offerId={offer.id} initialSaved={offer.isSaved} size="sm" />
      </div>

      <CardContent className="p-4">
        <div className="mb-3 mt-2 flex items-center gap-3">
          {offer.merchant.logoUrl ? (
            <img
              src={offer.merchant.logoUrl}
              alt={offer.merchant.businessName}
              className="h-10 w-10 rounded-full border object-cover"
            />
          ) : (
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getBadgeColor(offer.offerType)} text-sm font-bold`}>
              {initials || <Store className="h-4 w-4" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{offer.merchant.businessName}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span>{Number(offer.merchant.averageRating).toFixed(1)}</span>
              <span className="ml-1">·</span>
              <MapPin className="h-3 w-3" />
              <span>
                {offer.merchant.city ?? '—'}
                {offer.merchant.state ? `, ${offer.merchant.state}` : ''}
              </span>
            </div>
          </div>
        </div>

        <Link href={`/employee/offers/${offer.id}`} className="block">
          <p className="mb-1 line-clamp-2 text-sm font-medium hover:underline">{offer.title}</p>
        </Link>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TYPE_LABELS[offer.offerType] ?? offer.offerType}</Badge>
          {offer.isFeatured && <Badge variant="live">Featured</Badge>}
          {offer.isExclusive && <Badge variant="warning">Exclusive</Badge>}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">
            Expires {new Date(offer.endDate).toLocaleDateString()}
          </span>
          {offer.isRedeemed ? (
            <Button size="sm" variant="outline" disabled>
              Already Redeemed
            </Button>
          ) : onRedeem ? (
            <Button size="sm" onClick={() => onRedeem(offer)}>
              <Tag className="mr-1 h-3 w-3" /> Redeem
            </Button>
          ) : (
            <Link href={`/employee/offers/${offer.id}`}>
              <Button size="sm">
                <Tag className="mr-1 h-3 w-3" /> View &amp; Redeem
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
