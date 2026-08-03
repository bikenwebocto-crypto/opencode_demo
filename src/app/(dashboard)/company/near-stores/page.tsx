'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StoreMap } from '@/components/shared/store-map'
import { useNearbyStores } from '@/hooks/queries/use-store-map'

export default function CompanyNearStoresPage() {
  const [filters, setFilters] = useState<{ lat?: number | null; lng?: number | null; category?: string | null; maxDistance?: number | null; openNow?: boolean }>({})
  const { data: branches = [], isLoading } = useNearbyStores('company', filters)

  return (
    <div className="space-y-6">
      <PageHeader title="Near Stores" description="Find stores near your company" />
      <StoreMap
        branches={branches}
        loading={isLoading}
        role="company"
        showSearch
        showFilters
        showDistance
        showCurrentLocation
      />
    </div>
  )
}
