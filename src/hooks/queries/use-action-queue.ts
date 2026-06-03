import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const actionQueueKeys = {
  all: ['action-queue'] as const,
  lists: () => [...actionQueueKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...actionQueueKeys.lists(), filters] as const,
};

export function useActionQueue(filters?: {
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  return useQuery({
    queryKey: actionQueueKeys.list(filters ?? {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters?.type && filters.type !== 'ALL') params.set('type', filters.type);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters?.q) params.set('q', filters.q);

      const res = await fetch(`/api/admin/action-queue?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to fetch action queue');
      return json;
    },
  });
}

export function useAllTabCounts(){
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/action-queue?status=ALL');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to fetch action queue counts');
      return json.data.reduce((acc: Record<string, number>, item: { status: string }) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {});
    },
    onSuccess: (data) => {
      queryClient.setQueryData(actionQueueKeys.list({ status: 'ALL' }), (oldData: any) => ({
        ...oldData,
        meta: {
          ...oldData?.meta,
          itemCounts: data,
        },
      }));
    },
  });
}

export function useUpdateActionQueueItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; status?: string; assignedTo?: string | null }) => {
      const res = await fetch('/api/admin/action-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to update item');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actionQueueKeys.lists() });
    },
  });
}

export function useDeleteActionQueueItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/action-queue?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to delete item');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actionQueueKeys.lists() });
    },
  });
}
