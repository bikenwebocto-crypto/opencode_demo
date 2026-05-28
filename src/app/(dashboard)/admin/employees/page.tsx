'use client'
import { useState, useMemo, useCallback } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { FilterBar } from '@/components/shared/filter-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmployeeTable } from '@/features/employees/components/employee-table'
import { CSVUploadDropzone } from '@/features/csv-uploads/components/csv-upload-dropzone'
import { Button } from '@/components/ui/button'
import { Plus, Upload, Trash2, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'INVITED'
type CompanyFilter = 'ALL' | 'com-001' | 'com-002' | 'com-003' | 'com-004' | 'com-005' | 'com-006'

interface MockEmployee {
  id: string
  name: string
  email: string
  companyId: string
  companyName: string
  department: string
  status: string
  totalRedemptions: number
  joinedAt: string
}

const mockEmployees: MockEmployee[] = [
  { id: 'emp-001', name: 'Alice Johnson', email: 'alice@techcorp.com', companyId: 'com-001', companyName: 'TechCorp Inc.', department: 'Engineering', status: 'ACTIVE', totalRedemptions: 23, joinedAt: '2025-07-01' },
  { id: 'emp-002', name: 'Bob Smith', email: 'bob@techcorp.com', companyId: 'com-001', companyName: 'TechCorp Inc.', department: 'Marketing', status: 'ACTIVE', totalRedemptions: 45, joinedAt: '2025-08-15' },
  { id: 'emp-003', name: 'Carol Davis', email: 'carol@globalsolutions.com', companyId: 'com-002', companyName: 'Global Solutions Ltd', department: 'Sales', status: 'INACTIVE', totalRedemptions: 12, joinedAt: '2025-09-10' },
  { id: 'emp-004', name: 'David Wilson', email: 'david@innovatex.io', companyId: 'com-003', companyName: 'InnovateX', department: 'Engineering', status: 'ACTIVE', totalRedemptions: 67, joinedAt: '2025-04-20' },
  { id: 'emp-005', name: 'Eve Martinez', email: 'eve@innovatex.io', companyId: 'com-003', companyName: 'InnovateX', department: 'Design', status: 'INVITED', totalRedemptions: 0, joinedAt: '2026-05-27' },
  { id: 'emp-006', name: 'Frank Lee', email: 'frank@techcorp.com', companyId: 'com-001', companyName: 'TechCorp Inc.', department: 'Finance', status: 'ACTIVE', totalRedemptions: 8, joinedAt: '2025-11-01' },
  { id: 'emp-007', name: 'Grace Kim', email: 'grace@northstar.com', companyId: 'com-006', companyName: 'NorthStar Enterprises', department: 'HR', status: 'ACTIVE', totalRedemptions: 31, joinedAt: '2025-10-05' },
  { id: 'emp-008', name: 'Henry Brown', email: 'henry@globalsolutions.com', companyId: 'com-002', companyName: 'Global Solutions Ltd', department: 'Operations', status: 'INACTIVE', totalRedemptions: 5, joinedAt: '2026-01-12' },
]

const companyOptions = [
  { label: 'TechCorp Inc.', value: 'com-001' },
  { label: 'Global Solutions Ltd', value: 'com-002' },
  { label: 'InnovateX', value: 'com-003' },
  { label: 'BlueOcean Corp', value: 'com-004' },
  { label: 'Pinnacle Partners', value: 'com-005' },
  { label: 'NorthStar Enterprises', value: 'com-006' },
]

export default function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('ALL')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'delete' | 'deactivate'>('delete')
  const [isProcessing, setIsProcessing] = useState(false)
  const [employees, setEmployees] = useState<MockEmployee[]>(mockEmployees)

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.email.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false
      if (companyFilter !== 'ALL' && e.companyId !== companyFilter) return false
      return true
    })
  }, [search, statusFilter, companyFilter, employees])

  const handleSelectChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleBulkActivate = useCallback(() => {
    setEmployees((prev) => prev.map((e) => selectedIds.has(e.id) ? { ...e, status: 'ACTIVE' } : e))
    clearSelection()
  }, [selectedIds, clearSelection])

  const handleBulkDeactivate = useCallback(() => {
    setEmployees((prev) => prev.map((e) => selectedIds.has(e.id) ? { ...e, status: 'INACTIVE' } : e))
    clearSelection()
  }, [selectedIds, clearSelection])

  const handleBulkDelete = useCallback(() => {
    setEmployees((prev) => prev.filter((e) => !selectedIds.has(e.id)))
    clearSelection()
  }, [selectedIds, clearSelection])

  const handleCSVUpload = useCallback((_file: File) => {
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      setShowUpload(false)
    }, 1500)
  }, [])

  const openConfirm = useCallback((action: 'delete' | 'deactivate') => {
    setConfirmAction(action)
    setConfirmOpen(true)
  }, [])

  const selectedCount = selectedIds.size

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="View and manage employees across companies"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowUpload(!showUpload)}>
              <Upload className="mr-1 h-4 w-4" />Bulk Upload
            </Button>
            <Link href="/admin/employees/add">
              <Button><Plus className="mr-1 h-4 w-4" />Add Employee</Button>
            </Link>
          </div>
        }
      />

      {showUpload && (
        <CSVUploadDropzone
          onUpload={handleCSVUpload}
          isUploading={isProcessing}
          acceptedFormats=".csv"
        />
      )}

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search employees..."
        filters={[
          { key: 'company', label: 'All Companies', options: companyOptions, value: companyFilter, onChange: (v) => setCompanyFilter(v as CompanyFilter) },
          { key: 'status', label: 'All Statuses', options: [{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }, { label: 'Invited', value: 'INVITED' }], value: statusFilter, onChange: (v) => setStatusFilter(v as StatusFilter) },
        ]}
      />

      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="success" onClick={handleBulkActivate}>
              <CheckCircle className="mr-1 h-4 w-4" />Activate
            </Button>
            <Button size="sm" variant="warning" onClick={() => openConfirm('deactivate')}>
              <XCircle className="mr-1 h-4 w-4" />Deactivate
            </Button>
            <Button size="sm" variant="destructive" onClick={() => openConfirm('delete')}>
              <Trash2 className="mr-1 h-4 w-4" />Delete
            </Button>
          </div>
        </div>
      )}

      <EmployeeTable
        employees={filtered}
        selectedIds={selectedIds}
        onSelectChange={handleSelectChange}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={confirmAction === 'delete' ? 'Delete Employees' : 'Deactivate Employees'}
        message={
          confirmAction === 'delete'
            ? `Are you sure you want to delete ${selectedCount} employee(s)? This action cannot be undone.`
            : `Are you sure you want to deactivate ${selectedCount} employee(s)?`
        }
        confirmLabel={confirmAction === 'delete' ? 'Delete' : 'Deactivate'}
        onConfirm={() => {
          if (confirmAction === 'delete') handleBulkDelete()
          else handleBulkDeactivate()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
