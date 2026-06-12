'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/shared/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useDashboardStore } from '@/store/dashboard-store'
import { useActionQueueStore } from '@/store/action-queue-store'
import { useActionQueueStats } from '@/hooks/queries/use-action-queue'
import Link from 'next/link'
import { Store, Building2, ShoppingBag, AlertCircle, Clock, CheckCircle2, FileText, Tag, Shield, Bug, Bell } from 'lucide-react'

export default function AdminDashboard() {
  const summary = useDashboardStore((s) => s.summary)
  const setSummary = useDashboardStore((s) => s.setSummary)
  const pendingCount = useActionQueueStore((s) => s.pendingCount)

  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])

  const { data: stats } = useActionQueueStats()

  useEffect(() => {
    const getData = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/admin/overview')
        if (!res.ok) throw new Error('Failed to fetch admin overview')
        const response = await res.json()
        const { summary, recentActivity, pendingApprovals } = response.data
        setSummary(summary)
        setRecentActivity(recentActivity ?? [])
        setPendingApprovals(pendingApprovals ?? [])
      } catch (error) {
        console.error('Dashboard fetch error:', error)
      } finally {
        setLoading(false)
      }
    }
    getData()
  }, [pendingCount])

  if (loading || !summary) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    )
  }

  const queueCards = [
    {
      title: 'Merchant Applications',
      value: stats?.merchantApplications ?? 0,
      icon: FileText,
      href: '/admin/action-queue?tab=MERCHANT_APPLICATIONS',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Offer Approvals',
      value: (stats?.offerApprovals ?? 0) + (stats?.offerReplacements ?? 0) + (stats?.profileChanges ?? 0),
      icon: Tag,
      href: '/admin/action-queue?tab=OFFER_APPROVALS',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Company Activations',
      value: stats?.companyActivations ?? 0,
      icon: Shield,
      href: '/admin/action-queue?tab=COMPANY_ACTIVATION',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Open Issues',
      value: stats?.openIssues ?? 0,
      icon: Bug,
      href: '/admin/action-queue?tab=ISSUES',
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      title: 'Alerts',
      value: (stats?.renewalAlerts ?? 0) + (stats?.missingPerks ?? 0),
      icon: Bell,
      href: '/admin/action-queue?tab=ALERTS',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ]

  const totalPending = queueCards.reduce((sum, c) => sum + c.value, 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Redemptions"
          value={summary.totalRedemptions?.toLocaleString() ?? '0'}
          trend={{ value: summary.periodComparison?.redemptionsChange ?? 0, isUp: true }}
          icon={ShoppingBag}
        />
        <StatCard
          title="Active Merchants"
          value={summary.activeMerchants ?? 0}
          description={`${summary.activeOffers ?? 0} active offers`}
          icon={Store}
        />
        <StatCard
          title="Active Companies"
          value={summary.activeCompanies ?? 0}
          icon={Building2}
        />
        <StatCard
          title="Pending Reviews"
          value={totalPending}
          icon={AlertCircle}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Action Queue Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {queueCards.map((card) => (
              <Link key={card.title} href={card.href}>
                <div className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 cursor-pointer">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${card.bg}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.title}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Approvals</CardTitle>
            <Link href="/admin/action-queue">
              <Button variant="outline" size="sm">
                View All
                <Clock className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingApprovals.length > 0 ? (
                pendingApprovals.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-md border p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      {item.priority >= 4 ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title ?? item.merchantName ?? 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground">{item.type?.replace(/_/g, ' ')} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">No pending approvals</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">Total Savings</span>
              <span className="text-sm font-semibold">${summary.totalSavings ? (summary.totalSavings / 1000).toFixed(1) : 0}K</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">Avg Discount</span>
              <span className="text-sm font-semibold">${summary.totalDiscount && summary.totalRedemptions ? (summary.totalDiscount / summary.totalRedemptions).toFixed(2) : '0.00'}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">Merchants</span>
              <span className="text-sm font-semibold">{summary.activeMerchants ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Companies</span>
              <span className="text-sm font-semibold">{summary.activeCompanies ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="text-sm">{item.action}</span>
                    <span className="ml-1.5 text-sm font-medium">{item.user}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">No recent activity</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
