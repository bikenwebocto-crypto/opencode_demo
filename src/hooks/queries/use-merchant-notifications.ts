'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const notificationKeys = {
  all: ['merchant-notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...notificationKeys.lists(), filters] as const,
}

export function useMerchantNotifications(filters?: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize))
  if (filters?.unreadOnly) params.set('unreadOnly', 'true')
  const qs = params.toString()

  return useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: async () => {
      const res = await fetch(`/api/merchant/notifications${qs ? `?${qs}` : ''}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to fetch notifications')
      return json
    },
    refetchInterval: 30000,
  })
}

export function useMarkMerchantNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/merchant/notifications/${id}`, { method: 'PATCH' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to mark notification as read')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useMarkAllMerchantNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/merchant/notifications', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to mark all as read')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
