'use client'
import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { FilterBar } from '@/components/shared/filter-bar'
import { ContentList } from '@/features/content/components/content-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

type TypeFilter = 'ALL' | 'banner' | 'offer' | 'page'
type StatusFilter = 'ALL' | 'LIVE' | 'DRAFT' | 'ARCHIVED'

const mockContent = [
  { id: 'cnt-001', title: 'Summer Sale Banner', type: 'banner' as const, status: 'LIVE' as const, updatedAt: '2026-05-27' },
  { id: 'cnt-002', title: '20% Off Everything', type: 'offer' as const, status: 'LIVE' as const, updatedAt: '2026-05-26' },
  { id: 'cnt-003', title: 'Company Benefits Page', type: 'page' as const, status: 'DRAFT' as const, updatedAt: '2026-05-25' },
  { id: 'cnt-004', title: 'New Year Promotion', type: 'offer' as const, status: 'ARCHIVED' as const, updatedAt: '2026-04-30' },
  { id: 'cnt-005', title: 'Wellness Program Banner', type: 'banner' as const, status: 'DRAFT' as const, updatedAt: '2026-05-24' },
  { id: 'cnt-006', title: 'Merchant Onboarding Guide', type: 'page' as const, status: 'LIVE' as const, updatedAt: '2026-05-20' },
]

export default function ContentPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const filtered = useMemo(() => {
    return mockContent.filter((item) => {
      if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
      return true
    })
  }, [search, typeFilter, statusFilter])

  return (
    <div className="space-y-6">
      <PageHeader title="Content Management" description="Manage banners, offers, and pages" actions={<Button><Plus className="mr-1 h-4 w-4" />Create New</Button>} />
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search content..."
        filters={[
          { key: 'type', label: 'All Types', options: [{ label: 'Banner', value: 'banner' }, { label: 'Offer', value: 'offer' }, { label: 'Page', value: 'page' }], value: typeFilter, onChange: (v) => setTypeFilter(v as TypeFilter) },
          { key: 'status', label: 'All Statuses', options: [{ label: 'Live', value: 'LIVE' }, { label: 'Draft', value: 'DRAFT' }, { label: 'Archived', value: 'ARCHIVED' }], value: statusFilter, onChange: (v) => setStatusFilter(v as StatusFilter) },
        ]}
      />
      <ContentList items={filtered} />
    </div>
  )
}
