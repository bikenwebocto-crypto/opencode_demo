'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MerchantStatus } from '@/types';

// ============================================================
// QUERY KEY FACTORY (stable — serialized filters)
// ============================================================

function stableKey(obj: unknown): string {
  return JSON.stringify(obj ?? {});
}

export const merchantKeys = {
  all: ['merchants'] as const,
  lists: () => [...merchantKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...merchantKeys.lists(), stableKey(filters)] as const,
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
  q?: string;
}) {
  return useQuery({
    queryKey: merchantKeys.list(filters ?? {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters?.q) params.set('q', filters.q);

      const url = `/api/admin/merchants?${params}`;
      console.log('[useMerchants] fetching:', url);

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        console.error('[useMerchants] error:', res.status, body);
        throw new Error(`Failed to fetch merchants (${res.status})`);
      }

      const json = await res.json();
      console.log('[useMerchants] received:', json.meta ?? `${json.data?.length ?? 0} items`);
      return json;
    },
  });
}

export function useMerchantDetail(id: string) {
  return useQuery({
    queryKey: merchantKeys.detail(id),
    queryFn: async () => {
      const url = `/api/admin/merchants?merchantId=${id}`;
      console.log('[useMerchantDetail] fetching:', url);

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        console.error('[useMerchantDetail] error:', res.status, body);
        throw new Error(`Failed to fetch merchant (${res.status})`);
      }

      const json = await res.json();
      const merchant = json.data?.find?.((m: any) => m.id === id) ?? null;
      console.log('[useMerchantDetail] found:', merchant ? 'yes' : 'no');
      return { ...json, data: merchant };
    },
    enabled: !!id,
  });
}

export function usePendingMerchants(page = 1, pageSize = 20) {
  const queryKey = [...merchantKeys.pending(), page, pageSize];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = `/api/admin/merchants?status=PENDING&page=${page}&pageSize=${pageSize}`;
      console.log('[usePendingMerchants] fetching:', url);

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        console.error('[usePendingMerchants] error:', res.status, body);
        throw new Error(`Failed to fetch pending merchants (${res.status})`);
      }

      const json = await res.json();
      console.log('[usePendingMerchants] received:', json.meta ?? `${json.data?.length ?? 0} items`);
      return json;
    },
    refetchInterval: 30000,
  });
}

export function useMerchantSearch(query: string) {
  return useQuery({
    queryKey: merchantKeys.search(query),
    queryFn: async () => {
      const url = `/api/admin/merchants?q=${encodeURIComponent(query)}`;
      console.log('[useMerchantSearch] fetching:', url);

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        console.error('[useMerchantSearch] error:', res.status, body);
        throw new Error(`Search failed (${res.status})`);
      }

      const json = await res.json();
      console.log('[useMerchantSearch] received:', json.meta ?? `${json.data?.length ?? 0} items`);
      return json;
    },
    enabled: query.length >= 2,
  } as any);
}

// ============================================================
// MUTATION HOOKS
// ============================================================

export function useApproveMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { merchantId: string; status: MerchantStatus; rejectionReason?: string }) => {
      const body = JSON.stringify({
        merchantId: data.merchantId,
        status: data.status,
        rejectionReason: data.rejectionReason,
      });
      console.log('[useApproveMerchant] POST /api/admin/merchants:', body);

      const res = await fetch('/api/admin/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const json = await res.json();
      if (!res.ok) {
        console.error('[useApproveMerchant] error:', res.status, json);
        throw new Error(json.error?.message ?? `Approval failed (${res.status})`);
      }

      console.log('[useApproveMerchant] success:', json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: merchantKeys.lists() });
      queryClient.invalidateQueries({ queryKey: merchantKeys.pending() });
    },
  });
}

export function useCreateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/admin/merchants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to create merchant');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: merchantKeys.lists() });
    },
  });
}
