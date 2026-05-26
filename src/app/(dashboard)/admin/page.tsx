'use client'
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useDashboardStore } from '@/store/dashboard-store'
import { useActionQueueStore } from '@/store/action-queue-store'
import { Store, Building2, Users, ShoppingBag, ArrowRight, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'

export default function AdminDashboard() {
  const summary = useDashboardStore((s) => s.summary)
  const setSummary = useDashboardStore((s) => s.setSummary)
  const pendingCount = useActionQueueStore((s) => s.pendingCount)

  useEffect(() => {
    // Simulate data load
    setSummary({
      totalRedemptions: 15420,
      totalDiscount: 328450,
      totalSavings: 452800,
      activeMerchants: 184,
      activeCompanies: 56,
      activeOffers: 312,
      pendingActions: pendingCount,
      periodComparison: { redemptionsChange: 23, discountChange: 18, savingsChange: 15 },
    })
  }, [pendingCount, setSummary])

  if (!summary) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Redemptions"
          value={summary.totalRedemptions.toLocaleString()}
          trend={{ value: summary.periodComparison.redemptionsChange, isUp: true }}
          icon={ShoppingBag}
        />
        <StatCard
          title="Active Merchants"
          value={summary.activeMerchants}
          description={`${summary.activeOffers} active offers`}
          icon={Store}
        />
        <StatCard
          title="Active Companies"
          value={summary.activeCompanies}
          icon={Building2}
        />
        <StatCard
          title="Pending Actions"
          value={summary.pendingActions}
          icon={AlertCircle}
        />
      </div>

      {/* Action Queue & Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Pending approvals */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Approvals</CardTitle>
            <Button variant="outline" size="sm">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { type: 'Merchant', name: "Joe's Coffee Shop", time: '2m ago', status: 'pending' },
                { type: 'Offer', name: '20% Off Everything', time: '15m ago', status: 'pending' },
                { type: 'Company', name: 'TechCorp Inc.', time: '1h ago', status: 'pending' },
                { type: 'Issue', name: 'Redemption not honored', time: '3h ago', status: 'urgent' },
                { type: 'Offer', name: 'Buy 1 Get 1 Free', time: '5h ago', status: 'pending' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {item.status === 'urgent' ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.type} · {item.time}</p>
                  </div>
                  <Badge variant={item.status === 'urgent' ? 'destructive' : 'pending'}>
                    {item.status === 'urgent' ? 'Urgent' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Total Savings to Employees', value: `$${(summary.totalSavings / 1000).toFixed(1)}K` },
              { label: 'Avg Discount per Redemption', value: `$${(summary.totalDiscount / summary.totalRedemptions).toFixed(2)}` },
              { label: 'Merchants Onboarded (30d)', value: '12' },
              { label: 'Companies Onboarded (30d)', value: '5' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-semibold">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: 'New merchant approved', user: 'TechGadgets Pro', time: 'Just now', icon: CheckCircle2 },
              { action: 'Offer went live', user: '20% Off Pizza Palace', time: '5m ago', icon: CheckCircle2 },
              { action: 'Company activated', user: 'Global Solutions Ltd', time: '1h ago', icon: Building2 },
              { action: 'Bulk employee import', user: 'TechCorp (245 employees)', time: '2h ago', icon: Users },
              { action: 'Merchant suspended', user: 'FakeStore 123', time: '6h ago', icon: AlertCircle },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-sm">{item.action}</span>
                  <span className="ml-1.5 text-sm font-medium">{item.user}</span>
                </div>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
