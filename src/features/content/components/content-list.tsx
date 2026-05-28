'use client'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Edit } from 'lucide-react'

interface ContentItem {
  id: string
  title: string
  type: 'banner' | 'offer' | 'page'
  status: 'DRAFT' | 'LIVE' | 'ARCHIVED'
  updatedAt: string
}

interface ContentListProps {
  items: ContentItem[]
  isLoading?: boolean
  onEdit?: (id: string) => void
}

const typeStyles: Record<string, string> = {
  banner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-500',
  offer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500',
  page: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-500',
}

export function ContentList({ items, isLoading, onEdit }: ContentListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    )
  }
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No content found</p>
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{item.title}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className={typeStyles[item.type]}>{item.type}</Badge>
              <StatusBadge status={item.status} />
              <span className="text-xs text-muted-foreground">Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
          {onEdit && (
            <Button size="sm" variant="ghost" onClick={() => onEdit(item.id)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
