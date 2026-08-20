'use client'

import { useQuery } from '@tanstack/react-query'
import type { MerchantAnalyticsDetailResponse } from '@/types'

export const merchantAnalyticsKeys = {
  all: ['merchant-analytics'] as const,
  detail: (id: string) => [...merchantAnalyticsKeys.all, 'detail', id] as const,
}

export function useMerchantAnalyticsDetail(merchantId: string | null) {
  return useQuery({
    queryKey: merchantAnalyticsKeys.detail(merchantId ?? ''),
    queryFn: async () => {
      if (!merchantId) throw new Error('merchantId is required')
      const res = await fetch(`/api/admin/analytics/merchants/${merchantId}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to fetch merchant analytics')
      return json as MerchantAnalyticsDetailResponse
    },
    enabled: !!merchantId,
    staleTime: 30 * 1000,
  })
}
