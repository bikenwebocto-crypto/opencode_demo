'use client'

import { History, CheckCircle2, XCircle, Edit3, MessageSquare, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ACTION_META: Record<string, { icon: any; color: string; label: string }> = {
  ACTION_QUEUE_APPROVED: { icon: CheckCircle2, color: 'text-green-600', label: 'Approved' },
  ACTION_QUEUE_REJECTED: { icon: XCircle, color: 'text-red-600', label: 'Rejected' },
  ACTION_QUEUE_EDITED: { icon: Edit3, color: 'text-blue-600', label: 'Edited & Approved' },
  ACTION_QUEUE_REMARK_ADDED: { icon: MessageSquare, color: 'text-purple-600', label: 'Remark Added' },
  ACTION_QUEUE_SKIPPED: { icon: FileText, color: 'text-gray-600', label: 'Skipped' },
}

function getMeta(action: string) {
  return ACTION_META[action] ?? { icon: FileText, color: 'text-muted-foreground', label: action.replace(/_/g, ' ') }
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

export function AuditTimeline({ logs }: { logs: any[] }) {
  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" /> Audit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No audit events yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" /> Audit History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {logs.map((log: any) => {
            const meta = getMeta(log.action)
            const Icon = meta.icon
            const changeText = formatChanges(log.changes)
            return (
              <div key={log.id} className="flex gap-3 border-l-2 border-muted pl-3">
                <div className={`mt-0.5 ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{meta.label}</p>
                  </div>
                  {changeText && (
                    <p className="text-xs text-muted-foreground">{changeText}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {log.admin
                        ? `${log.admin.firstName} ${log.admin.lastName}`
                        : 'System'}
                    </span>
                    <span>•</span>
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
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
