'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { ShoppingBag, TrendingUp, MapPin, Building2, Tag } from 'lucide-react'

interface AnalyticsResponse {
  data: {
    period: { from: string; to: string }
    summary: { totalRedemptions: number; totalDiscount: number; totalSavings: number }
    byMerchant: { merchantId: string; businessName: string; city: string | null; state: string | null; redemptions: number; totalSavings: number }[]
    byCompany: { companyId: string; name: string; redemptions: number; totalSavings: number }[]
    byCity: { city: string; redemptions: number }[]
    byCategory: { name: string; redemptions: number }[]
    redemptionTrend: { date: string; total: number }[]
  }
}

async function fetchAnalytics(params: URLSearchParams): Promise<AnalyticsResponse> {
  const res = await fetch(`/api/admin/analytics?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
}

function formatCurrency(n: number) {
  return `$${Number(n).toFixed(2)}`
}

export default function AdminAnalyticsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics', params.toString()],
    queryFn: () => fetchAnalytics(params),
  })

  const summary = data?.data.summary
  const byMerchant = data?.data.byMerchant ?? []
  const byCompany = data?.data.byCompany ?? []
  const byCity = data?.data.byCity ?? []
  const byCategory = data?.data.byCategory ?? []
  const trend = data?.data.redemptionTrend ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Platform-wide redemption metrics" />

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
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
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
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Total Savings</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalSavings)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Tag className="h-8 w-8 text-purple-600" />
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
              <Building2 className="h-4 w-4" /> By Merchant
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : byMerchant.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <ul className="space-y-1">
                {byMerchant.map((m, i) => (
                  <li key={m.merchantId} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span className="truncate">
                      <strong>#{i + 1}</strong> {m.businessName}{' '}
                      <span className="text-xs text-muted-foreground">
                        ({[m.city, m.state].filter(Boolean).join(', ') || '—'})
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.redemptions} · {formatCurrency(m.totalSavings)}
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
              <Building2 className="h-4 w-4" /> By Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : byCompany.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <ul className="space-y-1">
                {byCompany.map((c, i) => (
                  <li key={c.companyId} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span className="truncate">
                      <strong>#{i + 1}</strong> {c.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.redemptions} · {formatCurrency(c.totalSavings)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> By City
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : byCity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <ul className="space-y-1">
                {byCity.slice(0, 10).map((c, i) => (
                  <li key={c.city} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>
                      <strong>#{i + 1}</strong> {c.city}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.redemptions}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4" /> By Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <ul className="space-y-1">
                {byCategory.map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>
                      <strong>#{i + 1}</strong> {c.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.redemptions}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
