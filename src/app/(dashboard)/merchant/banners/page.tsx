'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { ImageUpload } from '@/components/ui/image-upload'
import { showToast } from '@/hooks/use-toast'
import { Plus, X, Calendar, Image } from 'lucide-react'

interface BannerSlot {
  id: string
  name: string
  position: string
  pricePerDay: number
  minDays: number
  maxDays: number
  description: string | null
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

const POSITION_LABELS: Record<string, string> = {
  HOME_TOP: 'Home Top',
  SIDEBAR: 'Sidebar',
  OFFERS_TOP: 'Offers Top',
}

export default function MerchantBannersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [showBook, setShowBook] = useState(false)
  const [form, setForm] = useState({
    bannerId: '',
    startDate: '',
    endDate: '',
    imageUrl: '',
    altText: '',
    redirectUrl: '',
  })

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

  const { data: positionsData, isLoading: positionsLoading } = useQuery({
    queryKey: ['banner-positions'],
    queryFn: async () => {
      const res = await fetch('/api/banners/positions')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load positions')
      return json as { success: boolean; data: BannerSlot[] }
    },
    enabled: showBook,
  })

  const selectedSlot = positionsData?.data?.find((s) => s.id === form.bannerId)

  useEffect(() => {
    const slots = positionsData?.data
    if (slots && slots.length > 0 && !form.bannerId) {
      setForm((f) => ({ ...f, bannerId: slots[0]!.id }))
    }
  }, [positionsData, form.bannerId])

  const days = form.startDate && form.endDate
    ? Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const totalPrice = selectedSlot && days > 0 ? Number(selectedSlot.pricePerDay) * days : 0

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
      setShowBook(false)
      setForm({ bannerId: '', startDate: '', endDate: '', imageUrl: '', altText: '', redirectUrl: '' })
      showToast({ type: 'success', title: 'Booking submitted', description: 'Your banner booking is pending approval.' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  function handleBook(e: React.FormEvent) {
    e.preventDefault()
    bookMutation.mutate(form)
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
            {positionsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !positionsData?.data?.length ? (
              <p className="text-sm text-muted-foreground">No banner positions available at this time.</p>
            ) : (
              <form onSubmit={handleBook} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Position</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.bannerId}
                    onChange={(e) => setForm((f) => ({ ...f, bannerId: e.target.value }))}
                    required
                  >
                    {positionsData.data.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.name} ({POSITION_LABELS[slot.position] ?? slot.position}) - £{Number(slot.pricePerDay).toFixed(2)}/day
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSlot && (
                  <div className="rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
                    <p>{selectedSlot.description}</p>
                    <p className="mt-1 text-xs">Min: {selectedSlot.minDays} days · Max: {selectedSlot.maxDays} days</p>
                  </div>
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
                      {days} day{days !== 1 ? 's' : ''} × £{Number(selectedSlot?.pricePerDay ?? 0).toFixed(2)}/day
                    </p>
                    <p className="text-lg font-bold">Total: £{totalPrice.toFixed(2)}</p>
                  </div>
                )}

                <ImageUpload
                  value={form.imageUrl}
                  onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
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
                  <LoadingButton type="submit" loading={bookMutation.isPending} disabled={!form.imageUrl} loadingText="Submitting…">
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
            <p className="text-sm text-muted-foreground">No banner bookings yet. Click "Book a Banner" to get started.</p>
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
                        <span className="font-semibold">£{Number(b.totalPrice).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()}
                      {b.content?.imageUrl && (
                        <span className="inline-flex items-center gap-1"><Image className="h-3 w-3" /> Attached</span>
                      )}
                    </div>
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
    </div>
  )
}
