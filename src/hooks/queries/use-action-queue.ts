'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ActionQueueStatus, ActionQueueType } from '@/types';

export const actionQueueKeys = {
  all: ['action-queue'] as const,
  list: (filters?: Record<string, unknown>) => [...actionQueueKeys.all, 'list', filters] as const,
};

export function useActionQueue(filters?: {
  status?: ActionQueueStatus | 'ALL';
  type?: ActionQueueType | 'ALL';
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: actionQueueKeys.list(filters ?? {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters?.type && filters.type !== 'ALL') params.set('type', filters.type);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));

      const res = await fetch(`/api/admin/action-queue?${params}`);
      if (!res.ok) throw new Error('Failed to fetch action queue');
      return res.json();
    },
    refetchInterval: 15000,
  });
}

export function useClaimActionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/admin/action-queue/${itemId}/claim`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to claim item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actionQueueKeys.all });
    },
  });
}
