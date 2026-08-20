/**
 * Shared status / category / type color palette for analytics charts.
 * Mirrors the values previously inlined in the route handlers.
 */

export const OFFER_STATUS_COLORS: Record<string, string> = {
  LIVE: '#10b981', // emerald-500
  PENDING: '#f59e0b', // amber-500 (review)
  DRAFT: '#94a3b8', // slate-400
  REJECTED: '#ef4444', // red-500
  EXPIRED: '#f97316', // orange-500
  ARCHIVED: '#64748b', // slate-500
  PENDING_APPROVAL: '#f59e0b',
  AWAITING_APPROVAL: '#f59e0b',
  VALIDATION_IN_PROGRESS: '#3b82f6',
  VALIDATION_FAILED: '#ef4444',
  CHANGES_REQUESTED: '#a855f7',
  REPLACED: '#64748b',
}

export const OFFER_TYPE_LABELS: Record<string, string> = {
  FLAT: 'Flat Discount',
  PERCENTAGE: 'Percentage Off',
  BUY_X_GET_Y: 'Buy X Get Y',
  flat_rate: 'Flat Rate',
  fixed_amount: 'Fixed Amount',
  percentage: 'Percentage Off',
  buy_x_get_y: 'Buy X Get Y',
}

/** Buckets for the offer status breakdown. */
export const OFFER_STATUS_BUCKETS = {
  live: 'LIVE' as const,
  draft: 'DRAFT' as const,
  pending: ['AWAITING_APPROVAL', 'PENDING_APPROVAL', 'VALIDATION_IN_PROGRESS', 'CHANGES_REQUESTED'] as const,
  rejected: ['REJECTED', 'VALIDATION_FAILED'] as const,
  expired: 'EXPIRED' as const,
}

export const FUNNEL_STAGES = [
  { key: 'views', label: 'Views' },
  { key: 'saves', label: 'Saves' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'redemptions', label: 'Redemptions' },
] as const

export const DAILY_TREND_DAYS = 30

/** UUID v4 format check used by route handlers. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
