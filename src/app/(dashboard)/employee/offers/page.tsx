'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmployeeLayout } from '@/components/employee/EmployeeLayout'
import { OfferCard } from '@/components/employee/OfferCard'
import { OfferSection } from '@/components/employee/OfferSection'
import { RedeemModal } from '@/components/employee/RedeemModal'
import { BannerCarousel } from '@/components/employee/BannerCarousel'
import type { EmployeeOffer } from '@/components/employee/offers/employee-offer'
import { findOfferInList } from '@/components/employee/offers/employee-offer'
import { Search, X } from 'lucide-react'

interface Banner {
  id: string
  image_url: string
  alt_text: string | null
  redirect_url: string | null
  business_name: string
  banner_name: string
  position: string
}

interface CategoryGroup {
  id: string
  name: string
  icon: string | null
  offers: EmployeeOffer[]
}

interface GroupedResponse {
  success: boolean
  data: {
    banners: Banner[]
    categories: CategoryGroup[]
  }
}

interface OffersResponse {
  success: boolean
  data: EmployeeOffer[]
  banners: Banner[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

async function fetchGrouped(): Promise<GroupedResponse> {
  const res = await fetch('/api/employee/offers/grouped')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
}

async function fetchOffers(params: URLSearchParams): Promise<OffersResponse> {
  const res = await fetch(`/api/employee/offers?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
}

function findOfferInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  groupedKey: string[],
  listKey: string[],
  id: string,
): EmployeeOffer | null {
  const grouped = queryClient.getQueryData<GroupedResponse>(groupedKey)
  if (grouped) {
    for (const cat of grouped.data.categories) {
      const found = cat.offers.find((o) => o.id === id)
      if (found) return found
    }
  }
  const listed = queryClient.getQueryData<OffersResponse>(listKey)
  if (listed) {
    const found = findOfferInList(listed.data, id)
    if (found) return found.offer
  }
  return null
}

export default function EmployeeOffersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [activeFeatured, setActiveFeatured] = useState(false)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const hasFilters = search.trim().length > 0 || activeCategoryId !== null || activeFeatured

  const listParams = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('pageSize', '12')
    if (search) p.set('q', search)
    if (activeCategoryId) p.set('categoryId', activeCategoryId)
    if (activeFeatured) p.set('featured', 'true')
    return p
  }, [page, search, activeCategoryId, activeFeatured])

  const groupedQuery = useQuery({
    queryKey: ['employee-offers', 'grouped'],
    queryFn: fetchGrouped,
    enabled: !hasFilters,
    staleTime: 30_000,
  })

  const listQuery = useQuery({
    queryKey: ['employee-offers', listParams.toString()],
    queryFn: () => fetchOffers(listParams),
    enabled: hasFilters,
  })

  const banners = hasFilters
    ? listQuery.data?.banners ?? []
    : groupedQuery.data?.data.banners ?? []

  const sections = useMemo(() => {
    const data = groupedQuery.data?.data
    if (!data) return []

    const allOffers = data.categories.flatMap((c) => c.offers)
    const featuredOffers = allOffers.filter((o) => o.isFeatured).slice(0, 6)

    const result: {
      id: string
      title: string
      subtitle?: string
      icon: string | null
      offers: EmployeeOffer[]
      onViewAll?: () => void
    }[] = []

    if (featuredOffers.length > 0) {
      result.push({
        id: 'featured',
        title: 'Featured Offers',
        icon: '\u{1F525}',
        offers: featuredOffers,
        onViewAll: () => {
          setActiveFeatured(true)
          setActiveCategoryId(null)
          setPage(1)
        },
      })
    }

    for (const cat of data.categories) {
      result.push({
        id: cat.id,
        title: cat.name,
        subtitle: cat.offers.length === 1 ? '1 offer' : `${cat.offers.length} offers`,
        icon: cat.icon,
        offers: cat.offers,
        onViewAll: () => {
          setActiveCategoryId(cat.id)
          setActiveFeatured(false)
          setPage(1)
        },
      })
    }

    return result
  }, [groupedQuery.data])

  const selectedOffer = useMemo<EmployeeOffer | null>(() => {
    if (!selectedOfferId) return null
    return findOfferInCaches(
      queryClient,
      ['employee-offers', 'grouped'],
      ['employee-offers', listParams.toString()],
      selectedOfferId,
    )
  }, [selectedOfferId, queryClient, listParams])

  const patchGroupedCache = useCallback(
    (offerId: string, isSaved: boolean) => {
      queryClient.setQueryData<GroupedResponse>(
        ['employee-offers', 'grouped'],
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            data: {
              ...prev.data,
              categories: prev.data.categories.map((cat) => ({
                ...cat,
                offers: cat.offers.map((o) =>
                  o.id === offerId ? { ...o, isSaved } : o,
                ),
              })),
            },
          }
        },
      )
    },
    [queryClient],
  )

  const handleSavedChange = useCallback(
    (offerId: string, isSaved: boolean) => {
      queryClient.setQueryData<OffersResponse | undefined>(
        ['employee-offers', listParams.toString()],
        (prev) => {
          if (!prev?.data) return prev
          const found = findOfferInList(prev.data, offerId)
          if (!found) return prev
          const next = [...prev.data]
          next[found.index] = { ...found.offer, isSaved }
          return { ...prev, data: next }
        },
      )
      patchGroupedCache(offerId, isSaved)
      queryClient.invalidateQueries({ queryKey: ['employee-saved'] })
    },
    [queryClient, listParams, patchGroupedCache],
  )

  const clearFilters = useCallback(() => {
    setActiveCategoryId(null)
    setActiveFeatured(false)
    setSearch('')
    setPage(1)
  }, [])

  const showLoader = hasFilters ? listQuery.isLoading : groupedQuery.isLoading

  return (
    <EmployeeLayout>
      <div className="space-y-6">
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
              setActiveCategoryId(null)
              setActiveFeatured(false)
              setPage(1)
            }}
            className="pl-8"
          />
        </div>

        <BannerCarousel banners={banners} />

        {hasFilters && (activeCategoryId || activeFeatured) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {activeFeatured
                ? 'Showing featured offers'
                : `Showing offers in "${sections.find((s) => s.id === activeCategoryId)?.title ?? ''}"`}
            </span>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto gap-1 p-0 text-xs">
              <X className="h-3 w-3" /> Clear
            </Button>
          </div>
        )}

        {showLoader ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : hasFilters ? (
          searchResultsView(listQuery.data, page, setPage, setSelectedOfferId)
        ) : sections.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No offers available right now. Check back later.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {sections.map((section) => (
              <OfferSection
                key={section.id}
                title={section.title}
                subtitle={section.subtitle}
                icon={section.icon}
                offers={section.offers}
                onViewAll={section.onViewAll}
                onSelectOffer={(id) => setSelectedOfferId(id)}
              />
            ))}
          </div>
        )}
      </div>

      <RedeemModal
        offer={selectedOffer}
        open={!!selectedOffer}
        onOpenChange={(o) => {
          if (!o) setSelectedOfferId(null)
        }}
        onSavedChange={handleSavedChange}
      />
    </EmployeeLayout>
  )
}

function searchResultsView(
  data: OffersResponse | undefined,
  page: number,
  setPage: (p: number) => void,
  onSelect: (id: string) => void,
) {
  if (!data?.data || data.data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No offers match your search.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.data.map((o) => (
          <OfferCard
            key={o.id}
            offer={o}
            onOpen={(offer) => onSelect(offer.id)}
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
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <button
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              onClick={() => setPage(Math.min(data.meta.totalPages, page + 1))}
              disabled={page >= data.meta.totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
