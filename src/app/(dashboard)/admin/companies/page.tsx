'use client'
import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { StatusBadge } from '@/components/shared/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useCompanies, useUpdateCompanyStatus, useDeleteCompany } from '@/hooks/queries/use-companies'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { showToast } from '@/hooks/use-toast'
import type { ColumnDef } from '@/types'

type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'CANCELLED'

export default function CompaniesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { page, setPage, pageSize } = useTablePagination({ defaultPageSize: 10 })

  const { data, isLoading } = useCompanies({
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    q: search || undefined,
    page,
    pageSize,
  })

  const updateStatus = useUpdateCompanyStatus()
  const deleteCompany = useDeleteCompany()

  const companies = data?.data ?? []
  const meta = data?.meta

  const tableCompanies = useMemo(() =>
    companies.map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      status: c.status,
      employeeCount: c._count?.employees ?? 0,
      activeRedemptions: c._count?.redemptions ?? 0,
      joinedAt: c.createdAt,
    })),
  [companies])

  const companyColumns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Company',
      render: (c: any) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{(c.name ?? '?').charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c: any) => <StatusBadge status={c.status} />,
    },
    { key: 'employeeCount', header: 'Employees', align: 'center' },
    { key: 'activeRedemptions', header: 'Active Redemptions', align: 'center' },
    {
      key: 'joinedAt',
      header: 'Joined',
      render: (c: any) => new Date(c.joinedAt).toLocaleDateString(),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Manage company accounts and subscriptions"
        actions={(
          <Link href="/admin/companies/add">
            <Button><Plus className="mr-1 h-4 w-4" />Add Company</Button>
          </Link>
        )}
      />
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search companies..."
        filters={[
          {
            key: 'status',
            label: 'All Statuses',
            options: [
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Paused', value: 'PAUSED' },
              { label: 'Suspended', value: 'SUSPENDED' },
              { label: 'Cancelled', value: 'CANCELLED' },
            ],
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as StatusFilter),
          },
        ]}
      />
      <DataTable
        columns={companyColumns}
        data={tableCompanies}
        keyExtractor={(c: any) => c.id}
        isLoading={isLoading}
        emptyMessage="No companies found"
        onRowClick={(c) => { setSelectedCompany(c.id); setConfirmOpen(true) }}
        pagination={{
          page,
          pageSize,
          total: meta?.total ?? tableCompanies.length,
          onPageChange: setPage,
        }}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Change Company Status"
        message="What action would you like to take on this company?"
        confirmLabel="Toggle Status"
        onConfirm={() => {
          if (selectedCompany) {
            updateStatus.mutate(
              { companyId: selectedCompany, status: 'PAUSED' },
              {
                onSuccess: (res: any) => showToast({ type: 'success', title: res.message ?? 'Company status updated' }),
                onError: (err: Error) => showToast({ type: 'error', title: 'Status update failed', description: err.message }),
              },
            )
          }
          setConfirmOpen(false); setSelectedCompany(null)
        }}
        onCancel={() => { setConfirmOpen(false); setSelectedCompany(null) }}
      />
    </div>
  )
}
