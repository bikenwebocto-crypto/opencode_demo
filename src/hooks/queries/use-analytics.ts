'use client';

import { useQuery } from '@tanstack/react-query';

export const analyticsKeys = {
  all: ['analytics'] as const,
  summary: (filters?: Record<string, unknown>) => [...analyticsKeys.all, 'summary', filters] as const,
  redemptions: (filters?: Record<string, unknown>) => [...analyticsKeys.all, 'redemptions', filters] as const,
  topMerchants: (filters?: Record<string, unknown>) => [...analyticsKeys.all, 'top-merchants', filters] as const,
};

export function useAnalyticsSummary(filters?: {
  dateFrom?: string;
  dateTo?: string;
  merchantId?: string;
  companyId?: string;
}) {
  return useQuery({
    queryKey: analyticsKeys.summary(filters ?? {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.merchantId) params.set('merchantId', filters.merchantId);
      if (filters?.companyId) params.set('companyId', filters.companyId);

      const res = await fetch(`/api/analytics/summary?${params}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    refetchInterval: 60000,
  });
}

export function useRedemptionChart(filters?: {
  dateFrom?: string;
  dateTo?: string;
  merchantId?: string;
  companyId?: string;
  granularity?: 'day' | 'week' | 'month';
}) {
  return useQuery({
    queryKey: analyticsKeys.redemptions(filters ?? {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.merchantId) params.set('merchantId', filters.merchantId);
      if (filters?.companyId) params.set('companyId', filters.companyId);
      if (filters?.granularity) params.set('granularity', filters.granularity);

      const res = await fetch(`/api/analytics/redemptions/chart?${params}`);
      if (!res.ok) throw new Error('Failed to fetch chart data');
      return res.json();
    },
  });
}

export function useTopMerchants(filters?: {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: analyticsKeys.topMerchants(filters ?? {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.limit) params.set('limit', String(filters.limit));

      const res = await fetch(`/api/analytics/top-merchants?${params}`);
      if (!res.ok) throw new Error('Failed to fetch top merchants');
      return res.json();
    },
  });
}
