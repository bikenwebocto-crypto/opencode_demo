'use client'

import { ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { PRIORITY_STYLES, getPriorityLabel } from '@/lib/action-queue-types'
import type { QueueTabKey } from '@/lib/action-queue-types'

interface ReviewHeaderProps {
  queueItem: any
  displayType: string
}

export function ReviewHeader({ queueItem, displayType }: ReviewHeaderProps) {
  const priorityLabel = getPriorityLabel(queueItem.priority ?? 0)

  return (
    <div className="flex items-start gap-4">
      <Link href="/admin/action-queue">
        <Button type="button" variant="ghost" size="icon" aria-label="Back to Operations Center">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </Link>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{queueItem.title}</h1>
          <StatusBadge status={queueItem.status} />
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priorityLabel]}`}>
            {priorityLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">{displayType}</span>
          <span>
            Created {new Date(queueItem.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          {queueItem.completedAt && (
            <span>
              Completed {new Date(queueItem.completedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
          {queueItem.referenceId && (
            <span className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Ref: <code className="text-[10px]">{queueItem.referenceId.slice(0, 8)}…</code>
            </span>
          )}
        </div>
        {queueItem.description && (
          <p className="max-w-3xl text-sm text-muted-foreground">{queueItem.description}</p>
        )}
      </div>
    </div>
  )
}
