'use client'
import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface PendingMerchant {
  id: string
  businessName: string
  ownerName: string
  email: string
  category: string
  submittedAt: string
}

interface PendingMerchantCardProps {
  merchants: PendingMerchant[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isProcessing?: boolean
  pageSize?: number
}

export function PendingMerchantCard({ merchants, onApprove, onReject, isProcessing, pageSize = 10 }: PendingMerchantCardProps) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(merchants.length / pageSize))

  const pageMerchants = useMemo(
    () => merchants.slice((page - 1) * pageSize, page * pageSize),
    [merchants, page, pageSize],
  )

  if (merchants.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No pending merchant approvals</p>
  }

  return (
    <div className="space-y-3">
      {pageMerchants.map((m) => (
        <Card key={m.id}>
          <CardContent className="flex items-center gap-4 p-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-sm font-semibold">{(m.businessName ?? '?').charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{m.businessName}</p>
              <p className="text-sm text-muted-foreground truncate">{m.ownerName} &middot; {m.email}</p>
              <p className="text-xs text-muted-foreground">{m.category} &middot; Submitted {new Date(m.submittedAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="success" onClick={() => onApprove(m.id)} disabled={isProcessing}>
                <Check className="mr-1 h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onReject(m.id)} disabled={isProcessing}>
                <X className="mr-1 h-4 w-4" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
