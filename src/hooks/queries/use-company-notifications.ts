'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface NotificationItem {
  id: string
  title: string
  body: string | null
  channel: string
  priority: string
  referenceType: string | null
  referenceId: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export const companyNotificationKeys = {
  all: ['companyNotifications'] as const,
  list: (filters?: Record<string, any>) => ['companyNotifications', 'list', filters] as const,
}

export function useCompanyNotifications(filters?: { page?: number; unreadOnly?: boolean }) {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.unreadOnly) params.set('unreadOnly', 'true')

  return useQuery({
    queryKey: companyNotificationKeys.list(filters ?? {}),
    queryFn: async () => {
      const res = await fetch(`/api/company/notifications?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch notifications')
      const body = await res.json()
      if (!body.success) throw new Error(body.error?.message ?? 'Failed to fetch notifications')
      return { data: body.data as NotificationItem[], meta: body.meta }
    },
    refetchInterval: 30000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/company/notifications/${id}`, { method: 'PATCH' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error?.message ?? 'Failed to mark as read')
      return body
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyNotificationKeys.all }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/company/notifications', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error?.message ?? 'Failed to mark all as read')
      return body
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyNotificationKeys.all }),
  })
}
