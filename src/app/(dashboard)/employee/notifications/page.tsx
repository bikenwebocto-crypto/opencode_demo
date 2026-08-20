'use client'

import { NotificationList } from '@/components/shared/notification-list'

export default function EmployeeNotificationsPage() {
  return (
    <NotificationList
      fetchUrl="/api/employee/notifications"
      markReadUrl={(id) => `/api/employee/notifications/${id}`}
      markAllUrl="/api/employee/notifications"
      queryKey="employee-notifications"
      emptyMessage="No notifications yet"
    />
  )
}
