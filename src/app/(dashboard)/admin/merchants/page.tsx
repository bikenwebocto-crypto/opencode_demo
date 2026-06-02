'use client'
import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { StatusBadge } from '@/components/shared/status-badge'
import { PendingMerchantCard } from '@/features/merchants/components/pending-merchant-card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useMerchants, usePendingMerchants, useApproveMerchant } from '@/hooks/queries/use-merchants'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { showToast } from '@/hooks/use-toast'
import type { ColumnDef, MerchantStatus } from '@/types'

type StatusFilter = MerchantStatus | 'ALL'

export default function MerchantsPage() {
  const router = useRouter()
  const navigateToMerchant = useCallback((id: string) => router.push(`/admin/merchants/${id}`), [router])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'reject'>('suspend')
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null)

  const { page, setPage, pageSize } = useTablePagination({ defaultPageSize: 10 })

  const { data: merchantsData, isLoading: merchantsLoading } = useMerchants({
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    page,
    pageSize,
  })

  const { data: pendingData, isLoading: pendingLoading } = usePendingMerchants()
  const approveMutation = useApproveMerchant()

  const rawMerchants = merchantsData?.data ?? []
  const pendingMerchants = pendingData?.data ?? []
  const pendingCards = useMemo(() =>
    (pendingData?.data ?? []).map((m: any) => ({
      id: m.id,
      businessName: m.businessName ?? '',
      ownerName: m.ownerName ?? '',
      email: m.email ?? '',
      category: typeof m.category === 'string' ? m.category : (m.category?.name ?? ''),
      submittedAt: m.createdAt ?? m.submittedAt ?? new Date().toISOString(),
    })),
  [pendingData])
  const meta = merchantsData?.meta

  const filtered = useMemo(() => {
    if (!search) return rawMerchants
    return rawMerchants.filter((m: any) =>
      m.businessName?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase())
    )
  }, [rawMerchants, search])

  const tableMerchants = useMemo(() =>
    filtered.map((m: any) => ({
      id: m.id,
      name: m.businessName ?? m.name ?? 'Unnamed',
      email: m.email ?? '',
      status: m.status,
      category: m.category?.name ?? m.category ?? '',
      totalOffers: m._count?.offers ?? m.totalOffers ?? 0,
      totalRedemptions: m.totalRedemptions ?? 0,
      rating: Number(m.averageRating ?? m.rating ?? 0),
      joinedAt: m.createdAt ?? m.joinedAt ?? new Date().toISOString(),
    })),
  [filtered])

  const merchantColumns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Merchant',
      sortable: true,
      render: (m: any) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{(m.name ?? '?').charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{m.name}</p>
            <p className="text-xs text-muted-foreground">{m.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category' },
    {
      key: 'status',
      header: 'Status',
      render: (m: any) => <StatusBadge status={m.status} />,
    },
    { key: 'totalOffers', header: 'Offers', align: 'center' },
    { key: 'totalRedemptions', header: 'Redemptions', align: 'center' },
    {
      key: 'rating',
      header: 'Rating',
      align: 'center',
      render: (m: any) => `${Number(m.rating ?? 0).toFixed(1)} ★`,
    },
    {
      key: 'joinedAt',
      header: 'Joined',
      render: (m: any) => new Date(m.joinedAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      render: (m: any) => (
        <Link
          href={`/admin/merchants/${m.id}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View <ExternalLink className="h-3 w-3" />
        </Link>
      ),
    },
  ]

  const handleSuspend = (id: string) => {
    setSelectedMerchant(id)
    setConfirmAction('suspend')
    setConfirmOpen(true)
  }

  const handleReject = (id: string) => {
    setSelectedMerchant(id)
    setConfirmAction('reject')
    setConfirmOpen(true)
  }

  const handleConfirmApprove = (merchantId: string) => {
    approveMutation.mutate(
      { merchantId, status: 'ACTIVE' as MerchantStatus },
      {
        onSuccess: (res: any) => showToast({ type: 'success', title: res.message ?? 'Merchant approved' }),
        onError: (err: Error) => showToast({ type: 'error', title: 'Approval failed', description: err.message }),
      },
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchants"
        description="Manage merchant accounts, approvals, and statuses"
        actions={(
          <Link href="/admin/merchants/add">
            <Button><Plus className="mr-1 h-4 w-4" />Add Merchant</Button>
          </Link>
        )}
      />
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search merchants..."
        filters={[
          {
            key: 'status',
            label: 'All Statuses',
            options: [
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Paused', value: 'PAUSED' },
              { label: 'Suspended', value: 'SUSPENDED' },
              { label: 'Pending', value: 'PENDING' },
              { label: 'Rejected', value: 'REJECTED' },
              { label: 'Archived', value: 'ARCHIVED' },
            ],
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as StatusFilter),
          },
        ]}
      />
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2 text-sm font-medium ${activeTab === 'all' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
        >
          All Merchants
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2 text-sm font-medium ${activeTab === 'pending' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
        >
          Pending Approval
        </button>
      </div>

      {activeTab === 'all' ? (
        <DataTable
          columns={merchantColumns}
          data={tableMerchants}
          keyExtractor={(m: any) => m.id}
          isLoading={merchantsLoading}
          emptyMessage="No merchants found"
          onRowClick={(m) => navigateToMerchant(m.id)}
          pagination={{
            page,
            pageSize,
            total: meta?.total ?? tableMerchants.length,
            onPageChange: setPage,
          }}
        />
      ) : (
        pendingLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : (
          <PendingMerchantCard
            merchants={pendingCards}
            onApprove={(id) => handleConfirmApprove(id)}
            onReject={(id) => handleReject(id)}
            isProcessing={approveMutation.isPending}
          />
        )
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={confirmAction === 'suspend' ? 'Suspend Merchant' : 'Reject Merchant'}
        message={confirmAction === 'suspend' ? 'Are you sure you want to suspend this merchant?' : 'Are you sure you want to reject this merchant application?'}
        confirmLabel={confirmAction === 'suspend' ? 'Suspend' : 'Reject'}
        onConfirm={() => {
          if (confirmAction === 'reject' && selectedMerchant) {
            approveMutation.mutate(
              { merchantId: selectedMerchant, status: 'REJECTED' as MerchantStatus },
              {
                onSuccess: (res: any) => showToast({ type: 'success', title: res.message ?? 'Merchant rejected' }),
                onError: (err: Error) => showToast({ type: 'error', title: 'Failed to reject', description: err.message }),
              },
            )
          }
          setConfirmOpen(false)
          setSelectedMerchant(null)
        }}
        onCancel={() => { setConfirmOpen(false); setSelectedMerchant(null) }}
      />
    </div>
  )
}
