'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { AnalyticsKPICard } from '@/components/analytics/analytics-kpi-card'
import { AnalyticsBarChart } from '@/components/analytics/analytics-bar-chart'
import { AnalyticsLineChart } from '@/components/analytics/analytics-line-chart'
import { AnalyticsPieChart } from '@/components/analytics/analytics-pie-chart'
import { PIE_COLORS, formatNumber } from '@/components/analytics/analytics-charts'
import { ShoppingBag, TrendingUp, Building2, Store, Gift, Clock, Banknote } from 'lucide-react'

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

interface OverviewResponse {
  data: {
    summary: { totalRedemptions: number; totalDiscount: number; totalSavings: number; activeMerchants: number; activeCompanies: number; activeOffers: number; pendingActions: number }
    periodComparison: { redemptionsChange: number; discountChange: number; savingsChange: number }
  }
}

function formatCurrency(n: number) {
  return `£${Number(n).toFixed(2)}`
}

export default function AdminAnalyticsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin-analytics', params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
      return json as AnalyticsResponse
    },
  })

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin-overview-summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/overview')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
      return json as OverviewResponse
    },
  })

  const loading = analyticsLoading || overviewLoading
  const d = analyticsData?.data
  const ov = overviewData?.data
  const summary = d?.summary
  const ovSummary = ov?.summary
  const comp = ov?.periodComparison

  const byMerchant = d?.byMerchant ?? []
  const byCompany = d?.byCompany ?? []
  const byCategory = d?.byCategory ?? []
  const trend = d?.redemptionTrend ?? []

  const merchantBarData = useMemo(() => {
    if (byMerchant.length === 0) return []
    return byMerchant.slice(0, 10).map((m) => ({
      name: m.businessName.length > 12 ? m.businessName.slice(0, 12) + '...' : m.businessName,
      Redemptions: m.redemptions,
    }))
  }, [byMerchant])

  const companyBarData = useMemo(() => {
    if (byCompany.length === 0) return []
    return byCompany.slice(0, 10).map((c) => ({
      name: c.name.length > 12 ? c.name.slice(0, 12) + '...' : c.name,
      Redemptions: c.redemptions,
    }))
  }, [byCompany])

  const trendLineData = useMemo(() => {
    if (trend.length === 0) return []
    return trend.map((t) => ({
      date: new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      Redemptions: t.total,
    }))
  }, [trend])

  const categoryPieData = useMemo(() => {
    if (byCategory.length === 0) return []
    return byCategory.map((c) => ({ name: c.name, value: c.redemptions }))
  }, [byCategory])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Analytics"
        description="Comprehensive platform-wide metrics and insights"
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <Button variant="outline" onClick={() => { setFrom(''); setTo('') }} className="h-9">
            Reset
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsKPICard label="Total Redemptions" value={ovSummary?.totalRedemptions ?? summary?.totalRedemptions ?? 0} icon={ShoppingBag} iconBg="bg-blue-100 text-blue-600" accentColor="from-blue-500 to-indigo-600" loading={loading} trend={comp ? { value: comp.redemptionsChange, isUpward: comp.redemptionsChange >= 0 } : undefined} />
        <AnalyticsKPICard label="Total Savings" value={formatCurrency(ovSummary?.totalSavings ?? summary?.totalSavings ?? 0)} icon={Banknote} iconBg="bg-emerald-100 text-emerald-600" accentColor="from-emerald-500 to-teal-600" loading={loading} trend={comp ? { value: comp.savingsChange, isUpward: comp.savingsChange >= 0 } : undefined} />
        <AnalyticsKPICard label="Active Merchants" value={ovSummary?.activeMerchants ?? 0} icon={Store} iconBg="bg-purple-100 text-purple-600" accentColor="from-purple-500 to-pink-600" loading={loading} />
        <AnalyticsKPICard label="Active Companies" value={ovSummary?.activeCompanies ?? 0} icon={Building2} iconBg="bg-amber-100 text-amber-600" accentColor="from-amber-500 to-orange-600" loading={loading} />
        <AnalyticsKPICard label="Active Offers" value={ovSummary?.activeOffers ?? 0} icon={Gift} iconBg="bg-rose-100 text-rose-600" accentColor="from-rose-500 to-red-600" loading={loading} />
        <AnalyticsKPICard label="Pending Approvals" value={ovSummary?.pendingActions ?? 0} icon={Clock} iconBg="bg-orange-100 text-orange-600" accentColor="from-orange-500 to-red-600" loading={loading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Redemption Trend
          </CardTitle>
          <CardDescription>Daily redemption activity across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No redemptions in the selected period.</p>
          ) : (
            <AnalyticsLineChart
              data={trendLineData}
              xKey="date"
              lines={[{ key: 'Redemptions', color: '#3b82f6', name: 'Redemptions', dot: true }]}
              height={250}
              emptyMessage="No redemptions yet"
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4" /> Top Merchants by Redemptions
            </CardTitle>
            <CardDescription>Most redeemed merchants in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <AnalyticsBarChart
                data={merchantBarData}
                xKey="name"
                bars={[{ key: 'Redemptions', color: '#3b82f6', name: 'Redemptions' }]}
                height={250}
                emptyMessage="No merchant data available"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Top Companies by Redemptions
            </CardTitle>
            <CardDescription>Most active companies in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <AnalyticsBarChart
                data={companyBarData}
                xKey="name"
                bars={[{ key: 'Redemptions', color: '#8b5cf6', name: 'Redemptions' }]}
                height={250}
                emptyMessage="No company data available"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-4 w-4" /> Redemption by Category
            </CardTitle>
            <CardDescription>Offer category distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <AnalyticsPieChart
                data={categoryPieData}
                height={250}
                outerRadius={85}
                colors={PIE_COLORS}
                showLegend
                legendMax={6}
                emptyMessage="No category data available"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Top Merchants
            </CardTitle>
            <CardDescription>Highest redemption merchants</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : byMerchant.length === 0 ? (
              <p className="text-sm text-muted-foreground">No merchant data available.</p>
            ) : (
              <ul className="space-y-1">
                {byMerchant.slice(0, 8).map((m, i) => (
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
      </div>
    </div>
  )
}
