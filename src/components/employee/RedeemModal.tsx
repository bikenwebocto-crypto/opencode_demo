'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Tag, CheckCircle2, Copy, ExternalLink, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { showToast } from '@/hooks/use-toast'

export interface RedeemModalOffer {
  id: string
  title: string
  discountValue: number | string
  redemptionType: string | null
  offerCode?: string | null
  bookingUrl?: string | null
  merchant: { id: string; businessName: string; logoUrl: string | null }
  branches?: { id: string; name: string; branchType: string; addressLine1: string; city: string; state: string | null; phone?: string | null }[]
}

interface Props {
  open: boolean
  onClose: () => void
  offer: RedeemModalOffer | null
}

export function RedeemModal({ open, onClose, offer }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [branchId, setBranchId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const redemptionType = offer?.redemptionType

  const redeemMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/employee/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: offer?.id,
          branchId: branchId || null,
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to redeem')
      return json
    },
    onSuccess: (json) => {
      setResult(json.data)
      queryClient.invalidateQueries({ queryKey: ['employee-redemptions'] })
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard-stats'] })
      showToast({
        type: 'success',
        title: 'Redemption submitted',
        description: 'Offer redeemed successfully.',
      })
    },
    onError: (e: any) =>
      showToast({ type: 'error', title: 'Redemption failed', description: e?.message }),
  })

  if (!open || !offer) return null

  function handleClose() {
    onClose()
    setResult(null)
    setBranchId('')
    setNotes('')
    setCopied(false)
  }

  function handleViewRedemptions() {
    handleClose()
    router.push('/employee/redemptions')
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Result state ──────────────────────────────────
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
          <h2 className="mt-3 text-lg font-semibold">
            {result.type === 'IN_STORE_QR' ? 'Redemption submitted' :
             result.type === 'ONLINE_CODE' ? 'Your promo code is ready' :
             result.type === 'BOOKING_LINK' ? 'Booking link ready' :
             'Redemption completed'}
          </h2>

          {result.type === 'ONLINE_CODE' && result.offerCode ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Use this code at checkout on the merchant website.
              </p>
              <div className="rounded-md border bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground">Promo Code</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-widest">{result.offerCode}</p>
              </div>
              <Button className="w-full" variant="outline" onClick={() => handleCopy(result.offerCode)}>
                <Copy className="mr-1 h-4 w-4" />
                {copied ? 'Copied!' : 'Copy Code'}
              </Button>
              {result.merchantWebsite && (
                <a
                  href={result.merchantWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="h-4 w-4" /> Visit Website
                </a>
              )}
              {result.instructions && (
                <p className="text-xs text-muted-foreground">{result.instructions}</p>
              )}
            </div>
          ) : result.type === 'BOOKING_LINK' && result.bookingUrl ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Complete your booking on the merchant's platform.
              </p>
              <a
                href={result.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <ExternalLink className="h-4 w-4" /> Open Booking Website
              </a>
              {result.instructions && (
                <p className="text-xs text-muted-foreground">{result.instructions}</p>
              )}
            </div>
          ) : result.type === 'IN_STORE_QR' && result.branch ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Visit the store below to redeem your offer in person.
              </p>
              <div className="rounded-md border bg-muted/30 p-4 space-y-2">
                <p className="font-semibold">{result.branch.name}</p>
                <p className="text-sm text-muted-foreground">
                  {result.branch.addressLine1}
                  {result.branch.addressLine2 ? `, ${result.branch.addressLine2}` : ''}
                  {result.branch.city ? `, ${result.branch.city}` : ''}
                  {result.branch.state ? `, ${result.branch.state}` : ''}
                  {result.branch.postalCode ? ` ${result.branch.postalCode}` : ''}
                </p>
                {result.branch.phone && (
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" /> {result.branch.phone}
                  </p>
                )}
                {result.branch.googleMapsUrl && (
                  <a
                    href={result.branch.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <MapPin className="h-4 w-4" /> Open in Google Maps
                  </a>
                )}
              </div>
              {result.instructions && (
                <p className="text-sm text-muted-foreground">{result.instructions}</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Your redemption has been recorded.
            </p>
          )}

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

  // ── Form state ────────────────────────────────────
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
          {/* Type badge */}
          {redemptionType && (
            <div className="rounded-md bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Redemption type</p>
              <p className="mt-0.5 text-sm font-semibold">
                {redemptionType === 'IN_STORE_QR' ? 'In-Store (QR Code)' :
                 redemptionType === 'ONLINE_CODE' ? 'Online Code' :
                 redemptionType === 'BOOKING_LINK' ? 'Booking Link' :
                 redemptionType}
              </p>
            </div>
          )}

          {/* Unknown / unconfigured redemption type */}
          {!redemptionType && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200">
              <p className="font-medium">Redemption type not configured</p>
              <p className="mt-1 text-xs">
                This offer cannot be redeemed because the merchant has not specified a redemption method.
              </p>
            </div>
          )}

          {/* IN_STORE_QR: branch selector */}
          {redemptionType === 'IN_STORE_QR' && offer.branches && offer.branches.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Select a store branch *
              </label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">— Select a branch —</option>
                {offer.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.addressLine1}, {b.city}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ONLINE_CODE: info text */}
          {redemptionType === 'ONLINE_CODE' && (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              <MapPin className="mb-1 h-4 w-4" />
              <p>This offer provides a promo code for use on the merchant's website. You will receive the code after confirming.</p>
            </div>
          )}

          {/* BOOKING_LINK: info text */}
          {redemptionType === 'BOOKING_LINK' && offer.bookingUrl && (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              <ExternalLink className="mb-1 h-4 w-4" />
              <p>You will be redirected to the merchant's booking page after confirming.</p>
            </div>
          )}

          {/* Notes (optional) */}
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
            disabled={
              redeemMutation.isPending ||
              !offer ||
              !redemptionType ||
              (redemptionType === 'IN_STORE_QR' && !branchId)
            }
          >
            <Tag className="mr-1 h-4 w-4" />
            {redeemMutation.isPending
              ? 'Submitting…'
              : !redemptionType
                ? 'Cannot Redeem'
                : redemptionType === 'IN_STORE_QR'
                  ? 'Confirm In-Store Redemption'
                  : redemptionType === 'ONLINE_CODE'
                    ? 'Get Promo Code'
                    : 'Get Booking Link'}
          </Button>
        </div>
      </div>
    </div>
  )
}
