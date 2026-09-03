'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { ImageUpload, uploadDeferredImage } from '@/components/ui/image-upload'
import type { DeferredFile } from '@/components/shared/ImageUploader'
import { BANNER_IMAGE_OPTIONS } from '@/lib/upload/image'
import { showToast } from '@/hooks/use-toast'
import { Plus, X, Calendar } from 'lucide-react'

interface SlotInfo {
  slotNumber: number
  status: 'AVAILABLE' | 'PENDING' | 'APPROVED'
  bookingId?: string
  startDate?: string
  bookedUntil?: string
  merchantName?: string
  isOwnBooking?: boolean
}

interface PositionSlots {
  bannerId: string
  position: string
  pricePerDay: number
  minDays: number
  maxDays: number
  slotCount: number
  availableCount: number
  slots: SlotInfo[]
}

interface Booking {
  id: string
  bannerId: string
  startDate: string
  endDate: string
  totalPrice: number
  status: string
  paid: boolean
  createdAt: string
  banner: { id: string; name: string; position: string; pricePerDay: number }
  content: { imageUrl: string; altText: string | null; redirectUrl: string | null } | null
}

interface ApiResponse {
  data: Booking[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
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

function derivedBadges(booking: Booking) {
  const now = new Date()
  const end = new Date(booking.endDate)
  const badges: React.ReactNode[] = []
  if (booking.status === 'APPROVED') {
    if (end < now) {
      badges.push(<span key="expired" className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Expired</span>)
    } else if (!booking.paid) {
      badges.push(<span key="not-visible" className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Not Visible</span>)
    } else {
      badges.push(<span key="visible" className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Visible</span>)
    }
  }
  return badges
}

const POSITION_LABELS: Record<string, string> = {
  TOP: 'Top',
  BOTTOM: 'Bottom',
}

export default function MerchantBannersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [showBook, setShowBook] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingBannerFile, setPendingBannerFile] = useState<DeferredFile | null>(null)

  const [selectedPosition, setSelectedPosition] = useState('TOP')
  const [selectedSlotNumber, setSelectedSlotNumber] = useState<number | null>(null)
  const [form, setForm] = useState({
    bannerId: '',
    startDate: '',
    endDate: '',
    imageUrl: '',
    altText: '',
    redirectUrl: '',
  })

  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [editForm, setEditForm] = useState({ imageUrl: '', altText: '', redirectUrl: '' })
  const [editPendingFile, setEditPendingFile] = useState<DeferredFile | null>(null)

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', '20')
  if (status) params.set('status', status)

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-banners', params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/merchant/banners?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load bookings')
      return json as ApiResponse
    },
  })

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['merchant-banner-slots', selectedPosition],
    queryFn: async () => {
      const res = await fetch(`/api/merchant/banners/slots?position=${selectedPosition}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load slots')
      return json as { success: boolean; data: PositionSlots }
    },
    enabled: showBook,
  })

  const positionSlots = slotsData?.data

  useEffect(() => {
    if (positionSlots?.bannerId) {
      setForm((f) => ({ ...f, bannerId: positionSlots.bannerId }))
    }
  }, [positionSlots?.bannerId])

  const days = form.startDate && form.endDate
    ? Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const totalPrice = positionSlots && days > 0 ? Number(positionSlots.pricePerDay) * days : 0

  const bookMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/merchant/banners/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to book banner')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-banners'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-banner-slots'] })
      setShowBook(false)
      setPendingBannerFile(null)
      setSelectedSlotNumber(null)
      setForm({ bannerId: '', startDate: '', endDate: '', imageUrl: '', altText: '', redirectUrl: '' })
      showToast({ type: 'success', title: 'Booking submitted', description: 'Your banner booking is pending approval.' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  const editMutation = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/merchant/banners/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to update booking')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-banners'] })
      setEditBooking(null)
      setEditPendingFile(null)
      showToast({ type: 'success', title: 'Booking updated' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  function openEdit(b: Booking) {
    setEditBooking(b)
    setEditForm({
      imageUrl: b.content?.imageUrl ?? '',
      altText: b.content?.altText ?? '',
      redirectUrl: b.content?.redirectUrl ?? '',
    })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editBooking) return
    let imageUrl = editForm.imageUrl
    if (editPendingFile) {
      try {
        imageUrl = await uploadDeferredImage(editPendingFile, BANNER_IMAGE_OPTIONS) ?? ''
      } catch (err: any) {
        showToast({ type: 'error', title: 'Image upload failed', description: err?.message })
        return
      }
    }
    editMutation.mutate({ id: editBooking.id, imageUrl, altText: editForm.altText || undefined, redirectUrl: editForm.redirectUrl || undefined })
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    // Upload deferred image before submitting
    let imageUrl = form.imageUrl
    if (pendingBannerFile) {
      try {
        imageUrl = await uploadDeferredImage(pendingBannerFile, BANNER_IMAGE_OPTIONS) ?? ''
      } catch (err: any) {
        showToast({ type: 'error', title: 'Image upload failed', description: err?.message })
        return
      }
    }
    bookMutation.mutate({ ...form, imageUrl })
  }

  const bookings = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banner Bookings"
        description="Book promotional banner slots and manage your bookings"
        actions={
          <Button onClick={() => setShowBook((s) => !s)}>
            <Plus className="mr-1 h-4 w-4" />
            {showBook ? 'Cancel' : 'Book a Banner'}
          </Button>
        }
      />

      {showBook && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Book a Banner Slot</CardTitle>
          </CardHeader>
          <CardContent>
            {(
              <form onSubmit={handleBook} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Position</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={selectedPosition}
                    onChange={(e) => {
                      setSelectedPosition(e.target.value)
                      setSelectedSlotNumber(null)
                    }}
                  >
                    <option value="TOP">Top</option>
                    <option value="BOTTOM">Bottom</option>
                  </select>
                </div>

                {slotsLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : !positionSlots ? (
                  <p className="text-sm text-muted-foreground">No active banner slot for this position.</p>
                ) : (
                  <>
                    <div className="rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
                      <p>
                        ₹{Number(positionSlots.pricePerDay).toFixed(2)}/day · {positionSlots.availableCount} of{' '}
                        {positionSlots.slotCount} slot{positionSlots.slotCount !== 1 ? 's' : ''} available
                      </p>
                      <p className="mt-1 text-xs">
                        Min: {positionSlots.minDays} days · Max: {positionSlots.maxDays} days
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Choose a slot</label>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {positionSlots.slots.map((slot) => {
                          const isAvailable = slot.status === 'AVAILABLE'
                          const isSelected = selectedSlotNumber === slot.slotNumber
                          return (
                            <button
                              type="button"
                              key={slot.slotNumber}
                              disabled={!isAvailable}
                              onClick={() => setSelectedSlotNumber(slot.slotNumber)}
                              className={`min-w-[110px] rounded-md border p-2 text-left text-xs transition-colors ${
                                !isAvailable
                                  ? 'cursor-not-allowed border-muted bg-muted/40 text-muted-foreground'
                                  : isSelected
                                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                                    : 'hover:bg-muted/50'
                              }`}
                            >
                              <p className="font-semibold">Slot {slot.slotNumber}</p>
                              {isAvailable ? (
                                <p className="mt-1 text-emerald-600">Available</p>
                              ) : (
                                <>
                                  <p className="mt-1 text-amber-600">
                                    {slot.status === 'PENDING' ? 'Pending' : 'Booked'}
                                  </p>
                                  {slot.merchantName && (
                                    <p className="mt-0.5 truncate text-muted-foreground">{slot.merchantName}</p>
                                  )}
                                  {slot.bookedUntil && (
                                    <p className="mt-0.5 text-muted-foreground">
                                      until {new Date(slot.bookedUntil).toLocaleDateString()}
                                    </p>
                                  )}
                                </>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Start Date</label>
                    <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">End Date</label>
                    <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} required />
                  </div>
                </div>

                {days > 0 && (
                  <div className="rounded-md bg-primary/10 p-3 text-sm">
                    <p className="font-medium">
                      {days} day{days !== 1 ? 's' : ''} × ₹{Number(positionSlots?.pricePerDay ?? 0).toFixed(2)}/day
                    </p>
                    <p className="text-lg font-bold">Total: ₹{totalPrice.toFixed(2)}</p>
                  </div>
                )}

                <ImageUpload
                  value={form.imageUrl}
                  onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                  onDeferredFile={(file) => setPendingBannerFile(file)}
                  uploadMode="deferred"
                  label="Banner Image *"
                  helperText="Recommended size: 1200×400 px, max 5 MB, PNG/JPG/WEBP"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Alt Text</label>
                    <Input
                      value={form.altText}
                      onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))}
                      placeholder="Describe the banner image"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Redirect URL</label>
                    <Input
                      type="url"
                      value={form.redirectUrl}
                      onChange={(e) => setForm((f) => ({ ...f, redirectUrl: e.target.value }))}
                      placeholder="https://example.com/landing"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowBook(false)}>Cancel</Button>
                  <LoadingButton
                    type="submit"
                    disabled={(!pendingBannerFile && !form.imageUrl) || !selectedSlotNumber}
                    loading={bookMutation.isPending}
                    loadingText="Submitting…"
                  >
                    Submit Booking
                  </LoadingButton>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>My Bookings</span>
            <span className="text-sm text-muted-foreground">{meta?.total ?? 0} total</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No banner bookings yet. Click &quot;Book a Banner&quot; to get started.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {bookings.map((b) => (
                  <li key={b.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{b.banner.name}</p>
                        <span className="text-xs text-muted-foreground">({POSITION_LABELS[b.banner.position] ?? b.banner.position})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(b.status)}
                        {derivedBadges(b)}
                        <span className="font-semibold">₹{Number(b.totalPrice).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()}
                      {b.content?.imageUrl && (
                        <img src={b.content.imageUrl} alt={b.content.altText ?? ''} className="h-16 w-28 cursor-pointer rounded object-cover transition-opacity hover:opacity-80" onClick={() => setPreviewUrl(b.content!.imageUrl)} />
                      )}
                    </div>
                    {b.status === 'PENDING' && (
                      <div className="mt-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(b)}>Edit</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {meta && meta.totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-xs text-muted-foreground">Page {page} of {meta.totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {editBooking && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Edit Booking — {editBooking.banner.name}</span>
              <Button size="sm" variant="outline" onClick={() => setEditBooking(null)}><X className="h-3 w-3" /></Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEdit} className="space-y-3">
              <ImageUpload
                value={editForm.imageUrl}
                onChange={(url) => setEditForm((f) => ({ ...f, imageUrl: url }))}
                onDeferredFile={(file) => setEditPendingFile(file)}
                uploadMode="deferred"
                label="Banner Image"
                helperText="Recommended size: 1200×400 px, max 5 MB, PNG/JPG/WEBP"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Alt Text</label>
                  <Input
                    value={editForm.altText}
                    onChange={(e) => setEditForm((f) => ({ ...f, altText: e.target.value }))}
                    placeholder="Describe the banner image"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Redirect URL</label>
                  <Input
                    type="url"
                    value={editForm.redirectUrl}
                    onChange={(e) => setEditForm((f) => ({ ...f, redirectUrl: e.target.value }))}
                    placeholder="https://example.com/landing"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditBooking(null)}>Cancel</Button>
                <LoadingButton type="submit" loading={editMutation.isPending} loadingText="Saving…">
                  Save Changes
                </LoadingButton>
              </div>
            </form>
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
