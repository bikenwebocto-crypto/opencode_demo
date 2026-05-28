'use client'
import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { FilterBar } from '@/components/shared/filter-bar'
import { AuditLogTable } from '@/features/audit-logs/components/audit-log-table'

type EntityFilter = 'ALL' | 'merchant' | 'company' | 'employee' | 'offer' | 'system'

const mockLogs = [
  { id: 'log-001', action: 'MERCHANT_APPROVED', entityType: 'merchant', entityId: 'mer-101', adminName: 'Admin User', ipAddress: '192.168.1.1', createdAt: '2026-05-28T10:30:00' },
  { id: 'log-002', action: 'COMPANY_ACTIVATED', entityType: 'company', entityId: 'com-301', adminName: 'Admin User', ipAddress: '192.168.1.1', createdAt: '2026-05-28T09:15:00' },
  { id: 'log-003', action: 'OFFER_CREATED', entityType: 'offer', entityId: 'off-201', adminName: 'Sarah Manager', ipAddress: '10.0.0.5', createdAt: '2026-05-27T16:45:00' },
  { id: 'log-004', action: 'EMPLOYEE_INVITED', entityType: 'employee', entityId: 'emp-101', adminName: 'Sarah Manager', ipAddress: '10.0.0.5', createdAt: '2026-05-27T14:20:00' },
  { id: 'log-005', action: 'MERCHANT_SUSPENDED', entityType: 'merchant', entityId: 'mer-005', adminName: 'Admin User', ipAddress: '192.168.1.1', createdAt: '2026-05-26T11:00:00' },
  { id: 'log-006', action: 'SYSTEM_CONFIG_UPDATED', entityType: 'system', entityId: 'cfg-001', adminName: 'Super Admin', ipAddress: '192.168.1.100', createdAt: '2026-05-26T08:30:00' },
  { id: 'log-007', action: 'BULK_IMPORT_COMPLETED', entityType: 'employee', entityId: 'imp-001', adminName: 'Admin User', ipAddress: '192.168.1.1', createdAt: '2026-05-25T17:00:00' },
  { id: 'log-008', action: 'OFFER_ARCHIVED', entityType: 'offer', entityId: 'off-104', adminName: 'Sarah Manager', ipAddress: '10.0.0.5', createdAt: '2026-05-25T13:15:00' },
  { id: 'log-009', action: 'COMPANY_SUSPENDED', entityType: 'company', entityId: 'com-005', adminName: 'Admin User', ipAddress: '192.168.1.1', createdAt: '2026-05-24T10:00:00' },
  { id: 'log-010', action: 'PASSWORD_RESET', entityType: 'system', entityId: 'usr-001', adminName: 'Super Admin', ipAddress: '192.168.1.100', createdAt: '2026-05-24T09:00:00' },
]

export default function AuditLogsPage() {
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    return mockLogs.filter((log) => {
      if (search && !log.action.toLowerCase().includes(search.toLowerCase())) return false
      if (entityFilter !== 'ALL' && log.entityType !== entityFilter) return false
      if (dateFrom && new Date(log.createdAt) < new Date(dateFrom)) return false
      if (dateTo && new Date(log.createdAt) > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
  }, [search, entityFilter, dateFrom, dateTo])

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Track all administrative actions" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search actions..."
          filters={[
            { key: 'entity', label: 'All Entities', options: [{ label: 'Merchant', value: 'merchant' }, { label: 'Company', value: 'company' }, { label: 'Employee', value: 'employee' }, { label: 'Offer', value: 'offer' }, { label: 'System', value: 'system' }], value: entityFilter, onChange: (v) => setEntityFilter(v as EntityFilter) },
          ]}
        />
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          <span className="text-sm text-muted-foreground">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </div>
      <AuditLogTable logs={filtered} />
    </div>
  )
}
