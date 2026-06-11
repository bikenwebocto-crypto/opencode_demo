'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmployeeLayout } from '@/components/employee/EmployeeLayout'
import { OfferCard, type OfferCardData } from '@/components/employee/OfferCard'
import { RedeemModal, type RedeemModalOffer } from '@/components/employee/RedeemModal'
import { Bookmark, Search, Heart } from 'lucide-react'
import Link from 'next/link'

interface SavedRow {
  savedAt: string
  notificationId: string
  offer: OfferCardData
}

async function fetchSaved(): Promise<{ data: SavedRow[] }> {
  const res = await fetch('/api/employee/saved')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
}

export default function EmployeeSavedPage() {
  const [search, setSearch] = useState('')
  const [redeemOffer, setRedeemOffer] = useState<RedeemModalOffer | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['employee-saved'],
    queryFn: fetchSaved,
  })

  const rows = (data?.data ?? []).filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.offer.title.toLowerCase().includes(q) ||
      r.offer.merchant.businessName.toLowerCase().includes(q)
    )
  })

  return (
    <EmployeeLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Heart className="h-5 w-5 text-red-500" /> Saved Offers
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Offers you have bookmarked for later
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search saved offers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bookmark className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">No saved offers</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tap the heart icon on any offer to save it for later.
              </p>
              <Link href="/employee/offers" className="mt-4 inline-block">
                <Button size="sm">Browse offers</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <OfferCard key={r.notificationId} offer={r.offer} onRedeem={setRedeemOffer as any} />
            ))}
          </div>
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
