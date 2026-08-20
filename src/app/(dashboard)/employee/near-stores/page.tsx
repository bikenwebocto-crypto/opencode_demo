'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StoreMap } from '@/components/shared/store-map'
import { useNearbyStores, type StoreBranch } from '@/hooks/queries/use-store-map'

export default function EmployeeNearStoresPage() {
  const [filters, setFilters] = useState<{ lat?: number | null; lng?: number | null; category?: string | null; maxDistance?: number | null; openNow?: boolean }>({})
  const { data: branches = [], isLoading } = useNearbyStores('employee', filters)

  return (
    <div className="space-y-6">
      <PageHeader title="Near Stores" description="Find nearby stores offering deals" />
      <StoreMap
        branches={branches}
        loading={isLoading}
        role="employee"
        showSearch
        showFilters
        showDistance
        showCurrentLocation
      />
    </div>
  )
}
