'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { showToast } from '@/hooks/use-toast'
import {
  Building2,
  CalendarClock,
  AlertTriangle,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  History,
  LayoutDashboard,
  Users,
  CheckCircle2,
  Search,
  CircleAlert,
  X,
} from 'lucide-react'

type Tab = 'dashboard' | 'companies' | 'renewal-queue' | 'gaming-alerts' | 'audit'

interface BillingSummary {
  activeCompanies: number
  invoiceOverdueCompanies: number
  onHoldCompanies: number
  renewingWithin30Days: number
  companiesWithGamingAlert: number
  totalPeakHeadcountPendingRenewal: number
  generatedAt: string
}

interface CompanyBillingRow {
  companyId: string
  companyName: string
  status: string
  currentEmployees: number
  peakEnrolled30d: number | null
  renewalDate: string | null
  hasGamingAlert: boolean
  dropPercent: number
  alertThreshold: number
}

interface AuditRow {
  id: string
  action: string
  reason: string | null
  createdAt: string
  changes: any
  admin: { id: string; firstName: string; lastName: string; email: string } | null
  company: { id: string; name: string } | null
}

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

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border'
  const label = status.replace(/_/g, ' ')
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style}`}
    >
      {label}
    </span>
  )
}

function AlertBadge({ row }: { row: CompanyBillingRow }) {
  if (!row.hasGamingAlert) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
        <CheckCircle2 className="h-3 w-3" /> No Alert
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
      <AlertTriangle className="h-3 w-3" /> Gaming
    </span>
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null
  const d = new Date(value).getTime()
  if (Number.isNaN(d)) return null
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24))
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  icon: any
  tone: 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate'
}) {
  const toneMap: Record<string, string> = {
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }
  return (
    <Card className={toneMap[tone]}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
          <Icon className="h-5 w-5 opacity-80" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminBillingPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [q, setQ] = useState('')

  const queryClient = useQueryClient()

  // Dashboard summary
  const summary = useQuery({
    queryKey: ['admin-billing', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/billing/summary')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load summary')
      return json.data as BillingSummary
    },
  })

  // Companies list (used for Companies + Renewal Queue + Gaming Alerts)
  const companiesParams = useMemo(() => {
    const p = new URLSearchParams()
    p.set('pageSize', '100')
    if (statusFilter !== 'ALL') p.set('status', statusFilter)
    if (q) p.set('q', q)
    return p.toString()
  }, [statusFilter, q])

  const companies = useQuery({
    queryKey: ['admin-billing', 'companies', companiesParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/billing/companies?${companiesParams}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
      return (json.data ?? []) as CompanyBillingRow[]
    },
  })

  // Audit history
  const audit = useQuery({
    queryKey: ['admin-billing', 'audit'],
    queryFn: async () => {
      const res = await fetch('/api/admin/billing/audit?pageSize=50')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
      return (json.data ?? []) as AuditRow[]
    },
  })

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-billing'] })
  }

  // Derived lists
  const allRows = companies.data ?? []
  const renewalQueue = allRows.filter((r) => {
    const d = daysUntil(r.renewalDate)
    return d !== null && d <= 10
  })
  const gamingAlerts = allRows.filter((r) => r.hasGamingAlert)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational billing &amp; renewal management. QuickBooks remains the
          source of truth for invoicing &amp; payments.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-2 border-b">
        {(
          [
            { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { key: 'companies', label: 'Companies', icon: Building2 },
            { key: 'renewal-queue', label: 'Renewal Queue', icon: CalendarClock },
            { key: 'gaming-alerts', label: 'Gaming Alerts', icon: AlertTriangle },
            { key: 'audit', label: 'Audit History', icon: History },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {t.key === 'renewal-queue' && renewalQueue.length > 0 && (
              <span className="ml-1 rounded-full bg-blue-100 px-1.5 text-xs font-semibold text-blue-700">
                {renewalQueue.length}
              </span>
            )}
            {t.key === 'gaming-alerts' && gamingAlerts.length > 0 && (
              <span className="ml-1 rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
                {gamingAlerts.length}
              </span>
            )}
          </button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={refreshAll}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && (
        <DashboardTab
          summary={summary.data}
          isLoading={summary.isLoading}
          renewalQueueCount={renewalQueue.length}
          gamingAlertCount={gamingAlerts.length}
          onJump={(t) => setTab(t)}
        />
      )}

      {tab === 'companies' && (
        <CompaniesTab
          rows={allRows}
          isLoading={companies.isLoading}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          q={q}
          setQ={setQ}
          onChanged={refreshAll}
        />
      )}

      {tab === 'renewal-queue' && (
        <RenewalQueueTab
          rows={renewalQueue}
          isLoading={companies.isLoading}
        />
      )}

      {tab === 'gaming-alerts' && (
        <GamingAlertsTab
          rows={gamingAlerts}
          isLoading={companies.isLoading}
        />
      )}

      {tab === 'audit' && (
        <AuditTab rows={audit.data ?? []} isLoading={audit.isLoading} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components / views                                              */
/* ------------------------------------------------------------------ */

function DashboardTab({
  summary,
  isLoading,
  renewalQueueCount,
  gamingAlertCount,
  onJump,
}: {
  summary: BillingSummary | undefined
  isLoading: boolean
  renewalQueueCount: number
  gamingAlertCount: number
  onJump: (t: Tab) => void
}) {
  if (isLoading || !summary) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active Companies"
          value={summary.activeCompanies}
          icon={ShieldCheck}
          tone="green"
        />
        <StatCard
          label="Invoice Overdue"
          value={summary.invoiceOverdueCompanies}
          icon={CircleAlert}
          tone="amber"
        />
        <StatCard
          label="On Hold"
          value={summary.onHoldCompanies}
          icon={X}
          tone="red"
        />
        <StatCard
          label="Renewing in 30 Days"
          value={summary.renewingWithin30Days}
          icon={CalendarClock}
          tone="blue"
        />
        <StatCard
          label="Gaming Alerts"
          value={summary.companiesWithGamingAlert}
          icon={AlertTriangle}
          tone="red"
        />
        <StatCard
          label="Total Peak Headcount (Renewal Window)"
          value={summary.totalPeakHeadcountPendingRenewal}
          icon={TrendingUp}
          tone="violet"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => onJump('renewal-queue')}
          className="rounded-md border bg-card p-4 text-left transition-colors hover:bg-muted/50"
        >
          <p className="text-sm font-medium">
            Renewal Queue
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
              {renewalQueueCount}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Companies with a renewal date in the next 30 days.
          </p>
        </button>
        <button
          onClick={() => onJump('gaming-alerts')}
          className="rounded-md border bg-card p-4 text-left transition-colors hover:bg-muted/50"
        >
          <p className="text-sm font-medium">
            Gaming Alerts
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
              {gamingAlertCount}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Companies whose current employees are at least 20% below their
            recorded 30-day peak.
          </p>
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        QuickBooks remains the source of truth for invoicing and payments.
        This module tracks operational billing workflow only.
      </p>
    </div>
  )
}

function CompaniesTab({
  rows,
  isLoading,
  statusFilter,
  setStatusFilter,
  q,
  setQ,
  onChanged,
}: {
  rows: CompanyBillingRow[]
  isLoading: boolean
  statusFilter: string
  setStatusFilter: (v: string) => void
  q: string
  setQ: (v: string) => void
  onChanged: () => void
}) {
  const queryClient = useQueryClient()

  const changeStatus = useMutation({
    mutationFn: async ({
      companyId,
      status,
    }: {
      companyId: string
      status: string
    }) => {
      const res = await fetch(
        `/api/admin/billing/companies/${companyId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
      return json
    },
    onSuccess: () => {
      showToast({ type: 'success', title: 'Billing status updated' })
      onChanged()
    },
    onError: (err: Error) =>
      showToast({ type: 'error', title: 'Failed', description: err.message }),
  })

  const markPaid = useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch(
        `/api/admin/billing/companies/${companyId}/mark-paid`,
        { method: 'POST' },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
      return json
    },
    onSuccess: () => {
      showToast({ type: 'success', title: 'Renewal marked paid' })
      onChanged()
    },
    onError: (err: Error) =>
      showToast({ type: 'error', title: 'Failed', description: err.message }),
  })

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <CardTitle className="text-base">Company Billing</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search company…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-md border bg-background pl-7 pr-3 py-1.5 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INVOICE_OVERDUE">Invoice Overdue</option>
            <option value="ON_HOLD">On Hold</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No companies match the current filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3 text-center">Current Employees</th>
                  <th className="py-2 pr-3 text-center">Peak 30d</th>
                  <th className="py-2 pr-3">Renewal Date</th>
                  <th className="py-2 pr-3">Billing Status</th>
                  <th className="py-2 pr-3">Gaming Alert</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.companyId} className="border-b">
                    <td className="py-2 pr-3 font-medium">
                      <Link
                        href={`/admin/billing/${r.companyId}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {r.companyName}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-center">
                      {r.currentEmployees}
                    </td>
                    <td className="py-2 pr-3 text-center">
                      {r.peakEnrolled30d ?? '—'}
                    </td>
                    <td className="py-2 pr-3">{formatDate(r.renewalDate)}</td>
                    <td className="py-2 pr-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="py-2 pr-3">
                      <AlertBadge row={r} />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        <Link href={`/admin/billing/${r.companyId}`}>
                          <Button size="sm" variant="outline">
                            Open
                          </Button>
                        </Link>
                        {r.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={changeStatus.isPending}
                            onClick={() =>
                              changeStatus.mutate({
                                companyId: r.companyId,
                                status: 'INVOICE_OVERDUE',
                              })
                            }
                          >
                            Mark Overdue
                          </Button>
                        )}
                        {r.status === 'INVOICE_OVERDUE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={changeStatus.isPending}
                            onClick={() =>
                              changeStatus.mutate({
                                companyId: r.companyId,
                                status: 'ACTIVE',
                              })
                            }
                          >
                            Mark Paid
                          </Button>
                        )}
                        {r.status === 'ON_HOLD' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={changeStatus.isPending}
                            onClick={() =>
                              changeStatus.mutate({
                                companyId: r.companyId,
                                status: 'ACTIVE',
                              })
                            }
                          >
                            Restore
                          </Button>
                        )}
                        {r.status === 'INVOICE_OVERDUE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={markPaid.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  'Mark this renewal as paid? The peak 30-day headcount will be reset and the renewal date will advance by one year.',
                                )
                              ) {
                                markPaid.mutate(r.companyId)
                              }
                            }}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Confirm Renewal Paid
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RenewalQueueTab({
  rows,
  isLoading,
}: {
  rows: CompanyBillingRow[]
  isLoading: boolean
}) {
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No renewals scheduled within the next 30 days.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" /> Companies renewing in next 30 days
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Company</th>
                <th className="py-2 pr-3">Renewal Date</th>
                <th className="py-2 pr-3 text-center">Current Employees</th>
                <th className="py-2 pr-3 text-center">Peak 30d</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Gaming</th>
                <th className="py-2 pr-3 text-right">Review</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => {
                  const da = a.renewalDate ? new Date(a.renewalDate).getTime() : Infinity
                  const db = b.renewalDate ? new Date(b.renewalDate).getTime() : Infinity
                  return da - db
                })
                .map((r) => {
                  const d = daysUntil(r.renewalDate)
                  return (
                    <tr key={r.companyId} className="border-b">
                      <td className="py-2 pr-3 font-medium">
                        <Link
                          href={`/admin/billing/${r.companyId}`}
                          className="text-primary hover:underline"
                        >
                          {r.companyName}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">
                        {formatDate(r.renewalDate)}
                        {d !== null && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({d}d)
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        {r.currentEmployees}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        {r.peakEnrolled30d ?? '—'}
                      </td>
                      <td className="py-2 pr-3">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="py-2 pr-3">
                        <AlertBadge row={r} />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Link href={`/admin/billing/${r.companyId}`}>
                          <Button size="sm" variant="outline">
                            Review
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function GamingAlertsTab({
  rows,
  isLoading,
}: {
  rows: CompanyBillingRow[]
  isLoading: boolean
}) {
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          No active renewal-gaming alerts.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-red-600" /> Active Gaming Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.companyId}
              className="flex flex-col items-start justify-between gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-medium">
                  <Link
                    href={`/admin/billing/${r.companyId}`}
                    className="text-primary hover:underline"
                  >
                    {r.companyName}
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  Peak: <strong>{r.peakEnrolled30d ?? 0}</strong> · Current:{' '}
                  <strong>{r.currentEmployees}</strong> · Drop:{' '}
                  <strong className="text-red-700">
                    {r.dropPercent}%
                  </strong>{' '}
                  (threshold: {r.alertThreshold}%)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={r.status} />
                <Link href={`/admin/billing/${r.companyId}`}>
                  <Button size="sm" variant="outline">
                    Investigate
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function AuditTab({
  rows,
  isLoading,
}: {
  rows: AuditRow[]
  isLoading: boolean
}) {
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No billing audit events recorded yet.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Billing Audit History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Admin</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Company</th>
                <th className="py-2 pr-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = (r.changes ?? {}) as Record<string, unknown>
                const details = [
                  c.from ? `${c.from} → ${c.to}` : null,
                  c.reason ? `reason: ${c.reason}` : null,
                  c.decision ? `decision: ${c.decision}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">
                      {r.admin
                        ? `${r.admin.firstName ?? ''} ${r.admin.lastName ?? ''}`.trim() ||
                          r.admin.email
                        : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs">{r.action}</span>
                    </td>
                    <td className="py-2 pr-3">
                      {r.company ? (
                        <Link
                          href={`/admin/billing/${r.company.id}`}
                          className="text-primary hover:underline"
                        >
                          {r.company.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">{details || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
