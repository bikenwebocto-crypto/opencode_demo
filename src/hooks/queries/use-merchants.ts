'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MerchantStatus } from '@/types';

// ============================================================
// QUERY KEY FACTORY
// ============================================================

export const merchantKeys = {
  all: ['merchants'] as const,
  lists: () => [...merchantKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...merchantKeys.lists(), filters] as const,
  details: () => [...merchantKeys.all, 'detail'] as const,
  detail: (id: string) => [...merchantKeys.details(), id] as const,
  pending: () => [...merchantKeys.all, 'pending'] as const,
  search: (query: string) => [...merchantKeys.all, 'search', query] as const,
};

// ============================================================
// QUERY HOOKS
// ============================================================

export function useMerchants(filters?: {
  status?: MerchantStatus;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: merchantKeys.list(filters ?? {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));

      const res = await fetch(`/api/admin/merchants?${params}`);
      if (!res.ok) throw new Error('Failed to fetch merchants');
      return res.json();
    },
  });
}

export function useMerchantDetail(id: string) {
  return useQuery({
    queryKey: merchantKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/merchants/${id}`);
      if (!res.ok) throw new Error('Failed to fetch merchant');
      return res.json();
    },
    enabled: !!id,
  });
}

export function usePendingMerchants(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: [...merchantKeys.pending(), { page, pageSize }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/merchants?status=PENDING&page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error('Failed to fetch pending merchants');
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30s as backup for realtime
  });
}

export function useMerchantSearch(query: string) {
  return useQuery({
    queryKey: merchantKeys.search(query),
    queryFn: async () => {
      const res = await fetch(`/api/admin/merchants/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: query.length >= 2,
    debounceMs: 300,
  } as any);
}

// ============================================================
// MUTATION HOOKS
// ============================================================

export function useApproveMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { merchantId: string; status: MerchantStatus; rejectionReason?: string }) => {
      const formData = new FormData();
      formData.set('merchantId', data.merchantId);
      formData.set('status', data.status);
      if (data.rejectionReason) formData.set('rejectionReason', data.rejectionReason);

      const res = await fetch('/api/admin/merchants/approve', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Approval failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: merchantKeys.lists() });
      queryClient.invalidateQueries({ queryKey: merchantKeys.pending() });
    },
  });
}
