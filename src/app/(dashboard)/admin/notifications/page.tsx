'use client'

import { NotificationList } from '@/components/shared/notification-list'

export default function AdminNotificationsPage() {
  return (
    <NotificationList
      fetchUrl="/api/admin/notifications"
      markReadUrl={(id) => `/api/admin/notifications/${id}`}
      markAllUrl="/api/admin/notifications"
      queryKey="admin-notifications"
      emptyMessage="No notifications yet"
    />
  )
}
