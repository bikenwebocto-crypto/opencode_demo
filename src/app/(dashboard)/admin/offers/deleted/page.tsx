'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { showToast } from '@/hooks/use-toast'
import { Trash2, RotateCcw, Search, AlertTriangle } from 'lucide-react'

export default function AdminDeletedOffersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-deleted-offers', page, q],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (q) params.set('q', q)
      const res = await fetch(`/api/admin/offers/deleted?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to fetch')
      return json
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const res = await fetch(`/api/admin/offers/${offerId}/restore`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to restore')
      return json
    },
    onSuccess: () => {
      showToast({ type: 'success', title: 'Offer restored' })
      queryClient.invalidateQueries({ queryKey: ['admin-deleted-offers'] })
    },
    onError: (err: Error) => showToast({ type: 'error', title: err.message }),
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const res = await fetch(`/api/admin/offers/${offerId}/permanent`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to permanently delete')
      return json
    },
    onSuccess: () => {
      showToast({ type: 'success', title: 'Offer permanently deleted' })
      setConfirmDelete(null)
      queryClient.invalidateQueries({ queryKey: ['admin-deleted-offers'] })
    },
    onError: (err: Error) => showToast({ type: 'error', title: err.message }),
  })

  const offers = data?.data ?? []
  const meta = data?.meta ?? {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recycle Bin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage soft-deleted offers. Restore or permanently delete.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm"
          placeholder="Search by offer title or merchant..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="h-24" /></Card>
          ))}
        </div>
      ) : offers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No deleted offers found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {offers.map((offer: any) => (
            <Card key={offer.id} className="border-destructive/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{offer.title}</CardTitle>
                    <StatusBadge status={offer.status} label={offer.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Deleted {offer.deletedAt ? new Date(offer.deletedAt).toLocaleString('en-US') : '-'}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>Merchant: {offer.merchant?.businessName ?? 'Unknown'}</div>
                    <div>Redemptions: {offer._count?.redemptions ?? 0}</div>
                    <div>Images: {offer.imageUrls?.length ?? 0} | QR: {offer.qrCodeUrl ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreMutation.mutate(offer.id)}
                      disabled={restoreMutation.isPending}
                    >
                      <RotateCcw className="mr-1 h-4 w-4" /> Restore
                    </Button>
                    {confirmDelete === offer.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => permanentDeleteMutation.mutate(offer.id)}
                          disabled={permanentDeleteMutation.isPending}
                        >
                          <AlertTriangle className="mr-1 h-4 w-4" /> Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        onClick={() => setConfirmDelete(offer.id)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Delete Forever
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
