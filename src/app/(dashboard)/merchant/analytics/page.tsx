'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { Eye, Bookmark, ShoppingBag, TrendingUp, MapPin, Award } from 'lucide-react'

interface AnalyticsResponse {
  data: {
    period: { from: string; to: string }
    summary: {
      totalRedemptions: number
      totalDiscount: number
      totalSavings: number
      allTimeRedemptions: number
      allTimeSavings: number
      liveOffers: number
    }
    topOffers: {
      id: string
      title: string
      status: string
      views: number
      saves: number
      redemptions: number
      conversionRate: number
    }[]
    branchPerformance: { id: string; name: string; type: string; redemptions: number }[]
    redemptionTrend: { date: string; total: number }[]
  }
}

async function fetchAnalytics(params: URLSearchParams): Promise<AnalyticsResponse> {
  const res = await fetch(`/api/merchant/analytics/summary?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load analytics')
  return json
}

function formatCurrency(n: number) {
  return `$${Number(n).toFixed(2)}`
}

export default function MerchantAnalyticsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-analytics', params.toString()],
    queryFn: () => fetchAnalytics(params),
  })

  const summary = data?.data.summary
  const topOffers = data?.data.topOffers ?? []
  const branches = data?.data.branchPerformance ?? []
  const trend = data?.data.redemptionTrend ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Performance insights for your offers, branches, and redemptions"
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setFrom('')
              setTo('')
            }}
          >
            Reset
          </Button>
        </CardContent>
      </Card>

      {isLoading || !summary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <ShoppingBag className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Redemptions</p>
                <p className="text-2xl font-bold">{summary.totalRedemptions}</p>
                <p className="text-xs text-muted-foreground">
                  All time: {summary.allTimeRedemptions}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Total Savings</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalSavings)}</p>
                <p className="text-xs text-muted-foreground">
                  All time: {formatCurrency(summary.allTimeSavings)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Eye className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-xs text-muted-foreground">Total Discount</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalDiscount)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Award className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">Live Offers</p>
                <p className="text-2xl font-bold">{summary.liveOffers}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4" /> Top Offers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : topOffers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offer data yet.</p>
            ) : (
              <ul className="space-y-2">
                {topOffers.map((o, i) => (
                  <li key={o.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        #{i + 1} {o.title}
                      </p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{o.status}</span>
                    </div>
                    <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {o.views} views
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Bookmark className="h-3 w-3" /> {o.saves} saves
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ShoppingBag className="h-3 w-3" /> {o.redemptions} redemptions
                      </span>
                      <span>{o.conversionRate}% conv.</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Branch Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : branches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branches yet.</p>
            ) : (
              <ul className="space-y-2">
                {branches.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.type}</p>
                    </div>
                    <span className="text-sm font-semibold">{b.redemptions}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Redemption Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No redemptions in the selected period.</p>
          ) : (
            <div className="space-y-1">
              {trend.map((t) => {
                const max = Math.max(...trend.map((x) => x.total))
                const pct = max > 0 ? (t.total / max) * 100 : 0
                return (
                  <div key={t.date} className="flex items-center gap-2 text-sm">
                    <span className="w-24 text-xs text-muted-foreground">{t.date}</span>
                    <div className="h-6 flex-1 rounded bg-muted">
                      <div
                        className="h-full rounded bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs">{t.total}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
