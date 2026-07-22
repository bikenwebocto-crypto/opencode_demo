import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function SkeletonPageHeader({ hasDescription = true }: { hasDescription?: boolean }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        {hasDescription && <Skeleton className="h-4 w-72" />}
      </div>
    </div>
  )
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function SkeletonChart({ height = 260, className }: { height?: number; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2" style={{ height }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${25 + Math.random() * 65}%` }} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-full max-w-sm" />
            <Skeleton className="h-8 w-24 ml-auto" />
          </div>
        </div>
        <div className="p-4">
          <div className="flex gap-6 border-b pb-3">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-3 flex-1" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-6 border-b py-3 last:border-0">
              {Array.from({ length: cols }).map((_, j) => (
                <Skeleton key={j} className="h-3 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SkeletonTabs({ tabs = 3 }: { tabs?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 border-b">
        {Array.from({ length: tabs }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-t-md" />
        ))}
        <Skeleton className="h-8 w-20 ml-auto rounded-t-md" />
      </div>
      <SkeletonTable rows={4} cols={4} />
    </div>
  )
}

export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <CardContent className="space-y-5">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </CardContent>
    </Card>
  )
}

export function SkeletonDetailCard({ sections = 3 }: { sections?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: sections }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function SkeletonDashboard({ statCards = 4 }: { statCards?: number }) {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={statCards} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <SkeletonTable rows={4} cols={5} />
    </div>
  )
}

export function SkeletonListPage() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTabs />
    </div>
  )
}

export function SkeletonOfferCards() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <div className="relative h-48 rounded-t-xl bg-muted animate-pulse" />
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
