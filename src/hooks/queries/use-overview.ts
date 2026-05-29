'use client';

import { useQuery } from '@tanstack/react-query';

export const overviewKeys = {
  all: ['overview'] as const,
  admin: () => [...overviewKeys.all, 'admin'] as const,
};

export function useAdminOverview() {
  return useQuery({
    queryKey: overviewKeys.admin(),
    queryFn: async () => {
      const res = await fetch('/api/admin/overview');
      if (!res.ok) throw new Error('Failed to fetch overview');
      return res.json();
    },
    refetchInterval: 30000,
  });
}
