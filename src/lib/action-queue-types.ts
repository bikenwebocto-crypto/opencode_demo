export type QueueTabKey = 'ALL' | 'MERCHANT_APPROVAL' | 'OFFER_APPROVALS' | 'COMPANY_ACTIVATION' | 'ISSUES' | 'ALERTS'

export type EntityKind = 'MERCHANT' | 'MERCHANT_OFFER' | 'COMPANY' | 'ISSUE' | 'RENEWAL_ALERT' | 'UNKNOWN'

export interface QueueTypeMapping {
  displayType: string
  tabCategory: QueueTabKey
  priority: string
  entityKind: EntityKind
  reviewComponent: string
}

export const QUEUE_TYPE_MAP: Record<string, QueueTypeMapping> = {
  NEW_MERCHANT_APPLICATION: {
    displayType: 'Merchant Application',
    tabCategory: 'MERCHANT_APPROVAL',
    priority: 'HIGH',
    entityKind: 'MERCHANT',
    reviewComponent: 'MerchantApplicationReview',
  },
  FIRST_PERK_APPROVAL: {
    displayType: 'First Perk Approval',
    tabCategory: 'OFFER_APPROVALS',
    priority: 'HIGH',
    entityKind: 'MERCHANT_OFFER',
    reviewComponent: 'OfferReview',
  },
  OFFER_REPLACEMENT_APPROVAL: {
    displayType: 'Offer Replacement',
    tabCategory: 'OFFER_APPROVALS',
    priority: 'MEDIUM',
    entityKind: 'MERCHANT_OFFER',
    reviewComponent: 'OfferReplacementReview',
  },
  PROFILE_CHANGE_APPROVAL: {
    displayType: 'Profile Change',
    tabCategory: 'OFFER_APPROVALS',
    priority: 'MEDIUM',
    entityKind: 'MERCHANT',
    reviewComponent: 'ProfileReview',
  },
  COMPANY_PENDING_ACTIVATION: {
    displayType: 'Company Activation',
    tabCategory: 'COMPANY_ACTIVATION',
    priority: 'STANDARD',
    entityKind: 'COMPANY',
    reviewComponent: 'CompanyActivationReview',
  },
  SETUP_LINK_EXPIRED: {
    displayType: 'Setup Link Expired',
    tabCategory: 'COMPANY_ACTIVATION',
    priority: 'STANDARD',
    entityKind: 'COMPANY',
    reviewComponent: 'SetupLinkReview',
  },
  OPEN_ISSUE: {
    displayType: 'Open Issue',
    tabCategory: 'ISSUES',
    priority: 'MEDIUM',
    entityKind: 'ISSUE',
    reviewComponent: 'IssueReview',
  },
  RENEWAL_GAMING_ALERT: {
    displayType: 'Renewal Gaming Alert',
    tabCategory: 'ALERTS',
    priority: 'MEDIUM',
    entityKind: 'RENEWAL_ALERT',
    reviewComponent: 'RenewalAlertReview',
  },
  MERCHANT_MISSING_PERK: {
    displayType: 'Missing Perk',
    tabCategory: 'ALERTS',
    priority: 'LOW',
    entityKind: 'MERCHANT',
    reviewComponent: 'MissingPerkReview',
  },
}

export const TAB_KEYS: { key: QueueTabKey; label: string; queueTypes: string[] }[] = [
  { key: 'ALL', label: 'All', queueTypes: [] },
  { key: 'MERCHANT_APPROVAL', label: 'Merchant Applications', queueTypes: ['NEW_MERCHANT_APPLICATION'] },
  { key: 'OFFER_APPROVALS', label: 'Offer Approvals', queueTypes: ['FIRST_PERK_APPROVAL', 'OFFER_REPLACEMENT_APPROVAL', 'PROFILE_CHANGE_APPROVAL'] },
  { key: 'COMPANY_ACTIVATION', label: 'Company Activation', queueTypes: ['COMPANY_PENDING_ACTIVATION', 'SETUP_LINK_EXPIRED'] },
  { key: 'ISSUES', label: 'Issues', queueTypes: ['OPEN_ISSUE'] },
  { key: 'ALERTS', label: 'Alerts', queueTypes: ['RENEWAL_GAMING_ALERT', 'MERCHANT_MISSING_PERK'] },
]

export const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500',
  STANDARD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-500',
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-500',
}

export const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500',
  SKIPPED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-500',
}

export function getQueueTypeMapping(queueType?: string | null): QueueTypeMapping | undefined {
  if (!queueType) return undefined
  return QUEUE_TYPE_MAP[queueType]
}

export function getEntityKindFromReferenceType(referenceType?: string | null): EntityKind {
  if (!referenceType) return 'UNKNOWN'
  const normalized = referenceType.toUpperCase().replace(/-/g, '_')
  if (normalized === 'MERCHANT_OFFER' || normalized === 'OFFER') return 'MERCHANT_OFFER'
  if (normalized === 'MERCHANT') return 'MERCHANT'
  if (normalized === 'COMPANY') return 'COMPANY'
  if (normalized === 'ISSUE' || normalized === 'ISSUE_REPORT') return 'ISSUE'
  if (normalized === 'RENEWAL_ALERT' || normalized === 'RENEWAL_GAMING_ALERT') return 'RENEWAL_ALERT'
  return 'UNKNOWN'
}

export function getQueueTypeFromEntityKind(entityKind: EntityKind): string | undefined {
  for (const [key, mapping] of Object.entries(QUEUE_TYPE_MAP)) {
    if (mapping.entityKind === entityKind) return key
  }
  return undefined
}

export function getPriorityLabel(priority: number): string {
  if (priority >= 4) return 'HIGH'
  if (priority >= 3) return 'MEDIUM'
  if (priority >= 2) return 'STANDARD'
  if (priority >= 1) return 'STANDARD'
  return 'LOW'
}
