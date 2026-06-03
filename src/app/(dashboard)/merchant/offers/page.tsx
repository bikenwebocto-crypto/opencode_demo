'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useMerchantOffers, useDeleteMerchantOffer } from '@/hooks/queries/use-merchant-offers'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { showToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import type { ColumnDef } from '@/types'

export default function MerchantOffersPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { data, isLoading } = useMerchantOffers({ page, pageSize: 10, status: statusFilter || undefined, q: search || undefined })
  const deleteOffer = useDeleteMerchantOffer()

  const offers = data?.data ?? []
  const meta = data?.meta ?? { total: 0, totalPages: 1 }

  const handleDelete = useCallback(() => {
    if (!deleteId) return
    deleteOffer.mutate(deleteId, {
      onSuccess: (res: any) => {
        showToast({ type: 'success', title: res.message ?? 'Offer deleted' })
        setDeleteId(null)
      },
      onError: (err: Error) => showToast({ type: 'error', title: 'Delete failed', description: err.message }),
    })
  }, [deleteId, deleteOffer])

  const columns: ColumnDef<any>[] = [
    { key: 'title', header: 'Title' },
    {
      key: 'offerType',
      header: 'Type',
      render: (o: any) => {
        const labels: Record<string, string> = { FLAT: 'Flat', PERCENTAGE: '% Off', BUY_X_GET_Y: 'BOGO' }
        return <span className="text-sm">{labels[o.offerType] ?? o.offerType}</span>
      },
    },
    {
      key: 'discountValue',
      header: 'Value',
      render: (o: any) => <span>${Number(o.discountValue).toFixed(2)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (o: any) => <StatusBadge status={o.status} />,
    },
    {
      key: 'currentRedemptions',
      header: 'Redemptions',
      align: 'center',
      render: (o: any) => {
        const max = o.maxRedemptions ?? '∞'
        return <span>{o.currentRedemptions}/{max}</span>
      },
    },
    {
      key: 'startDate',
      header: 'Start',
      render: (o: any) => new Date(o.startDate).toLocaleDateString('en-US'),
    },
    {
      key: 'endDate',
      header: 'End',
      render: (o: any) => new Date(o.endDate).toLocaleDateString('en-US'),
    },
    {
      key: 'actions',
      header: '',
      render: (o: any) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/merchant/offers/${o.id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-muted-foreground hover:text-foreground"
            title="Edit offer"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          {o.status === 'DRAFT' && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteId(o.id) }}
              className="text-sm text-destructive hover:underline"
              title="Delete offer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <Link
            href={`/merchant/offers/${o.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-primary hover:underline"
            title="View details"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Offers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your discount offers and promotions</p>
        </div>
        <Link href="/merchant/offers/create">
          <Button><Plus className="mr-1 h-4 w-4" /> Create Offer</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <input
          className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Search offers..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="LIVE">Live</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={offers}
        keyExtractor={(o: any) => o.id}
        isLoading={isLoading}
        emptyMessage="No offers found"
        emptyAction={
          <Link href="/merchant/offers/create">
            <Button variant="outline" size="sm"><Plus className="mr-1 h-3 w-3" />Create your first offer</Button>
          </Link>
        }
        pagination={{
          page,
          pageSize: 10,
          total: meta.total,
          onPageChange: setPage,
        }}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Offer"
        message="Are you sure you want to delete this draft offer? This cannot be undone."
        confirmLabel="Delete"
        loading={deleteOffer.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
