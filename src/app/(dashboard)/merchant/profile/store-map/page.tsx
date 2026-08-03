'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { StoreMap } from '@/components/shared/store-map'
import { useMerchantStoreMap } from '@/hooks/queries/use-store-map'

export default function MerchantStoreMapPage() {
  const { data: branches = [], isLoading } = useMerchantStoreMap()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/merchant/profile">
          <Button variant="ghost" size="icon" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <PageHeader title="Store Map" description="View all your branches on the map" />
      </div>
      <StoreMap
        branches={branches}
        loading={isLoading}
        role="merchant"
        showSearch
        showFilters={false}
        showDistance={false}
        showCurrentLocation={false}
        showEditLink
        editBasePath="/merchant/branches"
      />
    </div>
  )
}
