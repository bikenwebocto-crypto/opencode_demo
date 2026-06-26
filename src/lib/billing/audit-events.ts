/**
 * Centralized audit-event names for the Billing module.
 *
 * Per spec, the platform only manages:
 *   - Company billing status
 *   - Renewal readiness
 *   - Peak employee count tracking
 *   - Renewal gaming alerts
 *   - Company access control
 *
 * QuickBooks remains the source of truth for invoicing / payments /
 * accounting — no audit events for those exist here.
 */

export const BILLING_AUDIT_ACTIONS = {
  STATUS_CHANGED: 'BILLING_STATUS_CHANGED',
  RENEWAL_READY: 'RENEWAL_REVIEW_READY',
  RENEWAL_FLAGGED: 'RENEWAL_REVIEW_FLAGGED',
  GAMING_ALERT_DETECTED: 'RENEWAL_GAMING_ALERT_DETECTED',
  PEAK_RESET: 'PEAK_HEADCOUNT_RESET',
  PAID_CONFIRMED: 'RENEWAL_PAID_CONFIRMED',
} as const

export type BillingAuditAction =
  (typeof BILLING_AUDIT_ACTIONS)[keyof typeof BILLING_AUDIT_ACTIONS]

export const BILLING_AUDIT_ENTITIES = {
  COMPANY: 'company',
  COMPANY_BILLING: 'company_billing',
} as const

/** Allowed transitions. UI/API must enforce this. */
export const BILLING_STATUS_TRANSITIONS: Record<
  string,
  readonly string[]
> = {
  ACTIVE: ['INVOICE_OVERDUE', 'ON_HOLD'],
  INVOICE_OVERDUE: ['ACTIVE', 'ON_HOLD'],
  ON_HOLD: ['ACTIVE'],
}

export function isValidBillingTransition(
  from: string,
  to: string,
): boolean {
  return (BILLING_STATUS_TRANSITIONS[from] ?? []).includes(to)
}

export const GAMING_ALERT_THRESHOLD_PERCENT = 20
