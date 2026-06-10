'use client'

import { useState } from 'react'
import { MessageSquare, Plus, RefreshCw, User, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { showToast } from '@/hooks/use-toast'

interface RemarkItem {
  text: string
  by?: string
  at?: string
}

interface RemarksPanelProps {
  queueItem: any
  onAddRemark: (text: string) => Promise<void> | void
  onRefresh?: () => void
}

export function RemarksPanel({ queueItem, onAddRemark, onRefresh }: RemarksPanelProps) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const meta = (queueItem?.metadata as any) ?? {}
  const remarks: RemarkItem[] = Array.isArray(meta.remarks) ? meta.remarks : []

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      await onAddRemark(trimmed)
      setText('')
      showToast({ type: 'success', title: 'Remark added' })
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to add remark', description: err?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Remarks
        </CardTitle>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a remark to this review..."
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            disabled={submitting}
          />
          <Button size="sm" onClick={handleSubmit} disabled={!text.trim() || submitting}>
            <Plus className="mr-1 h-3 w-3" />Add
          </Button>
        </div>

        {remarks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No remarks yet</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {[...remarks].reverse().map((r, i) => (
              <div key={i} className="rounded-md border bg-muted/20 p-3 text-sm">
                <p className="whitespace-pre-wrap">{r.text}</p>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                  {r.at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(r.at).toLocaleString()}
                    </span>
                  )}
                  {r.by && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {r.by.slice(0, 8)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
