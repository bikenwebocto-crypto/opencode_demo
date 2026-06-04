'use client'
import { use, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/shared/data-table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useMerchantById, useMerchantOffers, useDeleteMerchant } from '@/hooks/queries/use-merchants'
import { showToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import type { ColumnDef } from '@/types'

export default function MerchantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteMerchant = useDeleteMerchant()

  const handleDelete = useCallback(() => {
    deleteMerchant.mutate(id, {
      onSuccess: (res: any) => {
        showToast({ type: 'success', title: res.message ?? 'Merchant deleted' })
        router.push('/admin/merchants')
      },
      onError: (err: Error) => showToast({ type: 'error', title: 'Delete failed', description: err.message }),
    })
  }, [id, deleteMerchant, router])

  const {
    data: merchantRes,
    isLoading: merchantLoading,
    error: merchantError,
  } = useMerchantById(id)

  const {
    data: offersRes,
    isLoading: offersLoading,
    error: offersError,
  } = useMerchantOffers(id)

  if (merchantLoading) {
    return (
      <div className="space-y-6 py-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (merchantError) {
    showToast({ type: 'error', title: 'Failed to load merchant', description: merchantError.message })
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg font-medium text-destructive">Failed to load merchant</p>
        <p className="mt-1 text-sm text-muted-foreground">{merchantError.message}</p>
        <Link href="/admin/merchants">
          <Button variant="outline" className="mt-4">Back to Merchants</Button>
        </Link>
      </div>
    )
  }

  const merchant = merchantRes?.data
  if (!merchant) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg font-medium text-muted-foreground">Merchant not found</p>
        <Link href="/admin/merchants">
          <Button variant="outline" className="mt-4">Back to Merchants</Button>
        </Link>
      </div>
    )
  }

  const offers = offersRes?.data ?? []
  const cardData = [
    { label: 'Total Offers', value: merchant._count?.offers ?? 0 },
    { label: 'Active Branches', value: merchant._count?.branches ?? 0 },
    { label: 'Redemptions', value: merchant._count?.redemptions ?? 0 },
    { label: 'Rating', value: `${Number(merchant.averageRating ?? 0).toFixed(1)} ★` },
    ...(merchant.liveAt
      ? [{ label: 'Live Since', value: new Date(merchant.liveAt).toLocaleDateString() }]
      : []),
  ]

  const offerColumns: ColumnDef<any>[] = [
    { key: 'title', header: 'Offer', sortable: true },
    {
      key: 'offerType',
      header: 'Type',
      render: (o: any) => <span className="capitalize">{o.offerType?.replace(/_/g, ' ')}</span>,
    },
    {
      key: 'discountValue',
      header: 'Value',
      render: (o: any) => {
        if (o.offerType === 'PERCENTAGE' || o.discountPercent) return `${o.discountPercent ?? 0}%`
        return `$${Number(o.discountValue ?? 0).toFixed(2)}`
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (o: any) => <StatusBadge status={o.status} />,
    },
    { key: 'currentRedemptions', header: 'Redemptions', align: 'center' },
    {
      key: 'startDate',
      header: 'Start',
      render: (o: any) => new Date(o.startDate).toLocaleDateString(),
    },
    {
      key: 'endDate',
      header: 'End',
      render: (o: any) => new Date(o.endDate).toLocaleDateString(),
    },
  ]

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/merchants">
            <Button type="button" variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-sm">{(merchant.businessName ?? '?').charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{merchant.businessName}</h1>
              <StatusBadge status={merchant.status} />
            </div>
            <p className="text-sm text-muted-foreground">{merchant.email} &middot; {merchant.category?.name ?? 'No category'}</p>
            {merchant.adminNote && <p className="mt-1 text-xs text-amber-600">Note: {merchant.adminNote}</p>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
          <Link href={`/admin/merchants/${id}/edit`}>
            <Button variant="outline" size="sm"><Pencil className="mr-1 h-4 w-4" />Edit</Button>
          </Link>
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-1 h-4 w-4" />Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {cardData.map((d) => (
          <Card key={d.label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{d.value}</p>
              <p className="text-xs text-muted-foreground">{d.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5" /> Offers ({offers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {offersLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : offersError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-destructive">Failed to load offers</p>
              <p className="text-xs text-muted-foreground mt-1">{offersError.message}</p>
            </div>
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No offers yet</p>
            </div>
          ) : (
            <DataTable
              columns={offerColumns}
              data={offers}
              keyExtractor={(o: any) => o.id}
              emptyMessage="No offers found"
              onRowClick={(o: any) => {
                setSelectedOffer(o.id)
                showToast({ type: 'info', title: o.title, description: `Status: ${o.status}` })
              }}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Merchant"
        message="Are you sure you want to delete this merchant? It will be soft-deleted."
        confirmLabel="Delete"
        loading={deleteMerchant.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
