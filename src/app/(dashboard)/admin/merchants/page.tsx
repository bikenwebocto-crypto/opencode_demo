'use client'
import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { FilterBar } from '@/components/shared/filter-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { MerchantTable } from '@/features/merchants/components/merchant-table'
import { PendingMerchantCard } from '@/features/merchants/components/pending-merchant-card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL'
type CategoryFilter = 'ALL' | 'Food' | 'Retail' | 'Tech' | 'Health' | 'Other'

const mockMerchants = [
  { id: 'mer-001', name: "Joe's Coffee Shop", email: 'joe@coffee.com', status: 'ACTIVE', category: 'Food', totalOffers: 5, totalRedemptions: 342, rating: 4.5, joinedAt: '2025-11-15' },
  { id: 'mer-002', name: 'TechGadgets Pro', email: 'info@techgadgets.com', status: 'ACTIVE', category: 'Tech', totalOffers: 12, totalRedemptions: 1205, rating: 4.2, joinedAt: '2025-09-01' },
  { id: 'mer-003', name: 'GreenLeaf Bistro', email: 'hello@greenleaf.com', status: 'ACTIVE', category: 'Food', totalOffers: 3, totalRedemptions: 89, rating: 4.8, joinedAt: '2026-01-20' },
  { id: 'mer-004', name: 'Fashion Hub', email: 'support@fashionhub.com', status: 'INACTIVE', category: 'Retail', totalOffers: 8, totalRedemptions: 456, rating: 3.9, joinedAt: '2025-06-10' },
  { id: 'mer-005', name: 'HealthFirst Pharmacy', email: 'care@healthfirst.com', status: 'SUSPENDED', category: 'Health', totalOffers: 2, totalRedemptions: 67, rating: 3.2, joinedAt: '2025-08-22' },
  { id: 'mer-006', name: 'BookWorm Store', email: 'info@bookworm.com', status: 'ACTIVE', category: 'Retail', totalOffers: 4, totalRedemptions: 210, rating: 4.6, joinedAt: '2026-03-05' },
  { id: 'mer-007', name: 'Pizza Palace', email: 'orders@pizzapalace.com', status: 'ACTIVE', category: 'Food', totalOffers: 6, totalRedemptions: 788, rating: 4.4, joinedAt: '2025-12-01' },
  { id: 'mer-008', name: 'FitZone Gym', email: 'info@fitzone.com', status: 'PENDING_APPROVAL', category: 'Health', totalOffers: 1, totalRedemptions: 0, rating: 0, joinedAt: '2026-05-27' },
]

const mockPending = [
  { id: 'pend-001', businessName: 'FitZone Gym', ownerName: 'Mike Johnson', email: 'mike@fitzone.com', category: 'Health', submittedAt: '2026-05-27' },
  { id: 'pend-002', businessName: 'Sunset Bakery', ownerName: 'Sarah Lee', email: 'sarah@sunsetbakery.com', category: 'Food', submittedAt: '2026-05-26' },
  { id: 'pend-003', businessName: 'CodeCamp Academy', ownerName: 'David Kim', email: 'david@codecamp.io', category: 'Tech', submittedAt: '2026-05-25' },
]

export default function MerchantsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL')
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'reject'>('suspend')
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return mockMerchants.filter((m) => {
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false
      if (categoryFilter !== 'ALL' && m.category !== categoryFilter) return false
      return true
    })
  }, [search, statusFilter, categoryFilter])

  const handleSuspend = (id: string) => {
    setSelectedMerchant(id)
    setConfirmAction('suspend')
    setConfirmOpen(true)
  }

  const handleReject = (id: string) => {
    setSelectedMerchant(id)
    setConfirmAction('reject')
    setConfirmOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Merchants" description="Manage merchant accounts, approvals, and statuses" actions={<Link href="/admin/merchants/add"><Button><Plus className="mr-1 h-4 w-4" />Add Merchant</Button></Link>} />
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search merchants..."
        filters={[
          { key: 'status', label: 'All Statuses', options: [{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }, { label: 'Suspended', value: 'SUSPENDED' }, { label: 'Pending Approval', value: 'PENDING_APPROVAL' }], value: statusFilter, onChange: (v) => setStatusFilter(v as StatusFilter) },
          { key: 'category', label: 'All Categories', options: [{ label: 'Food', value: 'Food' }, { label: 'Retail', value: 'Retail' }, { label: 'Tech', value: 'Tech' }, { label: 'Health', value: 'Health' }, { label: 'Other', value: 'Other' }], value: categoryFilter, onChange: (v) => setCategoryFilter(v as CategoryFilter) },
        ]}
      />
      <div className="flex gap-4 border-b">
        <button onClick={() => setActiveTab('all')} className={`pb-2 text-sm font-medium ${activeTab === 'all' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>All Merchants</button>
        <button onClick={() => setActiveTab('pending')} className={`pb-2 text-sm font-medium ${activeTab === 'pending' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>Pending Approval</button>
      </div>
      {activeTab === 'all' ? (
        <MerchantTable merchants={filtered} onRowClick={(m) => handleSuspend(m.id)} />
      ) : (
        <div className="space-y-3">
          {mockPending.map((m) => (
            <PendingMerchantCard key={m.id} merchant={m} onApprove={() => {}} onReject={() => handleReject(m.id)} />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmAction === 'suspend' ? 'Suspend Merchant' : 'Reject Merchant'}
        message={confirmAction === 'suspend' ? 'Are you sure you want to suspend this merchant?' : 'Are you sure you want to reject this merchant application?'}
        confirmLabel={confirmAction === 'suspend' ? 'Suspend' : 'Reject'}
        onConfirm={() => { setConfirmOpen(false); setSelectedMerchant(null) }}
        onCancel={() => { setConfirmOpen(false); setSelectedMerchant(null) }}
      />
    </div>
  )
}
