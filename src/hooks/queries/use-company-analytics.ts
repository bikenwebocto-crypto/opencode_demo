'use client'

import { useQuery } from '@tanstack/react-query'
import type { CompanyAnalyticsDetailResponse } from '@/types'

export const companyAnalyticsKeys = {
  all: ['company-analytics'] as const,
  detail: (id: string) => [...companyAnalyticsKeys.all, 'detail', id] as const,
}

export function useCompanyAnalyticsDetail(companyId: string | null) {
  return useQuery({
    queryKey: companyAnalyticsKeys.detail(companyId ?? ''),
    queryFn: async () => {
      if (!companyId) throw new Error('companyId is required')
      const res = await fetch(`/api/admin/analytics/companies/${companyId}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to fetch company analytics')
      return json as CompanyAnalyticsDetailResponse
    },
    enabled: !!companyId,
    staleTime: 30 * 1000,
  })
}
