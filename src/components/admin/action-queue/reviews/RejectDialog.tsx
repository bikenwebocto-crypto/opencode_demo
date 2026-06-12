'use client'

import { useState } from 'react'
import { XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RejectDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  processing: boolean
}

export function RejectDialog({ open, onClose, onConfirm, processing }: RejectDialogProps) {
  const [reason, setReason] = useState('')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold">Reject this item</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              A reason is required. The referenced entity will be marked as rejected.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Rejection Reason <span className="text-destructive">*</span>
          </label>
          <textarea
            className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Explain why this item is being rejected..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason)}
            disabled={processing || !reason.trim()}
          >
            {processing ? 'Processing…' : 'Confirm Rejection'}
          </Button>
        </div>
      </div>
    </div>
  )
}
