'use client'

import { History, CheckCircle2, XCircle, Edit3, MessageSquare, FileText, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ACTION_META: Record<string, { icon: any; color: string; gradient: string; bg: string; label: string }> = {
  ACTION_QUEUE_APPROVED: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    label: 'Approved',
  },
  ACTION_QUEUE_REJECTED: {
    icon: XCircle,
    color: 'text-rose-600',
    gradient: 'from-rose-500 to-red-600',
    bg: 'bg-rose-100 dark:bg-rose-950/40',
    label: 'Rejected',
  },
  ACTION_QUEUE_EDITED: {
    icon: Edit3,
    color: 'text-blue-600',
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    label: 'Edited & Approved',
  },
  ACTION_QUEUE_REMARK_ADDED: {
    icon: MessageSquare,
    color: 'text-purple-600',
    gradient: 'from-purple-500 to-violet-600',
    bg: 'bg-purple-100 dark:bg-purple-950/40',
    label: 'Remark Added',
  },
  ACTION_QUEUE_SKIPPED: {
    icon: FileText,
    color: 'text-gray-600',
    gradient: 'from-gray-400 to-gray-600',
    bg: 'bg-gray-100 dark:bg-gray-900/40',
    label: 'Skipped',
  },
}

function getMeta(action: string) {
  return (
    ACTION_META[action] ?? {
      icon: FileText,
      color: 'text-muted-foreground',
      gradient: 'from-gray-400 to-gray-600',
      bg: 'bg-muted',
      label: action.replace(/_/g, ' '),
    }
  )
}

function formatChanges(changes: any): string | null {
  if (!changes) return null
  if (typeof changes === 'string') return changes
  if (changes.reason) return `Reason: ${changes.reason}`
  if (changes.remark) return `Remark: ${changes.remark}`
  if (changes.from && changes.to) return `${changes.from} → ${changes.to}`
  if (changes.edits) return `Edited ${Object.keys(changes.edits).length} field(s)`
  return null
}

function formatRelative(date: string | Date) {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

export function AuditTimeline({ logs }: { logs: any[] }) {
  if (!logs || logs.length === 0) {
    return (
      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-600" />
        <CardHeader className="border-b bg-muted/30 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40">
              <History className="h-4 w-4" />
            </div>
            Audit History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <History className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium">No audit events yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Activity will appear here as it happens</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-600" />
      <CardHeader className="border-b bg-muted/30 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40">
            <History className="h-4 w-4" />
          </div>
          Audit History
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {logs.length} {logs.length === 1 ? 'event' : 'events'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="relative space-y-3 pl-2">
          {/* Vertical timeline line */}
          <div className="absolute bottom-3 left-[1.4rem] top-3 w-0.5 bg-gradient-to-b from-violet-200 via-violet-100 to-transparent dark:from-violet-900/40 dark:via-violet-900/20" />

          {logs.map((log: any, idx: number) => {
            const meta = getMeta(log.action)
            const Icon = meta.icon
            const changeText = formatChanges(log.changes)
            return (
              <div key={log.id ?? idx} className="relative flex gap-3 pl-2">
                <div className={`relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white shadow-sm`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {formatRelative(log.createdAt)}
                    </span>
                  </div>
                  {changeText && (
                    <p className="mt-1 text-xs text-muted-foreground">{changeText}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">
                      {log.admin
                        ? `${log.admin.firstName} ${log.admin.lastName}`
                        : 'System'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
