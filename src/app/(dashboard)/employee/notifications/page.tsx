'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmployeeLayout } from '@/components/employee/EmployeeLayout'
import { showToast } from '@/hooks/use-toast'
import { Bell, CheckCheck } from 'lucide-react'

interface Notification {
  id: string
  title: string
  body: string | null
  priority: string
  referenceType: string | null
  referenceId: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

async function fetchNotifications(): Promise<{ data: Notification[]; unread: number }> {
  const res = await fetch('/api/employee/notifications')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return { data: json.data, unread: json.unread }
}

async function markRead(id: string) {
  const res = await fetch(`/api/employee/notifications/${id}`, { method: 'PATCH' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
  return json
}

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  NORMAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

export default function EmployeeNotificationsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['employee-notifications'],
    queryFn: fetchNotifications,
  })

  const markOne = useMutation({
    mutationFn: markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee-notifications'] }),
  })

  function handleMarkAll() {
    const unread = (data?.data ?? []).filter((n) => !n.isRead)
    Promise.all(unread.map((n) => markOne.mutateAsync(n.id)))
      .then(() => showToast({ type: 'success', title: `Marked ${unread.length} as read` }))
      .catch(() => showToast({ type: 'error', title: 'Failed' }))
  }

  return (
    <EmployeeLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Bell className="h-5 w-5" /> Notifications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.unread ?? 0} unread
            </p>
          </div>
          {(data?.unread ?? 0) > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAll}>
              <CheckCheck className="mr-1 h-4 w-4" /> Mark all as read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : !data?.data || data.data.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No notifications.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {data.data.map((n) => (
              <li
                key={n.id}
                className={`rounded-md border bg-card p-3 ${!n.isRead ? 'border-l-4 border-l-primary' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{n.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          PRIORITY_STYLES[n.priority] ?? PRIORITY_STYLES.NORMAL
                        }`}
                      >
                        {n.priority}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.isRead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markOne.mutate(n.id)}
                      disabled={markOne.isPending}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </EmployeeLayout>
  )
}
