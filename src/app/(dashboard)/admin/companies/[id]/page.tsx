'use client'
import { useCallback, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { showToast } from '@/hooks/use-toast'
import { useCompanyDetail, useUpdateCompanyDetail, useDeleteCompany } from '@/hooks/queries/use-companies'
import { useEmployees } from '@/hooks/queries/use-employees'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { DataTable } from '@/components/shared/data-table'
import { FilterBar } from '@/components/shared/filter-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ArrowLeft, CheckCircle, Pause, Ban, XCircle, Send, Mail, Download } from 'lucide-react'
import Link from 'next/link'
import type { ColumnDef } from '@/types'
import { CSVUploadDropzone } from '@/features/csv-uploads/components/csv-upload-dropzone'

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data, isLoading } = useCompanyDetail(id)
  const updateDetail = useUpdateCompanyDetail()
  const deleteCompany = useDeleteCompany()

  const company = data?.data

  const [adminNote, setAdminNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<string>('')
  const [showCSVUpload, setShowCSVUpload] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState('ALL')
  const { page: empPage, setPage: setEmpPage, pageSize: empPageSize } = useTablePagination({ defaultPageSize: 10 })

  const { data: empData } = useEmployees({
    companyId: id,
    status: employeeStatusFilter !== 'ALL' ? employeeStatusFilter : undefined,
    q: employeeSearch || undefined,
    page: empPage,
    pageSize: empPageSize,
  })

  const employees = empData?.data ?? []
  const empMeta = empData?.meta

  const employeeColumns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (e: any) => <span className="font-medium">{e.firstName} {e.lastName}</span>,
    },
    { key: 'email', header: 'Email' },
    { key: 'department', header: 'Department' },
    {
      key: 'status',
      header: 'Status',
      render: (e: any) => <StatusBadge status={e.status} />,
    },
  ]

  const handleStatusChange = useCallback((status: string) => {
    setConfirmAction(status)
    setConfirmOpen(true)
  }, [])

  const confirmStatusChange = useCallback(() => {
    if (!confirmAction) return
    updateDetail.mutate(
      { id, status: confirmAction },
      {
        onSuccess: (res: any) => {
          showToast({ type: 'success', title: res.message ?? `Company ${confirmAction.toLowerCase()}` })
          setConfirmOpen(false)
          setConfirmAction('')
        },
        onError: (err: Error) => {
          showToast({ type: 'error', title: 'Update failed', description: err.message })
          setConfirmOpen(false)
          setConfirmAction('')
        },
      },
    )
  }, [id, confirmAction, updateDetail])

  const handleSaveNote = useCallback(() => {
    if (!adminNote.trim() && !company?.adminNote) return
    updateDetail.mutate(
      { id, adminNote },
      {
        onSuccess: () => {
          showToast({ type: 'success', title: 'Admin note saved' })
          setNoteSaved(true)
          setTimeout(() => setNoteSaved(false), 3000)
        },
        onError: (err: Error) => showToast({ type: 'error', title: 'Failed to save note', description: err.message }),
      },
    )
  }, [id, adminNote, updateDetail, company])

  const handleBillingStatusChange = useCallback((billingStatus: string) => {
    updateDetail.mutate(
      { id, billingStatus },
      {
        onSuccess: () => showToast({ type: 'success', title: `Billing status updated to ${billingStatus}` }),
        onError: (err: Error) => showToast({ type: 'error', title: 'Billing update failed', description: err.message }),
      },
    )
  }, [id, updateDetail])

  const handleCSVUpload = useCallback((_file: File) => {
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      setShowCSVUpload(false)
    }, 1500)
  }, [])

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
  }

  if (!company) {
    return <div className="text-center text-muted-foreground py-12">Company not found</div>
  }

  const billing = company.billing
  const history = company.statusHistory ?? []
  const enrolledCount = company._count?.employees ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.name}
        description={`${company.email} · Created ${new Date(company.createdAt).toLocaleDateString()}`}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/admin/companies')}>
              <ArrowLeft className="mr-1 h-4 w-4" />Back
            </Button>
          </div>
        )}
      />

      {/* Company Header */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold">{company.name}</h2>
              <p className="text-sm text-muted-foreground">{company.email}</p>
            </div>
            <StatusBadge status={company.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{enrolledCount}</strong> employees</span>
            {company.approvedAt && <span>· Activated {new Date(company.approvedAt).toLocaleDateString()}</span>}
            {billing?.renewalDate && <span>· Renews {new Date(billing.renewalDate).toLocaleDateString()}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Admin Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {company.status !== 'ACTIVE' && (
            <Button size="sm" variant="success" onClick={() => handleStatusChange('ACTIVE')}>
              <CheckCircle className="mr-1 h-4 w-4" />Mark Active
            </Button>
          )}
          {company.status !== 'PAUSED' && (
            <Button size="sm" variant="warning" onClick={() => handleStatusChange('PAUSED')}>
              <Pause className="mr-1 h-4 w-4" />Pause
            </Button>
          )}
          {company.status !== 'SUSPENDED' && (
            <Button size="sm" variant="destructive" onClick={() => handleStatusChange('SUSPENDED')}>
              <Ban className="mr-1 h-4 w-4" />Suspend
            </Button>
          )}
          {company.status !== 'CANCELLED' && (
            <Button size="sm" variant="destructive" onClick={() => handleStatusChange('CANCELLED')}>
              <XCircle className="mr-1 h-4 w-4" />Cancel
            </Button>
          )}
          <Button size="sm" variant="outline"><Send className="mr-1 h-4 w-4" />Resend Setup Link</Button>
          <Button size="sm" variant="outline"><Mail className="mr-1 h-4 w-4" />Transfer Admin Email</Button>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader><CardTitle className="text-base">Billing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={billing?.billingStatus ?? 'ACTIVE'}
                onChange={(e) => handleBillingStatusChange(e.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="INVOICE_OVERDUE">Invoice Overdue</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
            <span className="text-sm text-muted-foreground">
              Plan: <strong>{billing?.plan ?? '—'}</strong>
            </span>
            <span className="text-sm text-muted-foreground">
              Cycle: <strong>{billing?.billingCycle ?? '—'}</strong>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Price / Employee</p>
              <p className="font-medium">${Number(billing?.pricePerEmployee ?? 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Invoice</p>
              <p className="font-medium">{billing?.currentPeriodStart ? new Date(billing.currentPeriodStart).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Next Renewal</p>
              <p className="font-medium">{billing?.renewalDate ? new Date(billing.renewalDate).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Trial</p>
              <p className="font-medium">{billing?.isTrial ? `Until ${billing.trialEndsAt ? new Date(billing.trialEndsAt).toLocaleDateString() : '—'}` : 'No'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Employees ({enrolledCount})</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowCSVUpload(!showCSVUpload)}>
              <Download className="mr-1 h-4 w-4" />Bulk Upload
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCSVUpload && (
            <CSVUploadDropzone onUpload={handleCSVUpload} isUploading={isProcessing} acceptedFormats=".csv" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search employees..."
              className="rounded border px-3 py-1.5 text-sm"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
            />
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={employeeStatusFilter}
              onChange={(e) => setEmployeeStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INVITED">Invited</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <DataTable
            columns={employeeColumns}
            data={employees}
            keyExtractor={(e: any) => e.id}
            isLoading={false}
            emptyMessage="No employees found"
            pagination={{
              page: empPage,
              pageSize: empPageSize,
              total: empMeta?.total ?? employees.length,
              onPageChange: setEmpPage,
            }}
          />
        </CardContent>
      </Card>

      {/* Admin Note */}
      <Card>
        <CardHeader><CardTitle className="text-base">Admin Note</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full rounded border p-3 text-sm"
            rows={3}
            maxLength={500}
            placeholder="Add an internal note about this company (max 500 characters). Not visible to the company admin."
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{adminNote.length}/500</span>
            <Button size="sm" onClick={handleSaveNote} disabled={updateDetail.isPending}>
              {noteSaved ? 'Saved' : updateDetail.isPending ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader><CardTitle className="text-base">Activity Log</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status changes recorded.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between rounded border px-4 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={h.fromStatus ?? '—'} />
                    <span>→</span>
                    <StatusBadge status={h.toStatus} />
                    {h.reason && <span className="text-muted-foreground">— {h.reason}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {h.changedByType} · {new Date(h.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title={`${confirmAction} Company`}
        message={`Are you sure you want to set this company to "${confirmAction}"?`}
        confirmLabel={confirmAction}
        loading={updateDetail.isPending}
        onConfirm={confirmStatusChange}
        onCancel={() => { setConfirmOpen(false); setConfirmAction('') }}
      />
    </div>
  )
}
