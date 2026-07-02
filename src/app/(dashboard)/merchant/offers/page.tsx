'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useMerchantOffers, useBulkDeleteMerchantOffers } from '@/hooks/queries/use-merchant-offers'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { showToast } from '@/hooks/use-toast'
import { Plus, Pencil, ExternalLink, Gift, RefreshCw, Clock, History, Trash2, BadgeCheck, AlertCircle } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import type { ColumnDef } from '@/types'

const statusLabels: Record<string, string> = {
  LIVE: 'Live',
  DRAFT: 'Draft',
  VALIDATION_IN_PROGRESS: 'Validation In Progress',
  AWAITING_APPROVAL: 'Awaiting Approval',
  VALIDATION_FAILED: 'Validation Failed',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  REPLACED: 'Replaced',
  ARCHIVED: 'Archived',
  CHANGES_REQUESTED: 'Changes Requested',
  PENDING_APPROVAL: 'Pending Approval',
  REPLACEMENT_PENDING: 'Replacement Pending',
}

export default function MerchantOffersPage() {
  const [showAdminNotes, setShowAdminNotes] = useState(true)
  const [showRejectionReason, setShowRejectionReason] = useState(true)
  const [tab, setTab] = useState<'all' | 'drafts' | 'history'>('all')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const scope = tab === 'drafts' ? 'drafts' : tab === 'history' ? 'history' : undefined
  const bulkDelete = useBulkDeleteMerchantOffers()

  const { data, isLoading } = useMerchantOffers({
    page,
    pageSize: 10,
    scope,
    q: search || undefined,
  })

  const offers = data?.data ?? []
  const currentLive = data?.currentLive ?? null
  const pendingReplacement = data?.pendingReplacement ?? null
  const pendingReplacementRequest = data?.pendingReplacementRequest ?? null
  const meta = data?.meta ?? { total: 0, totalPages: 1 }

  const columns: ColumnDef<any>[] = [
    { key: 'title', header: 'Title' , render: (o: any) => <span className="font-medium">{o.title}</span> },
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
      render: (o: any) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={o.status} label={statusLabels[o.status] ?? o.status} />
          {o.status === 'LIVE' && (
            <span className="inline-flex w-fit items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-green-800 dark:bg-green-900/40 dark:text-green-200">
              <BadgeCheck className="h-3 w-3" /> LIVE
            </span>
          )}
          {currentLive && o.id === currentLive.id && pendingReplacement && (
            <span className="inline-flex w-fit items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
              <Clock className="h-3 w-3" /> Replacement Pending
            </span>
          )}
        </div>
      ),
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
          {['DRAFT', 'VALIDATION_FAILED','ARCHIVED'].includes(o.status) && (
            <Link
              href={`/merchant/offers/${o.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-muted-foreground hover:text-foreground"
              title="Edit offer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          )}
          {o.status === 'LIVE' && !pendingReplacement && (
            <Link
              href={`/merchant/offers/${o.id}/replace`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              title="Replace offer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Replace
            </Link>
          )}
          {o.status === 'LIVE' && pendingReplacement && (
            <span
              className="inline-flex cursor-not-allowed items-center gap-1 text-sm text-muted-foreground"
              title="You already have a replacement under review."
            >
              <RefreshCw className="h-3.5 w-3.5" /> Replace
            </span>
          )}
          {['DRAFT', 'VALIDATION_FAILED', 'REJECTED', 'EXPIRED', 'REPLACED', 'AWAITING_APPROVAL'].includes(o.status) && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set([o.id])); setDeleteOpen(true) }}
              className="text-sm text-destructive hover:text-destructive/80"
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
      </div>

      {/* Current Live Offer Section */}
      {currentLive ? (
        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gift className="h-5 w-5 text-green-600" />
                Current Live Offer
              </CardTitle>
              <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold uppercase text-green-800 dark:bg-green-900/40 dark:text-green-200">
                <BadgeCheck className="h-3 w-3" /> LIVE
              </span>
              {pendingReplacement && (
                <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold uppercase text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                  <Clock className="h-3 w-3" /> Replacement Pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pendingReplacement ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  title="You already have a replacement under review."
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Replace My Offer
                </Button>
              ) : (
                <Link href={`/merchant/offers/${currentLive.id}/replace`}>
                  <Button size="sm" variant="outline">
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Replace My Offer
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Title</p>
                <p className="font-medium">{currentLive.title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Discount</p>
                <p className="font-medium">${Number(currentLive.discountValue).toFixed(2)} {currentLive.offerType === 'PERCENTAGE' ? `(${currentLive.discountPercent}%)` : ''}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Redemptions</p>
                <p className="font-medium">{currentLive.currentRedemptions}/{currentLive.maxRedemptions ?? '∞'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expires</p>
                <p className="font-medium">{new Date(currentLive.endDate).toLocaleDateString('en-US')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Gift className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No live offer currently</p>
            <Link href="/merchant/offers/create">
              <Button size="sm" className="mt-3"><Plus className="mr-1 h-3.5 w-3.5" /> Create Offer</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Replacement Status Card */}
      {pendingReplacement && currentLive && (
        <Card className="border-blue-300">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {pendingReplacement.status === 'CHANGES_REQUESTED' ? (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              ) : (
                <Clock className="h-4 w-4 text-blue-600" />
              )}
              Replacement {pendingReplacementRequest?.status === 'CLARIFICATION_REQUESTED' || pendingReplacement.status === 'CHANGES_REQUESTED' ? 'Changes Requested' : 'Pending Approval'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs uppercase text-muted-foreground">Current Offer</p>
                <p className="mt-1 font-medium">{currentLive.title}</p>
                <p className="text-xs text-muted-foreground">${Number(currentLive.discountValue).toFixed(2)}</p>
              </div>
              <div className="rounded-md border-2 border-blue-300 bg-blue-50/50 p-3 dark:bg-blue-950/20">
                <p className="text-xs uppercase text-muted-foreground">Replacement</p>
                <p className="mt-1 font-medium">{pendingReplacement.title}</p>
                <p className="text-xs text-muted-foreground">${Number(pendingReplacement.discountValue).toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="text-muted-foreground">
                <span>Submitted {new Date(pendingReplacement.createdAt ?? pendingReplacement.submittedAt ?? Date.now()).toLocaleDateString()}</span>
                <span className="mx-2">·</span>
                <span>Status: <strong className="text-foreground">{statusLabels[pendingReplacement.status] ?? pendingReplacement.status}</strong></span>
              </div>
              <Link href={`/merchant/offers/${pendingReplacement.id}/edit`}>
                <Button size="sm" variant="outline">View Replacement</Button>
              </Link>
            </div>
            {pendingReplacement.status === 'CHANGES_REQUESTED' && pendingReplacement.reviewNotes && showAdminNotes && (
              <Alert
                className="mt-3"
                variant="warning"
                title="Admin notes"
                description={pendingReplacement.reviewNotes}
                onClose={() => setShowAdminNotes(false)}
              />
            )}
            {pendingReplacement.status === 'REJECTED' && pendingReplacement.rejectionReason && showRejectionReason && (
              <Alert
                className="mt-3"
                variant="error"
                title="Rejection reason"
                description={pendingReplacement.rejectionReason}
                onClose={() => setShowRejectionReason(false)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b gap-0">
        {([
          { key: 'all', label: 'All Offers', icon: Gift },
          { key: 'drafts', label: 'Drafts', icon: RefreshCw },
          { key: 'history', label: 'History', icon: History },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1) }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
        <Link
          href="/merchant/offers/archived"
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <History className="h-4 w-4" /> Archived →
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <input
          className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Search offers..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1 text-sm">
            <span className="text-muted-foreground">{selectedIds.size} selected</span>
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete Selected
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={offers}
        keyExtractor={(o: any) => o.id}
        isLoading={isLoading}
        selectable
        selectedIds={selectedIds}
        onSelectChange={setSelectedIds}
        emptyMessage={tab === 'drafts' ? 'No drafts' : tab === 'history' ? 'No offer history' : 'No offers found'}
        pagination={{
          page,
          pageSize: 10,
          total: meta.total,
          onPageChange: setPage,
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Offers"
        message={`Are you sure you want to delete ${selectedIds.size} offer(s)? This will archive them and they will no longer be visible to employees.`}
        confirmLabel={`Delete ${selectedIds.size} Offer(s)`}
        loading={bulkDelete.isPending}
        onConfirm={async () => {
          try {
            await bulkDelete.mutateAsync(Array.from(selectedIds))
            showToast({ type: 'success', title: `${selectedIds.size} offer(s) deleted` })
            setSelectedIds(new Set())
          } catch (err: any) {
            showToast({ type: 'error', title: 'Failed', description: err.message })
          } finally {
            setDeleteOpen(false)
          }
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}
