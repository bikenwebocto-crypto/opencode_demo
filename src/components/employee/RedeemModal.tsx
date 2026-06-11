'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, QrCode, Store, Globe, Hash, Tag, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { showToast } from '@/hooks/use-toast'
import {
  REDEMPTION_METHODS,
  METHOD_LABELS,
  type RedemptionMethod,
} from '@/lib/redemption-status'

export interface RedeemModalOffer {
  id: string
  title: string
  discountValue: number | string
  merchant: { id: string; businessName: string; logoUrl: string | null }
  branches?: { id: string; name: string; branchType: string }[]
}

interface Props {
  open: boolean
  onClose: () => void
  offer: RedeemModalOffer | null
}

const METHOD_ICONS: Record<RedemptionMethod, React.ElementType> = {
  IN_STORE: Store,
  ONLINE: Globe,
  QR_CODE: QrCode,
  MANUAL_CODE: Hash,
}

export function RedeemModal({ open, onClose, offer }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  // ✅ ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const [method, setMethod] = useState<RedemptionMethod>('IN_STORE')
  const [branchId, setBranchId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<{ redemptionCode: string; status: string } | null>(null)

  const redeemMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/employee/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: offer?.id,  // ✅ Use optional chaining
          method,
          branchId: branchId || null,
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to redeem')
      return json
    },
    onSuccess: (json) => {
      setResult({ redemptionCode: json.data.redemptionCode, status: json.data.status })
      queryClient.invalidateQueries({ queryKey: ['employee-redemptions'] })
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard-stats'] })
      showToast({
        type: 'success',
        title: 'Redemption submitted',
        description: 'Show this code to the merchant.',
      })
    },
    onError: (e: any) =>
      showToast({ type: 'error', title: 'Redemption failed', description: e?.message }),
  })

  // ✅ NOW conditional returns are safe (after all hooks)
  if (!open || !offer) return null

  function handleClose() {
    onClose()
    setResult(null)
    setMethod('IN_STORE')
    setBranchId('')
    setNotes('')
  }

  function handleViewRedemptions() {
    handleClose()
    router.push('/employee/redemptions')
  }

  if (result) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={handleClose}
      >
        <div
          className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <button onClick={handleClose} className="rounded p-1 hover:bg-muted" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="mt-3 text-lg font-semibold">Redemption submitted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Show this code to the merchant to confirm your offer.
          </p>
          <div className="mt-4 rounded-md border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Redemption code</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-wider">{result.redemptionCode}</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button onClick={handleViewRedemptions}>View my redemptions</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Redeem offer</h2>
            <p className="mt-1 text-sm text-muted-foreground">{offer.title}</p>
            <p className="text-xs text-muted-foreground">{offer.merchant.businessName}</p>
          </div>
          <button onClick={handleClose} className="rounded p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Redemption method *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REDEMPTION_METHODS.map((m) => {
                const Icon = METHOD_ICONS[m]
                const active = method === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`flex items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors ${
                      active
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'hover:border-muted-foreground/30'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {METHOD_LABELS[m]}
                  </button>
                )
              })}
            </div>
          </div>

          {offer.branches && offer.branches.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Branch (optional)
              </label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">— Not specific —</option>
                {offer.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.branchType})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the merchant should know…"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={() => redeemMutation.mutate()} 
            disabled={redeemMutation.isPending || !offer}  // ✅ Also disable if no offer
          >
            <Tag className="mr-1 h-4 w-4" />
            {redeemMutation.isPending ? 'Submitting…' : 'Confirm redemption'}
          </Button>
        </div>
      </div>
    </div>
  )
}