/**
 * Pure helpers for renewal-gaming alerts and renewal readiness.
 *
 * Business rule:
 *   Generate an alert when:
 *     currentEmployees < 80% of peakEnrolled30d
 *   i.e. a drop of 20% or greater between peak and current.
 *
 *   current = 0 is treated as a 100% drop (maximum alert).
 *   peak = 0 means there is no recorded peak → no alert possible.
 */

import { GAMING_ALERT_THRESHOLD_PERCENT } from './audit-events'

export interface GamingAlertInput {
  currentEmployees: number
  peakEnrolled30d: number | null
}

export interface GamingAlert {
  active: boolean
  peakCount: number
  currentCount: number
  dropPercent: number // 0-100
  threshold: number
}

export function computeGamingAlert(
  input: GamingAlertInput,
): GamingAlert {
  const peak = Math.max(0, input.peakEnrolled30d ?? 0)
  const current = Math.max(0, input.currentEmployees)
  if (peak === 0) {
    return {
      active: false,
      peakCount: 0,
      currentCount: current,
      dropPercent: 0,
      threshold: GAMING_ALERT_THRESHOLD_PERCENT,
    }
  }
  const drop = peak - current
  const dropPercent = Math.round((drop / peak) * 100)
  return {
    active: dropPercent >= GAMING_ALERT_THRESHOLD_PERCENT,
    peakCount: peak,
    currentCount: current,
    dropPercent: Math.max(0, dropPercent),
    threshold: GAMING_ALERT_THRESHOLD_PERCENT,
  }
}

export interface ReadinessInput {
  renewalDate: Date | string | null
  currentEmployees: number
  peakEnrolled30d: number | null
  hasGamingAlert: boolean
  status: string
}

export type Readiness = 'READY' | 'NEEDS_REVIEW' | 'BLOCKED'

export function computeReadiness(input: ReadinessInput): Readiness {
  if (input.status !== 'ACTIVE' && input.status !== 'INVOICE_OVERDUE') {
    return 'BLOCKED'
  }
  if (input.hasGamingAlert) return 'NEEDS_REVIEW'
  if (!input.renewalDate) return 'NEEDS_REVIEW'
  return 'READY'
}
