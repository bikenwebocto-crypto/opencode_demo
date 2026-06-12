'use client'

import { ArrowDown, Tag, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import type { ReviewComponentProps } from './types'

function formatDiscount(offer: any): string {
  if (offer?.discountPercent) return `${offer.discountPercent}% OFF`
  if (offer?.discountValue) return `$${Number(offer.discountValue).toFixed(2)} OFF`
  return 'N/A'
}

function formatDate(d?: string | Date | null) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function OfferSummary({ offer, label, accent }: { offer: any; label: string; accent?: boolean }) {
  if (!offer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Not available</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className={accent ? 'border-primary/30' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{offer.title}</p>
          <StatusBadge status={offer.status} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">Discount</p>
            <p className="font-semibold text-primary">{formatDiscount(offer)}</p>
          </div>
          <div className="rounded-md bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium capitalize">{offer.offerType?.replace(/_/g, ' ') ?? 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDate(offer.startDate)} → {formatDate(offer.endDate)}
        </div>
        {offer.description && (
          <p className="line-clamp-3 text-xs text-muted-foreground">{offer.description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function OfferReplacementReview({ entity, queueItem }: ReviewComponentProps) {
  const meta = (queueItem?.metadata as any) ?? {}
  const currentOffer = entity?.currentOffer ?? entity?.replacesOffer ?? null
  const newOffer = entity

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Replacement Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Approving this request will archive the current live offer and promote the new offer to LIVE.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <OfferSummary offer={currentOffer} label="Current Live Offer" />
        <div>
          <div className="mb-2 flex justify-center">
            <ArrowDown className="h-5 w-5 text-primary" />
          </div>
          <OfferSummary offer={newOffer} label="Proposed Replacement" accent />
        </div>
      </div>

      {(meta.reason || meta.replacementReason) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Replacement Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{meta.reason ?? meta.replacementReason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export const offerReplacementEditableFields = [
  { key: 'title', label: 'New Offer Title' },
  { key: 'shortDescription', label: 'Short Description' },
  { key: 'description', label: 'Description' },
  { key: 'termsAndConditions', label: 'Terms & Conditions' },
  { key: 'discountValue', label: 'Discount Value ($)' },
  { key: 'discountPercent', label: 'Discount Percent (%)' },
  { key: 'minimumSpend', label: 'Minimum Spend ($)' },
  { key: 'maxRedemptions', label: 'Max Redemptions' },
]
