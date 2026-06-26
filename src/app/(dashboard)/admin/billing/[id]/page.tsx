'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { showToast } from '@/hooks/use-toast'
import { Alert } from '@/components/ui/alert'
import {
  ArrowLeft,
  Building2,
  Users,
  TrendingUp,
  CalendarClock,
  Receipt,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Flag,
  X,
  CheckCircle,
  History,
  CircleAlert,
  ExternalLink,
} from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-300',
  INVOICE_OVERDUE: 'bg-amber-100 text-amber-800 border-amber-300',
  ON_HOLD: 'bg-red-100 text-red-800 border-red-300',
}

const READINESS_STYLES: Record<string, string> = {
  READY: 'bg-green-100 text-green-800 border-green-300',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-800 border-amber-300',
  BLOCKED: 'bg-red-100 text-red-800 border-red-300',
}

const READINESS_LABEL: Record<string, string> = {
  READY: 'Ready for Renewal',
  NEEDS_REVIEW: 'Needs Review',
  BLOCKED: 'Blocked',
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['INVOICE_OVERDUE', 'ON_HOLD'],
  INVOICE_OVERDUE: ['ACTIVE', 'ON_HOLD'],
  ON_HOLD: ['ACTIVE'],
}

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function ReadinessPill({ readiness }: { readiness: string }) {
  const style = READINESS_STYLES[readiness] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      {readiness === 'READY' && <CheckCircle2 className="h-3 w-3" />}
      {readiness === 'NEEDS_REVIEW' && <AlertTriangle className="h-3 w-3" />}
      {readiness === 'BLOCKED' && <ShieldAlert className="h-3 w-3" />}
      {READINESS_LABEL[readiness] ?? readiness}
    </span>
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null
  const d = new Date(value).getTime()
  if (Number.isNaN(d)) return null
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function AdminBillingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-billing', 'company', id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/billing/companies/${id}`)
      const json = await res.json()
      if (!res.ok)
        throw new Error(json.error?.message ?? 'Failed to load billing')
      return json.data
    },
    enabled: !!id,
  })

  const [reviewNote, setReviewNote] = useState('')
  const [showGamingAlert, setShowGamingAlert] = useState(true)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-billing'] })
  }

  const changeStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/admin/billing/companies/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
      return json
    },
    onSuccess: (_d, action) => {
      showToast({
        type: 'success',
        title:
          action === 'READY'
            ? 'Marked ready for renewal'
            : 'Flagged for review',
      })
      setReviewNote('')
      refresh()
    },
    onError: (err: Error) =>
      showToast({ type: 'error', title: 'Failed', description: err.message }),
  })

  const markPaid = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/admin/billing/companies/${id}/mark-paid`,
        { method: 'POST' },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
      return json
    },
    onSuccess: () => {
      showToast({ type: 'success', title: 'Renewal marked paid' })
      refresh()
    },
    onError: (err: Error) =>
      showToast({ type: 'error', title: 'Failed', description: err.message }),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Company not found
      </div>
    )
  }

  const { company, billing, billingRecord, readiness, recentAudit } = data
  const transitions = ALLOWED_TRANSITIONS[billing.status] ?? []
  const d = daysUntil(billing.renewalDate)
  const difference = (billing.peakEnrolled30d ?? 0) - billing.currentEmployees
  const differenceLabel =
    billing.peakEnrolled30d === null
      ? '—'
      : difference > 0
        ? `-${difference}`
        : difference < 0
          ? `+${Math.abs(difference)}`
          : '0'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/billing')}
            className="-ml-2"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Billing
          </Button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company.city ? `${company.city} · ` : ''}
            {company.email}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill status={billing.status} />
          <ReadinessPill readiness={readiness} />
        </div>
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="font-medium">{company.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Contact Email</p>
            <p className="font-medium">{company.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Country</p>
            <p className="font-medium">{company.country || '—'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Peak Headcount Section (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Peak Headcount
            <span className="text-xs font-normal text-muted-foreground">
              (peak_enrolled_30d_pre_renewal — read only)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">
                Current Employees
              </p>
              <p className="text-2xl font-bold">{billing.currentEmployees}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">
                Peak Employees
              </p>
              <p className="text-2xl font-bold">
                {billing.peakEnrolled30d ?? '—'}
              </p>
            </div>
            <div
              className={`rounded-md border p-3 ${
                difference < 0
                  ? 'border-red-300 bg-red-50'
                  : 'border-green-300 bg-green-50'
              }`}
            >
              <p className="text-xs uppercase text-muted-foreground">
                Difference
              </p>
              <p
                className={`text-2xl font-bold ${
                  difference < 0 ? 'text-red-700' : 'text-green-700'
                }`}
              >
                {differenceLabel}
              </p>
            </div>
          </div>

          {billing.hasGamingAlert ? (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Potential Renewal Gaming</p>
                <p className="text-xs">
                  Current is <strong>{billing.dropPercent}%</strong> below the
                  recorded 30-day peak of {billing.peakEnrolled30d}.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
              <CheckCircle2 className="h-4 w-4" />
              <span>No alert. Current is within 20% of the recorded peak.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Renewal & Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" /> Renewal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">Renewal Date</p>
              <p className="text-lg font-medium">
                {formatDate(billing.renewalDate)}
              </p>
              {d !== null && (
                <p className="text-xs text-muted-foreground">
                  {d >= 0 ? `${d} day(s) away` : `${Math.abs(d)} day(s) ago`}
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Readiness</p>
              <ReadinessPill readiness={readiness} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" /> Billing Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Current Status</p>
              <StatusPill status={billing.status} />
            </div>
            {transitions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {transitions.map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={
                      t === 'ACTIVE'
                        ? 'default'
                        : t === 'INVOICE_OVERDUE'
                          ? 'warning'
                          : 'destructive'
                    }
                    disabled={changeStatus.isPending}
                    onClick={() => changeStatus.mutate(t)}
                  >
                    {t === 'ACTIVE' && <CheckCircle className="mr-1 h-3 w-3" />}
                    {t === 'INVOICE_OVERDUE' && (
                      <CircleAlert className="mr-1 h-3 w-3" />
                    )}
                    {t === 'ON_HOLD' && <X className="mr-1 h-3 w-3" />}
                    Set {t.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No transitions available from this state.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Renewal Review Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="h-4 w-4" /> Renewal Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Pre-renewal review is a workflow marker only — no billing amount
            changes. The final invoice is generated in QuickBooks.
          </p>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Optional review note…"
            rows={2}
            className="w-full rounded-md border p-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => submitReview.mutate('READY')}
              disabled={submitReview.isPending}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" /> Mark Ready For Renewal
            </Button>
            <Button
              size="sm"
              variant="warning"
              onClick={() => submitReview.mutate('FLAGGED')}
              disabled={submitReview.isPending}
            >
              <Flag className="mr-1 h-3 w-3" /> Flag For Review
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={markPaid.isPending}
              onClick={() => {
                if (
                  confirm(
                    'Confirm renewal paid? This will reset the peak 30-day headcount and advance the renewal date by one year. QuickBooks is the source of truth for the actual payment.',
                  )
                ) {
                  markPaid.mutate()
                }
              }}
            >
              <ShieldCheck className="mr-1 h-3 w-3" /> Confirm Renewal Paid
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit History (recent, for this company) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Recent Audit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No billing audit events yet for this company.
            </p>
          ) : (
            <div className="space-y-2">
              {recentAudit.map((r: any) => {
                const c = (r.changes ?? {}) as Record<string, unknown>
                return (
                  <div
                    key={r.id}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{r.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {((c.from ?? null) || (c.to ?? null)) && (
                        <span>
                          {String(c.from ?? '—')} → {String(c.to ?? '—')}
                        </span>
                      )}
                      {c.reason ? ` · reason: ${String(c.reason)}` : ''}
                      {c.decision ? ` · decision: ${String(c.decision)}` : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links to related admin areas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Related Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Link href={`/admin/companies/${company.id}`}>
            <Button size="sm" variant="outline">
              <Building2 className="mr-1 h-3 w-3" /> Company Detail
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
          <Link href={`/admin/companies?status=ACTIVE`}>
            <Button size="sm" variant="outline">
              <Users className="mr-1 h-3 w-3" /> All Companies
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
