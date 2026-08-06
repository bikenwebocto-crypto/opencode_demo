'use client'

import { NotificationList } from '@/components/shared/notification-list'

export default function CompanyNotificationsPage() {
  return (
    <NotificationList
      fetchUrl="/api/company/notifications"
      markReadUrl={(id) => `/api/company/notifications/${id}`}
      markAllUrl="/api/company/notifications"
      queryKey="company-notifications"
      emptyMessage="No notifications yet"
    />
  )
}
