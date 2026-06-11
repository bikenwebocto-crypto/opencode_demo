'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { EmployeeLayout } from '@/components/employee/EmployeeLayout'
import { RedemptionStatusBadge } from '@/components/employee/RedemptionStatusBadge'
import { METHOD_LABELS, type RedemptionStatus, type RedemptionMethod } from '@/lib/redemption-status'
import { Search, ShoppingBag, Copy } from 'lucide-react'
import { showToast } from '@/hooks/use-toast'

interface Redemption {
  id: string
  redemptionCode: string
  discountAmount: number | string
  savingsAmount: number | string
  spentAmount: number | string | null
  redeemedAt: string
  branch: { id: string; name: string; branchType: string } | null
  branchId: string | null
  offer: { id: string; title: string; offerType: string; discountValue: number | string }
  merchant: { id: string; businessName: string; logoUrl: string | null }
  company: { id: string; name: string }
  status: RedemptionStatus
  method: RedemptionMethod | null
  merchantNotes: string | null
  employeeNotes: string | null
}

async function fetchRedemptions(status?: string): Promise<{ data: Redemption[] }> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  const qs = params.toString()
  const res = await fetch(`/api/employee/redeem${qs ? `?${qs}` : ''}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
}

function formatCurrency(n: number | string) {
  return `$${Number(n).toFixed(2)}`
}

const STATUS_FILTERS: { value: RedemptionStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export default function EmployeeRedemptionsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RedemptionStatus | ''>('CONFIRMED')
  const { data, isLoading } = useQuery({
    queryKey: ['employee-redemptions', status],
    queryFn: () => fetchRedemptions(status || undefined),
  })

  const rows = (data?.data ?? []).filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.redemptionCode.toLowerCase().includes(q) ||
      r.offer.title.toLowerCase().includes(q) ||
      r.merchant.businessName.toLowerCase().includes(q)
    )
  })

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(
      () => showToast({ type: 'success', title: 'Code copied' }),
      () => showToast({ type: 'error', title: 'Failed to copy' })
    )
  }

  return (
    <EmployeeLayout>
      <div className="space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShoppingBag className="h-5 w-5" /> My Redemptions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your redemption history
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by code, offer, or merchant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={status}
            onChange={(e) => setStatus(e.target.value as RedemptionStatus | '')}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">No redemptions found</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{r.offer.title}</p>
                      <RedemptionStatusBadge status={r.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.merchant.businessName}
                      {r.branch?.name ? ` · ${r.branch.name}` : ''}
                      {r.method ? ` · ${METHOD_LABELS[r.method]}` : ''}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <button
                        onClick={() => copy(r.redemptionCode)}
                        className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[10px] hover:bg-muted/70"
                        title="Click to copy"
                      >
                        <Copy className="h-3 w-3" /> {r.redemptionCode}
                      </button>
                      <span className="text-muted-foreground">
                        {new Date(r.redeemedAt).toLocaleString()}
                      </span>
                    </div>
                    {r.status === 'REJECTED' && r.merchantNotes && (
                      <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                        Reason: {r.merchantNotes.replace(/^METHOD:\w+\s*\|?\s*|^REJECTED:\s*/, '').trim()}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{formatCurrency(r.savingsAmount)} saved</p>
                    <p className="text-xs text-muted-foreground">
                      Discount {formatCurrency(r.discountAmount)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </EmployeeLayout>
  )
}
