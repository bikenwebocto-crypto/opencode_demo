'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, PoundSterling, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { showToast } from '@/hooks/use-toast'
import { RedemptionStatusBadge } from './RedemptionStatusBadge'
import { type RedemptionStatus } from '@/lib/redemption-status'

export interface RedemptionSavingsModalRedemption {
  id: string
  status: RedemptionStatus
  offer: { title: string }
  merchant: { businessName: string }
  discountAmount: number | string
  billAmount: number | string | null
  loggedSavingAmount: number | string | null
  savingLoggedAt: string | null
}

interface Props {
  redemption: RedemptionSavingsModalRedemption | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RedemptionSavingsModal({ redemption, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [billAmount, setBillAmount] = useState('')
  const [savingAmount, setSavingAmount] = useState('')
  const [editing, setEditing] = useState(false)

  const alreadyLogged = !!redemption?.savingLoggedAt

  useEffect(() => {
    if (!redemption) return
    setBillAmount(redemption.billAmount != null ? String(redemption.billAmount) : '')
    setSavingAmount(
      redemption.loggedSavingAmount != null ? String(redemption.loggedSavingAmount) : '',
    )
    setEditing(!redemption.savingLoggedAt)
  }, [redemption])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!redemption) throw new Error('No redemption selected')
      const res = await fetch(`/api/employee/redeem/${redemption.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billAmount: Number(billAmount),
          loggedSavingAmount: Number(savingAmount),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to save')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-redemptions'] })
      setEditing(false)
      showToast({ type: 'success', title: 'Savings logged' })
    },
    onError: (err: any) =>
      showToast({
        type: 'error',
        title: 'Failed to save',
        description: err?.message ?? 'Please try again.',
      }),
  })

  if (!open || !redemption) return null

  const r = redemption
  const canLog = r.status === 'CONFIRMED'
  const billValid = billAmount.trim() !== '' && Number(billAmount) >= 0
  const savingValid = savingAmount.trim() !== '' && Number(savingAmount) >= 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md rounded-lg bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-tight">{r.offer.title}</h2>
            <p className="truncate text-sm text-muted-foreground">{r.merchant.businessName}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <RedemptionStatusBadge status={r.status} />
            <span className="text-xs text-muted-foreground">
              Discount offered: €{Number(r.discountAmount).toFixed(2)}
            </span>
          </div>

          {!canLog ? (
            <p className="text-sm text-muted-foreground">
              You can log your bill and savings once the merchant confirms this redemption.
            </p>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PoundSterling className="h-4 w-4" /> Log your bill &amp; savings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {editing ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Billing amount
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={billAmount}
                        onChange={(e) => setBillAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Savings amount
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={savingAmount}
                        onChange={(e) => setSavingAmount(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={!billValid || !savingValid || saveMutation.isPending}
                        onClick={() => saveMutation.mutate()}
                      >
                        {saveMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                          </>
                        ) : (
                          'Save'
                        )}
                      </Button>
                      {alreadyLogged && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saveMutation.isPending}
                          onClick={() => {
                            setBillAmount(r.billAmount != null ? String(r.billAmount) : '')
                            setSavingAmount(
                              r.loggedSavingAmount != null
                                ? String(r.loggedSavingAmount)
                                : '',
                            )
                            setEditing(false)
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md border p-2">
                        <p className="text-xs text-muted-foreground">Billing amount</p>
                        <p className="font-medium">€{Number(r.billAmount).toFixed(2)}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="text-xs text-muted-foreground">Savings amount</p>
                        <p className="font-medium">€{Number(r.loggedSavingAmount).toFixed(2)}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      Edit
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
