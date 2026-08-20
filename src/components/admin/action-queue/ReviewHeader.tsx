'use client'

import { ArrowLeft, ExternalLink, Hash, Clock, Calendar, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { PRIORITY_STYLES, getPriorityLabel } from '@/lib/action-queue-types'
import type { QueueTabKey } from '@/lib/action-queue-types'

interface ReviewHeaderProps {
  queueItem: any
  displayType: string
}

function formatRelativeTime(date: string | Date) {
  if (!date) return '—'
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

export function ReviewHeader({ queueItem, displayType }: ReviewHeaderProps) {
  const priorityLabel = getPriorityLabel(queueItem.priority ?? 0)
  const priorityKey = priorityLabel as keyof typeof PRIORITY_STYLES

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-start gap-4 p-5">
        <Link href="/admin/action-queue" className="flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Back to Operations Center"
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{queueItem.title}</h1>
            <StatusBadge status={queueItem.status} />
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${PRIORITY_STYLES[priorityKey]}`}>
              {priorityLabel} PRIORITY
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-semibold">
              <FileText className="h-3 w-3" />
              {displayType}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Created {new Date(queueItem.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {queueItem.completedAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Clock className="h-3 w-3" />
                Completed {new Date(queueItem.completedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
            {queueItem.referenceId && (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" />
                <code className="text-[10px]">{queueItem.referenceId.slice(0, 8)}…</code>
                <ExternalLink className="h-2.5 w-2.5" />
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(queueItem.createdAt)}
            </span>
          </div>

          {queueItem.description && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Description
              </div>
              <p className="text-sm leading-relaxed">{queueItem.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
