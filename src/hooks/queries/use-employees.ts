'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...employeeKeys.lists(), filters] as const,
};

export function useEmployees(filters?: {
  status?: string;
  companyId?: string;
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  return useQuery({
    queryKey: employeeKeys.list(filters ?? {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters?.companyId && filters.companyId !== 'ALL') params.set('companyId', filters.companyId);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters?.q) params.set('q', filters.q);

      const res = await fetch(`/api/admin/employees?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to fetch employees');
      return json;
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to create employee');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}

export function useBulkUpdateEmployees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { employeeIds: string[]; status: string; reason?: string }) => {
      const res = await fetch('/api/admin/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to update employees');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}

export function useBulkDeleteEmployees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch(`/api/admin/employees?ids=${ids.join(',')}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to delete employees');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}
