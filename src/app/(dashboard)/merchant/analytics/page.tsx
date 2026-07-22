'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { cn } from '@/utils/cn'
import {
  Eye, ShoppingBag, TrendingUp, Award, Gift,
  ArrowUpRight, ArrowDownRight, Banknote,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

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

function formatCurrency(n: number) {
  return `£${Number(n).toFixed(2)}`
}

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280']
const STATUS_LABELS: Record<string, string> = {
  LIVE: 'Live', DRAFT: 'Draft', AWAITING_APPROVAL: 'Pending', EXPIRED: 'Expired', REJECTED: 'Rejected',
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="space-y-3" style={{ height }}>
      <Skeleton className="h-full w-full" />
    </div>
  )
}

interface KpiCardProps {
  title: string
  value: string | number
  trend?: { value: number; isUp: boolean }
  icon: React.ElementType
  accentClass: string
  subtitle?: string
}

function KpiCard({ title, value, trend, icon: Icon, accentClass, subtitle }: KpiCardProps) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <div className="flex items-center gap-1.5">
                <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', trend.isUp ? 'text-emerald-600' : 'text-red-600')}>
                  {trend.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(trend.value)}%
                </span>
                {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
              </div>
            )}
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', accentClass)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function KpiGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}><CardContent className="p-5"><div className="space-y-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-16" /></div></CardContent></Card>
      ))}
    </div>
  )
}

export default function MerchantAnalyticsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-analytics', params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/merchant/analytics/summary?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load analytics')
      return json as AnalyticsResponse
    },
  })

  const summary = data?.data.summary
  const topOffers = data?.data.topOffers ?? []
  const branches = data?.data.branchPerformance ?? []
  const trend = data?.data.redemptionTrend ?? []

  // Bar chart data: monthly views vs redemptions derived from topOffers
  const barData = useMemo(() => {
    if (topOffers.length === 0) return []
    return topOffers.map((o) => ({
      name: o.title.length > 15 ? o.title.slice(0, 15) + '...' : o.title,
      Views: o.views,
      Redemptions: o.redemptions,
    }))
  }, [topOffers])

  // Pie chart data: status distribution derived from topOffers
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {}
    topOffers.forEach((o) => {
      const label = STATUS_LABELS[o.status] ?? o.status
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [topOffers])

  // Derived metrics
  const totalViews = topOffers.reduce((sum, o) => sum + o.views, 0)
  const totalRedemptions = summary?.totalRedemptions ?? 0
  const conversionRate = totalViews > 0 ? ((totalRedemptions / totalViews) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Performance insights for your offers, branches, and redemptions"
      />

      {/* Date filter */}
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

      {/* KPI Summary Cards */}
      {isLoading || !summary ? (
        <KpiGridSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            title="Total Views"
            value={totalViews.toLocaleString()}
            icon={Eye}
            accentClass="bg-blue-600"
          />
          <KpiCard
            title="Total Redemptions"
            value={summary.totalRedemptions}
            icon={ShoppingBag}
            accentClass="bg-emerald-600"
          />
          <KpiCard
            title="Conversion Rate"
            value={`${conversionRate}%`}
            icon={TrendingUp}
            accentClass="bg-purple-600"
          />
          <KpiCard
            title="Campaign Expenditure"
            value={formatCurrency(summary.totalSavings)}
            icon={Banknote}
            accentClass="bg-amber-500"
          />
          <KpiCard
            title="Active Offers"
            value={summary.liveOffers}
            icon={Gift}
            accentClass="bg-rose-500"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar Chart - Monthly Views vs Redemptions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                <ChartBarIcon className="h-3.5 w-3.5 text-blue-600" />
              </div>
              Views vs Redemptions
            </CardTitle>
            <CardDescription>Per-offer view and redemption comparison</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={300} />
            ) : barData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <BarChart className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <h3 className="mt-4 text-sm font-medium">No data yet</h3>
                <p className="mt-1 text-xs text-muted-foreground">Offer data will appear here once your campaigns get engagement</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Views" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Redemptions" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Offer Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100">
                <ChartPieIcon className="h-3.5 w-3.5 text-purple-600" />
              </div>
              Offer Status Distribution
            </CardTitle>
            <CardDescription>Current breakdown of your offer statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={300} />
            ) : pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <PieChart className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <h3 className="mt-4 text-sm font-medium">No offers yet</h3>
                <p className="mt-1 text-xs text-muted-foreground">Create offers to see your status distribution</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Offers */}
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
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {o.views} views</span>
                      <span className="inline-flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> {o.redemptions} redemptions</span>
                      <span>{o.conversionRate}% conv.</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Branch Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4" /> Branch Performance
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

      {/* Redemption Trend */}
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

function ChartBarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

function ChartPieIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  )
}
