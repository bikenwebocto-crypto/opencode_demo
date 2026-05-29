'use client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Check, X } from 'lucide-react'

interface PendingMerchant {
  id: string
  businessName: string
  ownerName: string
  email: string
  category: string
  submittedAt: string
}

interface PendingMerchantCardProps {
  merchant: PendingMerchant
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isProcessing?: boolean
}

export function PendingMerchantCard({ merchant, onApprove, onReject, isProcessing }: PendingMerchantCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="text-sm font-semibold">{(merchant.businessName ?? '?').charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{merchant.businessName}</p>
          <p className="text-sm text-muted-foreground truncate">{merchant.ownerName} &middot; {merchant.email}</p>
          <p className="text-xs text-muted-foreground">{merchant.category} &middot; Submitted {new Date(merchant.submittedAt).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="success" onClick={() => onApprove(merchant.id)} disabled={isProcessing}>
            <Check className="mr-1 h-4 w-4" /> Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onReject(merchant.id)} disabled={isProcessing}>
            <X className="mr-1 h-4 w-4" /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
