'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { showToast } from '@/hooks/use-toast'
import { ShoppingBag, TrendingUp, Award, MapPin, Search, ExternalLink, Check, X } from 'lucide-react'
import Link from 'next/link'
import { METHOD_LABELS, type RedemptionStatus, type RedemptionMethod } from '@/lib/redemption-status'

interface RedemptionRow {
  id: string
  redemptionCode: string
  discountAmount: number | string
  savingsAmount: number | string
  redeemedAt: string
  branchId: string | null
  employee: { id: string; firstName: string; lastName: string; email: string }
  company: { id: string; name: string }
  offer: { id: string; title: string; offerType: string; discountValue: number | string }
  branch: { id: string; name: string; branchType: string } | null
  status: RedemptionStatus
  method: RedemptionMethod | null
  merchantNotes: string | null
}

interface Metrics {
  today: number
  thisWeek: number
  thisMonth: number
  topOffer: { offerId: string; title: string; redemptions: number } | null
  topBranch: { branchId: string | null; name: string; redemptions: number } | null
}

interface ApiResponse {
  data: RedemptionRow[]
  metrics: Metrics
  topOffers: { offerId: string; title: string; redemptions: number; totalDiscount: number; totalSavings: number }[]
  topBranches: { branchId: string | null; name: string; redemptions: number; totalSavings: number }[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

async function fetchRedemptions(params: URLSearchParams): Promise<ApiResponse> {
  const res = await fetch(`/api/merchant/redemptions?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load redemptions')
  return json
}

function formatCurrency(n: number | string) {
  return `$${Number(n).toFixed(2)}`
}

function formatDateTime(s: string) {
  return new Date(s).toLocaleString()
}

function methodLabel(r: RedemptionRow) {
  if (r.method) return METHOD_LABELS[r.method]
  if (r.branch?.branchType === 'ONLINE' || (!r.branchId && !r.branch)) return 'Online'
  return 'In-Store'
}

const STATUS_STYLES: Record<RedemptionStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  EXPIRED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

export default function MerchantRedemptionsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rejectFor, setRejectFor] = useState<RedemptionRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', '25')
  if (search) params.set('q', search)
  if (status) params.set('status', status)
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const { data, isLoading, error } = useQuery({
    queryKey: ['merchant-redemptions', params.toString()],
    queryFn: () => fetchRedemptions(params),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, action, rejectionReason }: { id: string; action: 'CONFIRM' | 'REJECT'; rejectionReason?: string }) => {
      const res = await fetch(`/api/merchant/redemptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to update status')
      return json
    },
    onSuccess: (_json, vars) => {
      queryClient.invalidateQueries({ queryKey: ['merchant-redemptions'] })
      showToast({
        type: 'success',
        title: vars.action === 'CONFIRM' ? 'Redemption confirmed' : 'Redemption rejected',
      })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Redemptions"
        description="Track who redeemed your offers, where, and when"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <ShoppingBag className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-2xl font-bold">{data?.metrics.today ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">This Week</p>
              <p className="text-2xl font-bold">{data?.metrics.thisWeek ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Award className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">{data?.metrics.thisMonth ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <MapPin className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-xs text-muted-foreground">Top Branch</p>
              <p className="truncate text-sm font-semibold">
                {data?.metrics.topBranch?.name ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {data?.metrics.topBranch?.redemptions ?? 0} redemptions
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performing Offers</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.topOffers && data.topOffers.length > 0 ? (
              <ul className="space-y-2">
                {data.topOffers.map((o, i) => (
                  <li key={o.offerId} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span className="truncate">
                      <strong>#{i + 1}</strong> {o.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {o.redemptions} redemptions · {formatCurrency(o.totalSavings)} saved
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No redemptions yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Branches</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.topBranches && data.topBranches.length > 0 ? (
              <ul className="space-y-2">
                {data.topBranches.map((b, i) => (
                  <li key={b.branchId ?? 'online'} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span className="truncate">
                      <strong>#{i + 1}</strong> {b.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {b.redemptions} redemptions · {formatCurrency(b.totalSavings)} saved
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No branch data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Redemptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee / company / code…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-7"
              />
            </div>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setPage(1)
              }}
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setPage(1)
              }}
            />
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setStatus('')
                setFrom('')
                setTo('')
                setPage(1)
              }}
            >
              Reset
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">Failed to load redemptions.</p>
          ) : !data?.data || data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No redemptions found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="p-2">Code</th>
                      <th className="p-2">Employee</th>
                      <th className="p-2">Company</th>
                      <th className="p-2">Offer</th>
                      <th className="p-2">Branch</th>
                      <th className="p-2">Method</th>
                      <th className="p-2">Status</th>
                      <th className="p-2 text-right">Discount</th>
                      <th className="p-2 text-right">Savings</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-mono text-xs">{r.redemptionCode}</td>
                        <td className="p-2">
                          <div>
                            <p className="font-medium">
                              {r.employee.firstName} {r.employee.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{r.employee.email}</p>
                          </div>
                        </td>
                        <td className="p-2">{r.company.name}</td>
                        <td className="p-2">
                          <Link
                            href={`/merchant/offers/${r.offer.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {r.offer.title} <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                        <td className="p-2">{r.branch?.name ?? '—'}</td>
                        <td className="p-2">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {methodLabel(r)}
                          </span>
                        </td>
                        <td className="p-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-2 text-right">{formatCurrency(r.discountAmount)}</td>
                        <td className="p-2 text-right">{formatCurrency(r.savingsAmount)}</td>
                        <td className="p-2 text-xs text-muted-foreground">{formatDateTime(r.redeemedAt)}</td>
                        <td className="p-2">
                          {r.status === 'PENDING' ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-green-700 hover:bg-green-50"
                                onClick={() => updateStatus.mutate({ id: r.id, action: 'CONFIRM' })}
                                disabled={updateStatus.isPending}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setRejectFor(r)
                                  setRejectReason('')
                                }}
                                disabled={updateStatus.isPending}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-xs text-muted-foreground">
                  Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, data.meta.total)} of {data.meta.total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                    disabled={page >= data.meta.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!rejectFor}
        title="Reject Redemption"
        message={
          rejectFor
            ? `Reject redemption for ${rejectFor.employee.firstName} ${rejectFor.employee.lastName} on "${rejectFor.offer.title}"?`
            : ''
        }
        confirmLabel="Reject"
        variant="destructive"
        loading={updateStatus.isPending}
        onConfirm={async () => {
          if (!rejectFor || !rejectReason.trim()) {
            showToast({ type: 'error', title: 'A reason is required' })
            return
          }
          try {
            await updateStatus.mutateAsync({ id: rejectFor.id, action: 'REJECT', rejectionReason: rejectReason.trim() })
            setRejectFor(null)
            setRejectReason('')
          } catch {
            // toast already shown
          }
        }}
        onCancel={() => {
          setRejectFor(null)
          setRejectReason('')
        }}
      >
        {rejectFor && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium">Rejection reason *</label>
            <textarea
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why…"
              required
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
