'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { EmployeeLayout } from '@/components/employee/EmployeeLayout'
import { OfferCard, type OfferCardData } from '@/components/employee/OfferCard'
import { RedeemModal, type RedeemModalOffer } from '@/components/employee/RedeemModal'
import { ShoppingBag, TrendingUp, Gift, Bookmark, ChevronRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Stats {
  redemptions: { allTime: number; today: number; thisWeek: number; thisMonth: number }
  totalSavings: number
  savedOffers: number
  activeOffers: number
}

interface OffersResponse {
  data: (OfferCardData & { merchant: any })[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

async function fetchStats(): Promise<{ data: Stats }> {
  const res = await fetch('/api/employee/dashboard/stats')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
}

async function fetchOffers(): Promise<OffersResponse> {
  const res = await fetch('/api/employee/offers?pageSize=6&featured=true')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
}

export default function EmployeeHomePage() {
  const [search, setSearch] = useState('')
  const [redeemOffer, setRedeemOffer] = useState<RedeemModalOffer | null>(null)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['employee-dashboard-stats'],
    queryFn: fetchStats,
  })
  const { data: offers, isLoading: offersLoading } = useQuery({
    queryKey: ['employee-offers', { featured: true }],
    queryFn: fetchOffers,
  })

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Available Offers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover and redeem exclusive offers from local merchants
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="My Redemptions"
            value={stats?.data.redemptions.allTime ?? 0}
            subtitle={stats ? `${stats.data.redemptions.thisWeek} this week` : ''}
            icon={ShoppingBag}
            color="text-blue-600"
            loading={statsLoading}
          />
          <StatCard
            title="Total Saved"
            value={stats ? `$${stats.data.totalSavings.toFixed(2)}` : '$0.00'}
            subtitle={stats ? `${stats.data.redemptions.thisMonth} this month` : ''}
            icon={TrendingUp}
            color="text-green-600"
            loading={statsLoading}
          />
          <StatCard
            title="Active Offers"
            value={stats?.data.activeOffers ?? 0}
            subtitle="Live right now"
            icon={Gift}
            color="text-purple-600"
            loading={statsLoading}
          />
          <StatCard
            title="Saved Offers"
            value={stats?.data.savedOffers ?? 0}
            subtitle="Bookmarked"
            icon={Bookmark}
            color="text-amber-600"
            loading={statsLoading}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span>Featured Offers</span>
              <Link href="/employee/offers">
                <Button variant="ghost" size="sm">
                  View all <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {offersLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-56" />
                <Skeleton className="h-56" />
                <Skeleton className="h-56" />
              </div>
            ) : !offers?.data || offers.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers available right now.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {offers.data.map((o) => (
                  <OfferCard key={o.id} offer={o} onRedeem={setRedeemOffer} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RedeemModal
        open={!!redeemOffer}
        onClose={() => setRedeemOffer(null)}
        offer={redeemOffer}
      />
    </EmployeeLayout>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  loading,
}: {
  title: string
  value: number | string
  subtitle: string
  icon: React.ElementType
  color: string
  loading?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="mt-1 h-5 w-16" />
          ) : (
            <p className="text-xl font-bold">{value}</p>
          )}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
