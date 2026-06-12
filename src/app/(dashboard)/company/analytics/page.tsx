'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { ShoppingBag, Users, TrendingUp, Award, Store, Calendar } from 'lucide-react'

interface AnalyticsResponse {
  data: {
    period: { from: string; to: string }
    summary: {
      totalRedemptions: number
      totalDiscount: number
      totalSavings: number
      allTimeSavings: number
      activeEmployees: number
    }
    topOffers: { offerId: string; title: string; redemptions: number; totalSavings: number }[]
    topMerchants: {
      merchantId: string
      businessName: string
      logoUrl: string | null
      redemptions: number
      totalSavings: number
    }[]
    usageTrend: { date: string; total: number }[]
  }
}

async function fetchAnalytics(params: URLSearchParams): Promise<AnalyticsResponse> {
  const res = await fetch(`/api/company/analytics?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
}

function formatCurrency(n: number) {
  return `$${Number(n).toFixed(2)}`
}

export default function CompanyAnalyticsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const { data, isLoading } = useQuery({
    queryKey: ['company-analytics', params.toString()],
    queryFn: () => fetchAnalytics(params),
  })

  const summary = data?.data.summary
  const topOffers = data?.data.topOffers ?? []
  const topMerchants = data?.data.topMerchants ?? []
  const trend = data?.data.usageTrend ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Company-wide redemption insights" />

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
                <p className="text-xs text-muted-foreground">Total Redemptions</p>
                <p className="text-2xl font-bold">{summary.totalRedemptions}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Active Employees</p>
                <p className="text-2xl font-bold">{summary.activeEmployees}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-xs text-muted-foreground">Savings (period)</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalSavings)}</p>
                <p className="text-xs text-muted-foreground">All time: {formatCurrency(summary.allTimeSavings)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Award className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">Total Discount</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalDiscount)}</p>
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
              <p className="text-sm text-muted-foreground">No redemptions in this period.</p>
            ) : (
              <ul className="space-y-2">
                {topOffers.map((o, i) => (
                  <li key={o.offerId} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span className="truncate">
                      <strong>#{i + 1}</strong> {o.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {o.redemptions} redemptions · {formatCurrency(o.totalSavings)} saved
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4" /> Top Merchants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : topMerchants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No redemptions in this period.</p>
            ) : (
              <ul className="space-y-2">
                {topMerchants.map((m, i) => (
                  <li key={m.merchantId} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    {m.logoUrl ? (
                      <img src={m.logoUrl} alt={m.businessName} className="h-8 w-8 rounded-full border object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                        {m.businessName[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 truncate">
                      <strong>#{i + 1}</strong> {m.businessName}
                    </span>
                    <span className="text-xs text-muted-foreground">{m.redemptions} red.</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" /> Usage Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data in the selected period.</p>
          ) : (
            <div className="space-y-1">
              {trend.map((t) => {
                const max = Math.max(...trend.map((x) => x.total))
                const pct = max > 0 ? (t.total / max) * 100 : 0
                return (
                  <div key={t.date} className="flex items-center gap-2 text-sm">
                    <span className="w-24 text-xs text-muted-foreground">{t.date}</span>
                    <div className="h-6 flex-1 rounded bg-muted">
                      <div className="h-full rounded bg-blue-500" style={{ width: `${pct}%` }} />
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
