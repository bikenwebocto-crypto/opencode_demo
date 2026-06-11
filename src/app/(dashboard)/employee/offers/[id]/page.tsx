'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmployeeLayout } from '@/components/employee/EmployeeLayout'
import { SaveButton } from '@/components/employee/SaveButton'
import { RedeemModal, type RedeemModalOffer } from '@/components/employee/RedeemModal'
import { ArrowLeft, MapPin, Star, Calendar, Tag, Info, AlertCircle, Store } from 'lucide-react'
import Link from 'next/link'

interface OfferDetail {
  id: string
  title: string
  description: string | null
  shortDescription: string | null
  termsAndConditions: string | null
  offerType: string
  discountValue: number | string
  discountPercent: number | null
  discountMax: number | string | null
  minimumSpend: number | string | null
  maxRedemptions: number | null
  currentRedemptions: number
  startDate: string
  endDate: string
  imageUrls: string[]
  redemptionInstructions: string | null
  isFeatured: boolean
  isExclusive: boolean
  merchant: {
    id: string
    businessName: string
    logoUrl: string | null
    averageRating: number | string
    city: string | null
    state: string | null
    description: string | null
    category: { id: string; name: string; icon: string | null } | null
    branches: { id: string; name: string; branchType: string; addressLine1: string; city: string; state: string | null }[]
  }
  isVisible: boolean
  visibilityReason?: string
  isSaved: boolean
  isRedeemed: boolean
}

async function fetchOffer(id: string): Promise<{ data: OfferDetail }> {
  const res = await fetch(`/api/employee/offers/${id}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
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

function formatDiscount(o: OfferDetail): string {
  switch (o.offerType) {
    case 'PERCENTAGE':
    case 'percentage':
      return `${o.discountPercent ?? Math.round(Number(o.discountValue))}% OFF`
    case 'BUY_X_GET_Y':
    case 'buy_x_get_y':
      return 'Buy 1 Get 1 Free'
    case 'FLAT':
    case 'flat_rate':
    case 'fixed_amount':
      return `$${Number(o.discountValue).toFixed(2)} OFF`
    default:
      return `${o.discountValue}`
  }
}

export default function EmployeeOfferDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [redeemOffer, setRedeemOffer] = useState<RedeemModalOffer | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['employee-offer', id],
    queryFn: () => fetchOffer(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <EmployeeLayout>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="mt-4 h-32 w-full" />
      </EmployeeLayout>
    )
  }

  if (error || !data?.data) {
    return (
      <EmployeeLayout>
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Failed to load offer.
          </CardContent>
        </Card>
      </EmployeeLayout>
    )
  }

  const o = data.data
  const discount = formatDiscount(o)
  const initials = o.merchant.businessName
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const canRedeem = o.isVisible && !o.isRedeemed
  const redeemModalOffer: RedeemModalOffer = {
    id: o.id,
    title: o.title,
    discountValue: o.discountValue,
    merchant: o.merchant,
    branches: o.merchant.branches,
  }

  return (
    <EmployeeLayout>
      <div className="space-y-4">
        <Link
          href="/employee/offers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to offers
        </Link>

        {!o.isVisible && (
          <div className="flex items-start gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium">This offer is not currently available</p>
              <p className="text-xs">{o.visibilityReason}</p>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {o.merchant.logoUrl ? (
                  <img
                    src={o.merchant.logoUrl}
                    alt={o.merchant.businessName}
                    className="h-14 w-14 rounded-full border object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-base font-bold">
                    {initials || <Store className="h-5 w-5" />}
                  </div>
                )}
                <div>
                  <p className="text-lg font-semibold">{o.merchant.businessName}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span>{Number(o.merchant.averageRating).toFixed(1)}</span>
                    <span className="ml-1">·</span>
                    <MapPin className="h-3 w-3" />
                    <span>
                      {o.merchant.city ?? '—'}
                      {o.merchant.state ? `, ${o.merchant.state}` : ''}
                    </span>
                  </div>
                </div>
              </div>
              <SaveButton offerId={o.id} initialSaved={o.isSaved} />
            </div>

            <div className="mt-6">
              <h2 className="text-2xl font-bold tracking-tight">{o.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
                  {discount}
                </span>
                <Badge variant="secondary">{TYPE_LABELS[o.offerType] ?? o.offerType}</Badge>
                {o.isFeatured && <Badge variant="live">Featured</Badge>}
                {o.isExclusive && <Badge variant="warning">Exclusive</Badge>}
              </div>
            </div>

            {o.shortDescription && (
              <p className="mt-3 text-sm">{o.shortDescription}</p>
            )}

            {o.imageUrls && o.imageUrls.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {o.imageUrls.slice(0, 4).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`${o.title} ${i + 1}`}
                    className="h-48 w-full rounded-md border object-cover"
                  />
                ))}
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border p-2 text-sm">
                <p className="text-xs text-muted-foreground">Valid</p>
                <p className="font-medium">
                  {new Date(o.startDate).toLocaleDateString()} – {new Date(o.endDate).toLocaleDateString()}
                </p>
              </div>
              {o.maxRedemptions != null && (
                <div className="rounded-md border p-2 text-sm">
                  <p className="text-xs text-muted-foreground">Total redemptions</p>
                  <p className="font-medium">
                    {o.currentRedemptions} / {o.maxRedemptions}
                  </p>
                </div>
              )}
              {o.minimumSpend != null && Number(o.minimumSpend) > 0 && (
                <div className="rounded-md border p-2 text-sm">
                  <p className="text-xs text-muted-foreground">Minimum spend</p>
                  <p className="font-medium">${Number(o.minimumSpend).toFixed(2)}</p>
                </div>
              )}
              {o.discountMax != null && Number(o.discountMax) > 0 && (
                <div className="rounded-md border p-2 text-sm">
                  <p className="text-xs text-muted-foreground">Max discount</p>
                  <p className="font-medium">${Number(o.discountMax).toFixed(2)}</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {o.isRedeemed ? (
                <Button size="lg" disabled>
                  Already Redeemed
                </Button>
              ) : (
                <Button
                  size="lg"
                  disabled={!canRedeem}
                  onClick={() => setRedeemOffer(redeemModalOffer)}
                >
                  <Tag className="mr-2 h-4 w-4" /> Redeem this offer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {o.description && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" /> About this offer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{o.description}</p>
            </CardContent>
          </Card>
        )}

        {o.merchant.branches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" /> Available at
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {o.merchant.branches.map((b) => (
                  <li key={b.id} className="rounded-md border p-2">
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.addressLine1}, {b.city}
                      {b.state ? `, ${b.state}` : ''} · {b.branchType}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {o.termsAndConditions && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Terms &amp; Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                {o.termsAndConditions}
              </p>
            </CardContent>
          </Card>
        )}

        {o.redemptionInstructions && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to redeem</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{o.redemptionInstructions}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <RedeemModal
        open={!!redeemOffer}
        onClose={() => setRedeemOffer(null)}
        offer={redeemOffer}
      />
    </EmployeeLayout>
  )
}
