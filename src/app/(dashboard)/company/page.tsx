'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, ShoppingBag, TrendingUp, CreditCard, Plus, ArrowRight } from 'lucide-react'

export default function CompanyDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Employees" value="342" trend={{ value: 5, isUp: true }} icon={Users} />
        <StatCard title="This Month Redemptions" value="487" trend={{ value: 23, isUp: true }} icon={ShoppingBag} />
        <StatCard title="Total Employee Savings" value="$18,430" description="All time" icon={TrendingUp} />
        <StatCard title="Next Billing" value="$1,710" description="Dec 1, 2026" icon={CreditCard} />
      </div>

      {/* Content */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top merchants */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Most Popular Merchants</CardTitle>
            <Button variant="outline" size="sm">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "Pizza Palace", redemptions: 156, savings: '$1,872', rating: 4.8 },
                { name: "Coffee House", redemptions: 98, savings: '$588', rating: 4.9 },
                { name: "Bookworm Store", redemptions: 72, savings: '$1,440', rating: 4.7 },
                { name: "FitLife Gym", redemptions: 65, savings: '$1,950', rating: 4.6 },
                { name: "TechGadgets Pro", redemptions: 54, savings: '$2,160', rating: 4.5 },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {m.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.redemptions} redemptions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-success">{m.savings}</p>
                    <p className="text-xs text-muted-foreground">saved</p>
                  </div>
                  <Badge variant="secondary">{m.rating} ★</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2">
              <Plus className="h-4 w-4" /> Invite Employees
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Users className="h-4 w-4" /> View All Employees
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <TrendingUp className="h-4 w-4" /> View Analytics
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Employee list preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Employees</CardTitle>
          <Badge variant="secondary">342 Total</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Department</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Redemptions</th>
                  <th className="pb-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Sarah Johnson', dept: 'Engineering', status: 'Active', redemptions: 12, joined: '2d ago' },
                  { name: 'Mike Chen', dept: 'Marketing', status: 'Active', redemptions: 8, joined: '1w ago' },
                  { name: 'Emma Wilson', dept: 'Design', status: 'Invited', redemptions: 0, joined: 'Just now' },
                  { name: 'Alex Brown', dept: 'Sales', status: 'Active', redemptions: 5, joined: '2w ago' },
                ].map((e, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 font-medium">{e.name}</td>
                    <td className="py-3 text-muted-foreground">{e.dept}</td>
                    <td className="py-3">
                      <Badge variant={e.status === 'Active' ? 'success' : 'pending'}>{e.status}</Badge>
                    </td>
                    <td className="py-3">{e.redemptions}</td>
                    <td className="py-3 text-muted-foreground">{e.joined}</td>
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
