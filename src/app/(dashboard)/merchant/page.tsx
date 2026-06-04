'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ShoppingBag, Eye, TrendingUp, Star, Gift, Plus, MapPin } from 'lucide-react'

export default function MerchantDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Today's Redemptions" value="24" trend={{ value: 12, isUp: true }} icon={ShoppingBag} />
        <StatCard title="Active Offer Views" value="1,247" description="Last 7 days" icon={Eye} />
        <StatCard title="Avg. Rating" value="4.8" icon={Star} />
        <StatCard title="This Month Savings" value="$3,240" trend={{ value: 8, isUp: true }} icon={TrendingUp} />
      </div>

      {/* Active offer + Quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Current live offer */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Current Live Offer</CardTitle>
            <Link href="/merchant/offers/create">
            <Button size="sm">
              <Plus className="mr-1 h-3 w-3" /> New Offer
            </Button>
          </Link>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">20% Off All Menu Items</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Valid at all branches · Expires Dec 31, 2026
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="live">Live</Badge>
                    <span className="text-sm text-muted-foreground">245 redemptions · $2,450 savings</span>
                  </div>
                </div>
                <Link href="/merchant/offers">
                  <Button variant="outline" size="sm">Manage</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/merchant/offers/create" className="w-full">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Plus className="h-4 w-4" /> Create New Offer
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-start gap-2">
              <MapPin className="h-4 w-4" /> Manage Branches
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Gift className="h-4 w-4" /> View Redemption History
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent redemptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Redemptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Code</th>
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Discount</th>
                  <th className="pb-3 font-medium">Savings</th>
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { code: 'PRK-A1B2C3', employee: 'Sarah Johnson', discount: '$5.00', savings: '$5.00', time: '2m ago', status: 'Verified' },
                  { code: 'PRK-D4E5F6', employee: 'Mike Chen', discount: '$12.50', savings: '$12.50', time: '15m ago', status: 'Pending' },
                  { code: 'PRK-G7H8I9', employee: 'Emma Wilson', discount: '$8.00', savings: '$8.00', time: '1h ago', status: 'Verified' },
                  { code: 'PRK-J1K2L3', employee: 'Alex Brown', discount: '$20.00', savings: '$20.00', time: '3h ago', status: 'Verified' },
                ].map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 font-mono text-xs">{r.code}</td>
                    <td className="py-3">{r.employee}</td>
                    <td className="py-3 font-medium">{r.discount}</td>
                    <td className="py-3">{r.savings}</td>
                    <td className="py-3 text-muted-foreground">{r.time}</td>
                    <td className="py-3">
                      <Badge variant={r.status === 'Verified' ? 'success' : 'pending'}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
