'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { showToast } from '@/hooks/use-toast'
import { Plus, X, Check, Ban, EyeOff, Eye, ToggleLeft, ToggleRight } from 'lucide-react'

interface Banner {
  id: string
  name: string
  description: string | null
  position: string
  pricePerDay: number
  minDays: number
  maxDays: number
  isActive: boolean
  createdAt: string
  _count: { bookings: number }
}

interface Booking {
  id: string
  bannerId: string
  merchantId: string
  startDate: string
  endDate: string
  totalPrice: number
  status: string
  paid: boolean
  rejectedReason: string | null
  createdAt: string
  banner: { id: string; name: string; position: string }
  merchant: { id: string; businessName: string }
  content: { imageUrl: string; altText: string | null; redirectUrl: string | null } | null
}

const POSITION_LABELS: Record<string, string> = {
  HOME_TOP: 'Home Top',
  SIDEBAR: 'Sidebar',
  OFFERS_TOP: 'Offers Top',
}

function statusBadge(s: string) {
  const cls =
    s === 'PENDING' ? 'bg-yellow-100 text-yellow-800'
    : s === 'APPROVED' ? 'bg-green-100 text-green-800'
    : s === 'REJECTED' ? 'bg-red-100 text-red-800'
    : s === 'CANCELLED' ? 'bg-gray-100 text-gray-800'
    : 'bg-gray-100 text-gray-800'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{s}</span>
}

export default function AdminBannersPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'banners' | 'bookings'>('banners')
  const [page, setPage] = useState(1)
  const [bookingsPage, setBookingsPage] = useState(1)
  const [bookingsStatus, setBookingsStatus] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', description: '', position: 'HOME_TOP', pricePerDay: '', minDays: '7', maxDays: '30',
  })

  const [editBanner, setEditBanner] = useState<Banner | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', pricePerDay: '', minDays: '', maxDays: '' })

  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data: bannersData, isLoading: bannersLoading } = useQuery({
    queryKey: ['admin-banners', page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      const res = await fetch(`/api/admin/banners?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
      return json
    },
  })

  const bParams = new URLSearchParams()
  bParams.set('page', String(bookingsPage))
  bParams.set('pageSize', '20')
  if (bookingsStatus) bParams.set('status', bookingsStatus)

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['admin-banner-bookings', bParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/banners/bookings?${bParams}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
      return json
    },
    enabled: tab === 'bookings',
  })

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to create')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] })
      setShowCreate(false)
      setCreateForm({ name: '', description: '', position: 'HOME_TOP', pricePerDay: '', minDays: '7', maxDays: '30' })
      showToast({ type: 'success', title: 'Banner slot created' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to update')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] })
      setEditBanner(null)
      showToast({ type: 'success', title: 'Banner slot updated' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/banners/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to toggle')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] })
      showToast({ type: 'success', title: 'Banner status toggled' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/banners/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to review')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banner-bookings'] })
      setReviewBooking(null)
      setRejectReason('')
      showToast({ type: 'success', title: 'Booking reviewed' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate({
      name: createForm.name,
      description: createForm.description || undefined,
      position: createForm.position,
      pricePerDay: parseFloat(createForm.pricePerDay),
      minDays: parseInt(createForm.minDays),
      maxDays: parseInt(createForm.maxDays),
    })
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editBanner) return
    updateMutation.mutate({
      id: editBanner.id,
      name: editForm.name,
      description: editForm.description || undefined,
      pricePerDay: parseFloat(editForm.pricePerDay),
      minDays: parseInt(editForm.minDays),
      maxDays: parseInt(editForm.maxDays),
    })
  }

  function openEdit(banner: Banner) {
    setEditBanner(banner)
    setEditForm({
      name: banner.name,
      description: banner.description ?? '',
      pricePerDay: String(banner.pricePerDay),
      minDays: String(banner.minDays),
      maxDays: String(banner.maxDays),
    })
  }

  function handleApprove(booking: Booking) {
    reviewMutation.mutate({ id: booking.id, status: 'APPROVED' })
  }

  function handleReject() {
    if (!reviewBooking) return
    reviewMutation.mutate({ id: reviewBooking.id, status: 'REJECTED', rejectedReason: rejectReason || undefined })
  }

  const banners = bannersData?.data ?? []
  const bannersMeta = bannersData?.meta
  const bookings = bookingsData?.data ?? []
  const bookingsMeta = bookingsData?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banner Management"
        description="Manage banner slots and review booking requests"
      />

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('banners')}
          className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'banners' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Banner Slots
        </button>
        <button
          onClick={() => setTab('bookings')}
          className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'bookings' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Bookings
        </button>
      </div>

      {tab === 'banners' && (
        <>
          <Button onClick={() => setShowCreate((s) => !s)}>
            <Plus className="mr-1 h-4 w-4" />
            {showCreate ? 'Cancel' : 'Create Banner Slot'}
          </Button>

          {showCreate && (
            <Card>
              <CardHeader><CardTitle className="text-base">Create Banner Slot</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Name *</label>
                      <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Position *</label>
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={createForm.position}
                        onChange={(e) => setCreateForm((f) => ({ ...f, position: e.target.value }))}
                      >
                        <option value="HOME_TOP">Home Top</option>
                        <option value="SIDEBAR">Sidebar</option>
                        <option value="OFFERS_TOP">Offers Top</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
                    <Input value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Price Per Day (£) *</label>
                      <Input type="number" step="0.01" min="0" value={createForm.pricePerDay} onChange={(e) => setCreateForm((f) => ({ ...f, pricePerDay: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Min Days</label>
                      <Input type="number" min="1" value={createForm.minDays} onChange={(e) => setCreateForm((f) => ({ ...f, minDays: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Days</label>
                      <Input type="number" min="1" value={createForm.maxDays} onChange={(e) => setCreateForm((f) => ({ ...f, maxDays: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                    <LoadingButton type="submit" loading={createMutation.isPending} loadingText="Creating…">
                      Create
                    </LoadingButton>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Banner Slots</CardTitle>
            </CardHeader>
            <CardContent>
              {bannersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" />
                </div>
              ) : banners.length === 0 ? (
                <p className="text-sm text-muted-foreground">No banner slots created yet.</p>
              ) : (
                <div className="space-y-2">
                  {banners.map((b: Banner) => (
                    <div key={b.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{b.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {b.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{POSITION_LABELS[b.position] ?? b.position}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">£{Number(b.pricePerDay).toFixed(2)}/day</span>
                          <Button size="sm" variant="outline" onClick={() => openEdit(b)}>Edit</Button>
                          <LoadingButton size="sm" variant="outline" loading={toggleMutation.isPending} onClick={() => toggleMutation.mutate({ id: b.id, isActive: !b.isActive })}>
                            {b.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                          </LoadingButton>
                        </div>
                      </div>
                      {b.description && <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">{b._count.bookings} bookings · Min {b.minDays}d · Max {b.maxDays}d</p>
                    </div>
                  ))}
                </div>
              )}
              {bannersMeta && bannersMeta.totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-xs text-muted-foreground">Page {page} of {bannersMeta.totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(bannersMeta.totalPages, p + 1))} disabled={page >= bannersMeta.totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {editBanner && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Edit: {editBanner.name}</span>
                  <Button size="sm" variant="outline" onClick={() => setEditBanner(null)}><X className="h-3 w-3" /></Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEdit} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
                      <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
                      <Input value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Price Per Day (£)</label>
                      <Input type="number" step="0.01" min="0" value={editForm.pricePerDay} onChange={(e) => setEditForm((f) => ({ ...f, pricePerDay: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Min Days</label>
                      <Input type="number" min="1" value={editForm.minDays} onChange={(e) => setEditForm((f) => ({ ...f, minDays: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Days</label>
                      <Input type="number" min="1" value={editForm.maxDays} onChange={(e) => setEditForm((f) => ({ ...f, maxDays: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setEditBanner(null)}>Cancel</Button>
                    <LoadingButton type="submit" loading={updateMutation.isPending} loadingText="Saving…">
                      Save
                    </LoadingButton>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === 'bookings' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Booking Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={bookingsStatus}
                onChange={(e) => { setBookingsStatus(e.target.value); setBookingsPage(1) }}
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {bookingsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" />
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings found.</p>
            ) : (
              <div className="space-y-2">
                {bookings.map((b: Booking) => (
                  <div key={b.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{b.banner.name} <span className="text-xs text-muted-foreground">({POSITION_LABELS[b.banner.position] ?? b.banner.position})</span></p>
                        <p className="text-xs text-muted-foreground">{b.merchant.businessName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(b.status)}
                        <span className="font-semibold">£{Number(b.totalPrice).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()}
                    </div>
                    {b.content?.imageUrl && (
                      <img src={b.content.imageUrl} alt={b.content.altText ?? ''} className="mt-2 h-20 w-full cursor-pointer rounded object-cover transition-opacity hover:opacity-80" onClick={() => setPreviewUrl(b.content!.imageUrl)} />
                    )}
                    {b.status === 'PENDING' && (
                      <div className="mt-2 flex gap-2">
                        <LoadingButton size="sm" loading={reviewMutation.isPending} onClick={() => handleApprove(b)}><Check className="mr-1 h-3 w-3" /> Approve</LoadingButton>
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/50" onClick={() => { setReviewBooking(b); setRejectReason('') }}>
                          <Ban className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </div>
                    )}
                    {b.rejectedReason && (
                      <p className="mt-1 text-xs text-red-600">Reason: {b.rejectedReason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {bookingsMeta && bookingsMeta.totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-xs text-muted-foreground">Page {bookingsPage} of {bookingsMeta.totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setBookingsPage((p) => Math.max(1, p - 1))} disabled={bookingsPage <= 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setBookingsPage((p) => Math.min(bookingsMeta.totalPages, p + 1))} disabled={bookingsPage >= bookingsMeta.totalPages}>Next</Button>
                </div>
              </div>
            )}

            {reviewBooking && (
              <Card className="mt-4 border-destructive/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Reject Booking</span>
                    <Button size="sm" variant="outline" onClick={() => setReviewBooking(null)}><X className="h-3 w-3" /></Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Rejecting booking for <strong>{reviewBooking.banner.name}</strong> by {reviewBooking.merchant.businessName}
                  </p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Rejection Reason</label>
                    <textarea
                      rows={3}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Optional reason for rejection"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setReviewBooking(null)}>Cancel</Button>
                    <LoadingButton variant="destructive" onClick={handleReject} loading={reviewMutation.isPending} loadingText="Rejecting…">
                      Reject Booking
                    </LoadingButton>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img src={previewUrl} alt="" className="max-h-[90vh] max-w-[90vw] rounded object-contain" />
            <button className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background shadow-md" onClick={() => setPreviewUrl(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
