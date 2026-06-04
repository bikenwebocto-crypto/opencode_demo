'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { showToast } from '@/hooks/use-toast'
import { CheckCircle, XCircle, MessageSquare, ExternalLink } from 'lucide-react'

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  AWAITING_APPROVAL: 'Awaiting Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CLARIFICATION_REQUESTED: 'Clarification Requested',
}

export default function AdminOfferReplacementsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('')
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-offer-replacements', filter],
    queryFn: async () => {
      const params = filter ? `?status=${filter}` : ''
      const res = await fetch(`/api/admin/offers/replacements${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to fetch')
      return json
    },
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await fetch('/api/admin/offers/replacements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, adminNotes }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
      return json
    },
    onSuccess: (res) => {
      showToast({ type: 'success', title: res.message })
      setReviewing(null)
      setAdminNotes('')
      queryClient.invalidateQueries({ queryKey: ['admin-offer-replacements'] })
    },
    onError: (err: Error) => showToast({ type: 'error', title: err.message }),
  })

  const requests = data?.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Offer Replacement Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review and moderate merchant offer replacement requests</p>
      </div>

      <div className="flex items-center gap-3">
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All Requests</option>
          <option value="AWAITING_APPROVAL">Awaiting Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CLARIFICATION_REQUESTED">Clarification Requested</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="h-32" /></Card>)}</div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">No replacement requests found</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req: any) => {
            const current = req.currentOffer
            const replacement = req.newOffer
            const merchant = current?.merchant

            return (
              <Card key={req.id} className={req.status === 'AWAITING_APPROVAL' ? 'border-yellow-200' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{merchant?.businessName ?? 'Unknown Merchant'}</CardTitle>
                      <StatusBadge status={req.status} label={statusLabels[req.status]} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Submitted {new Date(req.createdAt).toLocaleDateString('en-US')}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Side-by-side comparison */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* Current Offer */}
                    <div className="rounded-lg border p-4">
                      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground mb-3">
                        <ExternalLink className="h-3.5 w-3.5" /> Current Live Offer
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-muted-foreground">Title:</span> {current?.title}</div>
                        <div><span className="text-muted-foreground">Discount:</span> ${Number(current?.discountValue).toFixed(2)}</div>
                        <div><span className="text-muted-foreground">Type:</span> {current?.offerType}</div>
                        <div><span className="text-muted-foreground">Expires:</span> {current?.endDate ? new Date(current.endDate).toLocaleDateString('en-US') : '-'}</div>
                        {current?.termsAndConditions && <div><span className="text-muted-foreground">Terms:</span> <span className="text-xs">{current.termsAndConditions.substring(0, 100)}...</span></div>}
                      </div>
                    </div>

                    {/* Replacement Offer */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 mb-3">
                        <ExternalLink className="h-3.5 w-3.5" /> Replacement Offer
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-muted-foreground">Title:</span> <span className="font-medium">{replacement?.title}</span></div>
                        <div><span className="text-muted-foreground">Discount:</span> <span className="font-medium">${Number(replacement?.discountValue).toFixed(2)} {replacement?.offerType === 'PERCENTAGE' && replacement?.discountPercent ? `(${replacement.discountPercent}%)` : ''}</span></div>
                        <div><span className="text-muted-foreground">Type:</span> {replacement?.offerType}</div>
                        <div><span className="text-muted-foreground">Dates:</span> {replacement?.startDate ? new Date(replacement.startDate).toLocaleDateString('en-US') : '-'} → {replacement?.endDate ? new Date(replacement.endDate).toLocaleDateString('en-US') : '-'}</div>
                        {replacement?.shortDescription && <div><span className="text-muted-foreground">Summary:</span> {replacement.shortDescription}</div>}
                        {replacement?.submissionNotes && <div><span className="text-muted-foreground">Notes:</span> <span className="text-xs">{replacement.submissionNotes}</span></div>}
                        {replacement?.termsAndConditions && <div><span className="text-muted-foreground">Terms:</span> <span className="text-xs">{replacement.termsAndConditions.substring(0, 100)}...</span></div>}
                      </div>
                    </div>
                  </div>

                  {/* Admin actions for pending requests */}
                  {req.status === 'AWAITING_APPROVAL' && (
                    <div className="mt-4 space-y-3">
                      {reviewing === req.id ? (
                        <div className="space-y-3">
                          <textarea
                            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                            placeholder="Admin notes (required for rejection/clarification)..."
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => reviewMutation.mutate({ id: req.id, action: 'APPROVE' })}
                              disabled={reviewMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="mr-1 h-4 w-4" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => reviewMutation.mutate({ id: req.id, action: 'REJECT' })}
                              disabled={reviewMutation.isPending || !adminNotes.trim()}
                            >
                              <XCircle className="mr-1 h-4 w-4" /> Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reviewMutation.mutate({ id: req.id, action: 'CLARIFICATION' })}
                              disabled={reviewMutation.isPending || !adminNotes.trim()}
                            >
                              <MessageSquare className="mr-1 h-4 w-4" /> Request Clarification
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setReviewing(null); setAdminNotes('') }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => setReviewing(req.id)}>
                          Review Replacement
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Show admin notes for reviewed requests */}
                  {req.adminNotes && (
                    <div className="mt-3 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      <span className="font-medium">Admin notes:</span> {req.adminNotes}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
