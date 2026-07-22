import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function MerchantDashboardLoading() {
  return (
    <div className="space-y-8 pb-8">
      {/* Hero Skeleton */}
      <div className="rounded-xl bg-gradient-to-br from-blue-600/50 via-blue-700/50 to-indigo-800/50 p-6 sm:p-8">
        <div className="space-y-1">
          <Skeleton className="h-4 w-24 bg-white/20" />
          <Skeleton className="h-8 w-48 bg-white/20" />
          <Skeleton className="h-4 w-64 bg-white/20" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><div className="space-y-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-24" /><Skeleton className="h-3 w-16" /></div></CardContent></Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><div className="flex flex-col items-center gap-2"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div></CardContent></Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card><CardContent className="p-5"><div className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div></CardContent></Card>
    </div>
  )
}
