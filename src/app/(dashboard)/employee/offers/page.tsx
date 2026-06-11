'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { EmployeeLayout } from '@/components/employee/EmployeeLayout'
import { OfferCard, type OfferCardData } from '@/components/employee/OfferCard'
import { RedeemModal, type RedeemModalOffer } from '@/components/employee/RedeemModal'
import { Search } from 'lucide-react'

interface OffersResponse {
  data: OfferCardData[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

async function fetchOffers(params: URLSearchParams): Promise<OffersResponse> {
  const res = await fetch(`/api/employee/offers?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
}

export default function EmployeeOffersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [redeemOffer, setRedeemOffer] = useState<RedeemModalOffer | null>(null)

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', '12')
  if (search) params.set('q', search)

  const { data, isLoading } = useQuery({
    queryKey: ['employee-offers', params.toString()],
    queryFn: () => fetchOffers(params),
  })

  return (
    <EmployeeLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Available Offers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and redeem exclusive offers from merchants near you
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search offers or merchants…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-8"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        ) : !data?.data || data.data.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No offers match your search.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((o) => (
                <OfferCard
                  key={o.id}
                  offer={o}
                  onRedeem={setRedeemOffer as any}
                />
              ))}
            </div>
            {data.meta.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Page {page} of {data.meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </button>
                  <button
                    className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                    onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                    disabled={page >= data.meta.totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
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
