// ============================================================
// NOTIFICATION TYPE ENUM
// ============================================================

export type NotificationType =
  | 'SYSTEM'
  | 'ANNOUNCEMENT'
  | 'OFFER_APPROVED'
  | 'OFFER_REJECTED'
  | 'OFFER_REPLACED'
  | 'OFFER_REDEEMED'
  | 'OFFER_EXPIRING'
  | 'OFFER_EXPIRED'
  | 'MERCHANT_APPROVED'
  | 'MERCHANT_REJECTED'
  | 'COMPANY_APPROVED'
  | 'COMPANY_DISABLED'
  | 'EMPLOYEE_INVITED'
  | 'EMPLOYEE_REMOVED'
  | 'PROFILE_UPDATED'
  | 'PASSWORD_CHANGED'
  | 'CSV_COMPLETED'
  | 'CSV_FAILED'
  | 'BILLING_DUE'
  | 'BILLING_FAILED'
  | 'BILLING_SUCCESS'
  | 'COMPLAINT_CREATED'
  | 'COMPLAINT_UPDATED'
  | 'SECURITY_ALERT'
  | 'MAINTENANCE'
  | 'OFFER_REPLACEMENT_SUBMITTED'
  | 'OFFER_REPLACEMENT_APPROVED'
  | 'OFFER_REPLACEMENT_REJECTED'
  | 'OFFER_REPLACEMENT_CHANGES_REQUESTED'
  | 'OFFER_REPLACEMENT_ADMIN_PENDING'
  | 'LAUNCH_PACK'
  | 'BILLING_REMINDER'

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  SYSTEM: 'System',
  ANNOUNCEMENT: 'Announcement',
  OFFER_APPROVED: 'Offer Approved',
  OFFER_REJECTED: 'Offer Rejected',
  OFFER_REPLACED: 'Offer Replaced',
  OFFER_REDEEMED: 'Offer Redeemed',
  OFFER_EXPIRING: 'Offer Expiring',
  OFFER_EXPIRED: 'Offer Expired',
  MERCHANT_APPROVED: 'Merchant Approved',
  MERCHANT_REJECTED: 'Merchant Rejected',
  COMPANY_APPROVED: 'Company Approved',
  COMPANY_DISABLED: 'Company Disabled',
  EMPLOYEE_INVITED: 'Employee Invited',
  EMPLOYEE_REMOVED: 'Employee Removed',
  PROFILE_UPDATED: 'Profile Updated',
  PASSWORD_CHANGED: 'Password Changed',
  CSV_COMPLETED: 'CSV Import Completed',
  CSV_FAILED: 'CSV Import Failed',
  BILLING_DUE: 'Billing Due',
  BILLING_FAILED: 'Billing Failed',
  BILLING_SUCCESS: 'Payment Successful',
  COMPLAINT_CREATED: 'Complaint Created',
  COMPLAINT_UPDATED: 'Complaint Updated',
  SECURITY_ALERT: 'Security Alert',
  MAINTENANCE: 'Maintenance',
  OFFER_REPLACEMENT_SUBMITTED: 'Replacement Submitted',
  OFFER_REPLACEMENT_APPROVED: 'Replacement Approved',
  OFFER_REPLACEMENT_REJECTED: 'Replacement Rejected',
  OFFER_REPLACEMENT_CHANGES_REQUESTED: 'Changes Requested',
  OFFER_REPLACEMENT_ADMIN_PENDING: 'Replacement Awaiting Review',
  LAUNCH_PACK: 'Welcome',
  BILLING_REMINDER: 'Billing Reminder',
}
