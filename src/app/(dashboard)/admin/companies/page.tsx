'use client'
import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { FilterBar } from '@/components/shared/filter-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { CompanyTable } from '@/features/companies/components/company-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

const mockCompanies = [
  { id: 'com-001', name: 'TechCorp Inc.', email: 'admin@techcorp.com', status: 'ACTIVE', employeeCount: 245, activeRedemptions: 1205, joinedAt: '2025-06-01' },
  { id: 'com-002', name: 'Global Solutions Ltd', email: 'info@globalsolutions.com', status: 'ACTIVE', employeeCount: 89, activeRedemptions: 432, joinedAt: '2025-08-15' },
  { id: 'com-003', name: 'InnovateX', email: 'hello@innovatex.io', status: 'ACTIVE', employeeCount: 512, activeRedemptions: 2890, joinedAt: '2025-03-20' },
  { id: 'com-004', name: 'BlueOcean Corp', email: 'contact@blueocean.com', status: 'INACTIVE', employeeCount: 34, activeRedemptions: 78, joinedAt: '2025-11-10' },
  { id: 'com-005', name: 'Pinnacle Partners', email: 'info@pinnaclepartners.com', status: 'SUSPENDED', employeeCount: 0, activeRedemptions: 0, joinedAt: '2026-01-05' },
  { id: 'com-006', name: 'NorthStar Enterprises', email: 'admin@northstar.com', status: 'ACTIVE', employeeCount: 178, activeRedemptions: 654, joinedAt: '2025-09-22' },
]

export default function CompaniesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const filtered = useMemo(() => {
    return mockCompanies.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
      return true
    })
  }, [search, statusFilter])

  return (
    <div className="space-y-6">
      <PageHeader title="Companies" description="Manage company accounts and subscriptions" actions={<Button><Plus className="mr-1 h-4 w-4" />Add Company</Button>} />
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search companies..."
        filters={[
          { key: 'status', label: 'All Statuses', options: [{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }, { label: 'Suspended', value: 'SUSPENDED' }], value: statusFilter, onChange: (v) => setStatusFilter(v as StatusFilter) },
        ]}
      />
      <CompanyTable companies={filtered} onRowClick={(c) => { setSelectedCompany(c.id); setConfirmOpen(true) }} />
      <ConfirmDialog
        open={confirmOpen}
        title="Change Status"
        message="Are you sure you want to change the status of this company?"
        confirmLabel="Confirm"
        onConfirm={() => { setConfirmOpen(false); setSelectedCompany(null) }}
        onCancel={() => { setConfirmOpen(false); setSelectedCompany(null) }}
      />
    </div>
  )
}
