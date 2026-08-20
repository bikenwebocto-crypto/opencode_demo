import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function CompanyAnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Card><CardContent className="p-4"><Skeleton className="h-9 w-full" /></CardContent></Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-3"><div className="space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-6 w-20" /></div></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-5"><Skeleton className="h-[250px] w-full" /></CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-[250px] w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  )
}
