'use client'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { ActionQueueItemWithRef } from '@/types'

interface ActionQueueTableProps {
  items: ActionQueueItemWithRef[]
  isLoading?: boolean
  onRowClick?: (item: ActionQueueItemWithRef) => void
}

export function ActionQueueTable({ items, isLoading, onRowClick }: ActionQueueTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    )
  }
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No action queue items found</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-3 font-medium">ID</th>
            <th className="pb-3 font-medium">Type</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Priority</th>
            <th className="pb-3 font-medium">Created</th>
            <th className="pb-3 font-medium">Reference</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
              onClick={() => onRowClick?.(item)}
            >
              <td className="py-3 font-mono text-xs">{item.id.slice(0, 8)}</td>
              <td className="py-3">{item.type.replace(/_/g, ' ')}</td>
              <td className="py-3"><StatusBadge status={item.status} /></td>
              <td className="py-3">{item.priority === 5 ? 'Critical' : item.priority === 4 ? 'High' : item.priority === 3 ? 'Medium' : item.priority === 2 ? 'Low' : 'Trivial'}</td>
              <td className="py-3 text-muted-foreground">{new Date(item.createdAt).toLocaleDateString('en-US')}</td>
              <td className="py-3 font-mono text-xs">{item.referenceId?.slice(0, 8) ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
