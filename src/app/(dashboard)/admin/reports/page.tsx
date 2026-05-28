'use client'
import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { FilterBar } from '@/components/shared/filter-bar'
import { ReportList } from '@/features/reports/components/report-list'

type CategoryFilter = 'ALL' | 'Redemptions' | 'Merchants' | 'Companies' | 'Financial'

const mockReports = [
  { id: 'rpt-001', name: 'Monthly Redemption Summary', description: 'Overview of all redemptions for the current month with trends and breakdowns', category: 'Redemptions', lastGenerated: '2026-05-27T10:00:00', status: 'ready' },
  { id: 'rpt-002', name: 'Merchant Performance', description: 'Top-performing merchants ranked by redemption volume and employee satisfaction', category: 'Merchants', lastGenerated: '2026-05-25T08:30:00', status: 'ready' },
  { id: 'rpt-003', name: 'Company Usage Report', description: 'Company-level adoption metrics, active employees, and redemption patterns', category: 'Companies', lastGenerated: '2026-05-20T14:00:00', status: 'ready' },
  { id: 'rpt-004', name: 'Financial Overview', description: 'Revenue, discounts applied, savings generated, and projected costs', category: 'Financial', lastGenerated: null, status: 'pending' },
  { id: 'rpt-005', name: 'Quarterly Insights', description: 'Comprehensive quarterly analysis across all metrics and categories', category: 'Redemptions', lastGenerated: '2026-04-01T09:00:00', status: 'ready' },
]

export default function ReportsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL')

  const filtered = useMemo(() => {
    return mockReports.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false
      return true
    })
  }, [search, categoryFilter])

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate and download analytics reports" />
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search reports..."
        filters={[
          { key: 'category', label: 'All Categories', options: [{ label: 'Redemptions', value: 'Redemptions' }, { label: 'Merchants', value: 'Merchants' }, { label: 'Companies', value: 'Companies' }, { label: 'Financial', value: 'Financial' }], value: categoryFilter, onChange: (v) => setCategoryFilter(v as CategoryFilter) },
        ]}
      />
      <ReportList reports={filtered} onGenerate={(id) => console.log('Generate report:', id)} />
    </div>
  )
}
