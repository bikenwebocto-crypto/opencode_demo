'use client'
import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { FilterBar } from '@/components/shared/filter-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ActionQueueTable } from '@/features/action-queue/components/action-queue-table'
import { ActionQueueStats } from '@/features/action-queue/components/action-queue-stats'
import type { ActionQueueItemWithRef } from '@/types'

type StatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
type TypeFilter = 'ALL' | 'MERCHANT_APPROVAL' | 'OFFER_APPROVAL' | 'COMPANY_APPROVAL' | 'ISSUE_REVIEW'

const mockItems: ActionQueueItemWithRef[] = [
  { id: 'aq-001', type: 'MERCHANT_APPROVAL', title: "Joe's Coffee Shop", description: 'New merchant registration', referenceId: 'mer-101', referenceType: 'merchant', status: 'PENDING', priority: 2, createdAt: new Date('2026-05-27T10:30:00'), merchant: { id: 'mer-101', businessName: "Joe's Coffee Shop", email: 'joe@coffee.com' } },
  { id: 'aq-002', type: 'OFFER_APPROVAL', title: '20% Off Everything', description: 'New offer submission', referenceId: 'off-201', referenceType: 'offer', status: 'PENDING', priority: 1, createdAt: new Date('2026-05-27T09:15:00') },
  { id: 'aq-003', type: 'COMPANY_APPROVAL', title: 'TechCorp Inc.', description: 'Company account activation', referenceId: 'com-301', referenceType: 'company', status: 'IN_PROGRESS', priority: 3, createdAt: new Date('2026-05-26T14:00:00') },
  { id: 'aq-004', type: 'ISSUE_REVIEW', title: 'Redemption not honored', description: 'Employee reported issue', referenceId: 'iss-401', referenceType: 'issue', status: 'IN_PROGRESS', priority: 5, createdAt: new Date('2026-05-26T08:45:00') },
  { id: 'aq-005', type: 'MERCHANT_APPROVAL', title: 'GreenLeaf Bistro', description: 'New merchant registration', referenceId: 'mer-102', referenceType: 'merchant', status: 'COMPLETED', priority: 2, createdAt: new Date('2026-05-25T16:20:00') },
  { id: 'aq-006', type: 'OFFER_APPROVAL', title: 'Buy 1 Get 1 Free', description: 'New offer submission', referenceId: 'off-202', referenceType: 'offer', status: 'COMPLETED', priority: 1, createdAt: new Date('2026-05-25T11:00:00') },
  { id: 'aq-007', type: 'ISSUE_REVIEW', title: 'Wrong discount applied', description: 'Employee reported issue', referenceId: 'iss-402', referenceType: 'issue', status: 'FAILED', priority: 4, createdAt: new Date('2026-05-24T13:30:00') },
  { id: 'aq-008', type: 'COMPANY_APPROVAL', title: 'Global Solutions Ltd', description: 'Company account activation', referenceId: 'com-302', referenceType: 'company', status: 'PENDING', priority: 3, createdAt: new Date('2026-05-24T09:00:00') },
]

export default function ActionQueuePage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [selectedItem, setSelectedItem] = useState<ActionQueueItemWithRef | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const filtered = useMemo(() => {
    return mockItems.filter((item) => {
      if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false
      return true
    })
  }, [search, statusFilter, typeFilter])

  const handleRowClick = (item: ActionQueueItemWithRef) => {
    setSelectedItem(item)
    setConfirmOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Action Queue" description="Review and process pending actions from merchants, companies, and employees" />
      <ActionQueueStats pending={12} inProgress={3} completed={145} failed={2} />
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search actions..."
        filters={[
          { key: 'status', label: 'All Statuses', options: [{ label: 'Pending', value: 'PENDING' }, { label: 'In Progress', value: 'IN_PROGRESS' }, { label: 'Completed', value: 'COMPLETED' }, { label: 'Failed', value: 'FAILED' }], value: statusFilter, onChange: (v) => setStatusFilter(v as StatusFilter) },
          { key: 'type', label: 'All Types', options: [{ label: 'Merchant Approval', value: 'MERCHANT_APPROVAL' }, { label: 'Offer Approval', value: 'OFFER_APPROVAL' }, { label: 'Company Activation', value: 'COMPANY_APPROVAL' }, { label: 'Issue Review', value: 'ISSUE_REVIEW' }], value: typeFilter, onChange: (v) => setTypeFilter(v as TypeFilter) },
        ]}
      />
      <ActionQueueTable items={filtered} onRowClick={handleRowClick} />
      <ConfirmDialog
        open={confirmOpen}
        title="Claim Item"
        message={`Are you sure you want to claim "${selectedItem?.title}"? This action will assign it to you.`}
        confirmLabel="Claim"
        onConfirm={() => { setConfirmOpen(false); setSelectedItem(null) }}
        onCancel={() => { setConfirmOpen(false); setSelectedItem(null) }}
      />
    </div>
  )
}
