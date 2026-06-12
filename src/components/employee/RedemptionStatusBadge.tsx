'use client'

import { STATUS_LABELS, type RedemptionStatus } from '@/lib/redemption-status'

interface Props {
  status: RedemptionStatus | string
  className?: string
}

const STATUS_STYLES: Record<RedemptionStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  EXPIRED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

export function RedemptionStatusBadge({ status, className }: Props) {
  const key = (status in STATUS_STYLES ? status : 'PENDING') as RedemptionStatus
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[key]} ${className ?? ''}`}
    >
      {STATUS_LABELS[key]}
    </span>
  )
}
