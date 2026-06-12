// ============================================================
// CORE TYPE DEFINITIONS
// ============================================================

import type { Prisma } from '@prisma/client';

// ============================================================
// ENUMS
// ============================================================

export type AccountRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE' | 'MERCHANT';
export type ProfileType = 'ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE' | 'MERCHANT';
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
export type AdminRole = 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'FINANCE_ADMIN' | 'CONTENT_ADMIN';
export type MerchantStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'ARCHIVED' | 'REJECTED';
export type MerchantOnboardingStep = 'APPLICATION' | 'DOCUMENTS' | 'AGREEMENT' | 'COMPLETE';
export type CompanyStatus = 'PENDING' | 'APPROVED_PENDING_PAYMENT' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'CANCELLED';
export type EmployeeStatus = 'INVITED' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'INELIGIBLE';
export type BillingStatus = 'ACTIVE' | 'INVOICE_OVERDUE' | 'ON_HOLD';
export type OfferStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'LIVE' | 'VALIDATION_IN_PROGRESS' | 'AWAITING_APPROVAL' | 'VALIDATION_FAILED' | 'REJECTED' | 'EXPIRED' | 'REPLACED' | 'ARCHIVED';
export type ReplacementStatus = 'PENDING' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED';
export type IssueStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
export type ActionQueueStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
export type ActionQueueType = 'MERCHANT_APPROVAL' | 'OFFER_APPROVAL' | 'OFFER_REPLACEMENT' | 'PROFILE_EDIT_REQUEST' | 'COMPANY_APPROVAL' | 'ISSUE_REVIEW' | 'CSV_IMPORT';
export type CSVUploadStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH' | 'SMS';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type UserType = 'admin' | 'merchant' | 'company_admin' | 'employee';
export type RealtimeEventType =
  | 'REDEMPTION_CREATED' | 'REDEMPTION_UPDATED'
  | 'MERCHANT_STATUS_CHANGED' | 'COMPANY_STATUS_CHANGED'
  | 'OFFER_STATUS_CHANGED' | 'ACTION_QUEUE_UPDATED'
  | 'ANALYTICS_UPDATED' | 'ISSUE_REPORTED'
  | 'NOTIFICATION_CREATED' | 'EMPLOYEE_STATUS_CHANGED';

export type BranchType = 'IN_STORE' | 'ONLINE';
export type BranchStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';
export type BranchDisplayType = 'IN_STORE' | 'ONLINE_DELIVERY' | 'ONLINE_DIGITAL';

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: APIMeta;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface APIMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeFilter {
  from?: Date | string;
  to?: Date | string;
}

// ============================================================
// AUTH TYPES
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  userType: UserType;
  role?: AdminRole;
  merchantId?: string;
  companyId?: string;
  name: string;
  isActive: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  userType: UserType;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  user_type: UserType;
  account_role?: AccountRole;
  admin_role?: AdminRole;
  merchant_id?: string;
  company_id?: string;
  iat: number;
  exp: number;
}

export interface Session {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// ============================================================
// DASHBOARD TYPES
// ============================================================

export interface DashboardFilter {
  dateRange: DateRangeFilter;
  merchantId?: string;
  companyId?: string;
  offerId?: string;
  status?: string;
  search?: string;
}

export interface AnalyticsSummary {
  totalRedemptions: number;
  totalDiscount: number;
  totalSavings: number;
  activeMerchants: number;
  activeCompanies: number;
  activeOffers: number;
  pendingActions: number;
  periodComparison?: {
    redemptionsChange: number;
    discountChange: number;
    savingsChange: number;
  };
}

export interface RedemptionChartData {
  date: string;
  count: number;
  discount: number;
  savings: number;
}

export interface TopMerchantData {
  id: string;
  businessName: string;
  logoUrl: string | null;
  totalRedemptions: number;
  totalSavings: number;
  averageRating: number;
}

// ============================================================
// REALTIME EVENT TYPES
// ============================================================

export interface RealtimePayload<T = unknown> {
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  id: string;
  type?: string;
  status?: string;
  payload: T;
  timestamp: string;
}

export interface RedemptionRealtimeEvent {
  id: string;
  merchantId: string;
  offerId: string;
  employeeId: string;
  companyId: string;
  discountAmount: number;
  redeemedAt: string;
}

export interface ActionQueueRealtimeEvent {
  id: string;
  type: ActionQueueType;
  status: ActionQueueStatus;
  title: string;
}

export interface MerchantStatusRealtimeEvent {
  merchantId: string;
  oldStatus: MerchantStatus;
  newStatus: MerchantStatus;
}

export interface OfferStatusRealtimeEvent {
  offerId: string;
  merchantId: string;
  oldStatus: OfferStatus;
  newStatus: OfferStatus;
}

export interface RealtimeChannelConfig {
  channel: string;
  event: string;
  filter?: string;
}

// ============================================================
// BUSINESS LOGIC TYPES
// ============================================================

export interface OfferWithMerchant {
  id: string;
  title: string;
  description: string;
  shortDescription: string | null;
  imageUrls: string[];
  offerType: string;
  discountValue: number;
  discountMax: number | null;
  discountPercent: number | null;
  minimumSpend: number | null;
  startDate: Date;
  endDate: Date;
  status: OfferStatus;
  redemptionCode: string | null;
  merchant: {
    id: string;
    businessName: string;
    slug: string;
    logoUrl: string | null;
    city: string | null;
    state: string | null;
    averageRating: number;
    categoryId: string | null;
  };
}

export interface RedemptionWithDetails {
  id: string;
  redemptionCode: string;
  discountAmount: number;
  spentAmount: number | null;
  savingsAmount: number;
  redeemedAt: Date;
  merchant: {
    id: string;
    businessName: string;
    logoUrl: string | null;
  };
  offer: {
    id: string;
    title: string;
    offerType: string;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  branch?: {
    id: string;
    name: string;
    city: string;
  } | null;
}

export interface CSVUploadResult {
  jobId: string;
  successCount: number;
  errorCount: number;
  totalRows: number;
  rejectedRows: Array<{
    row: number;
    reason: string;
  }>;
}

export interface ActionQueueItemWithRef {
  id: string;
  type: ActionQueueType;
  title: string;
  description: string | null;
  referenceId: string;
  referenceType: string;
  status: ActionQueueStatus;
  priority: number;
  createdAt: Date;
  merchant?: {
    id: string;
    businessName: string;
    email: string;
  } | null;
}

// ============================================================
// NOTIFICATION TYPES
// ============================================================

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  channel: NotificationChannel;
  priority: NotificationPriority;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: Date;
}

// ============================================================
// FILE UPLOAD TYPES
// ============================================================

export interface UploadConfig {
  bucket: string;
  path: string;
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  isPublic: boolean;
}

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

export const UPLOAD_CONFIGS: Record<string, UploadConfig> = {
  merchantLogo: {
    bucket: 'merchant-logos',
    path: '{merchantId}/logo',
    maxSizeBytes: 2 * 1024 * 1024, // 2MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    isPublic: true,
  },
  offerImage: {
    bucket: 'offer-images',
    path: '{merchantId}/offers/{offerId}',
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    isPublic: true,
  },
  heroBanner: {
    bucket: 'hero-banners',
    path: '{bannerId}',
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    isPublic: true,
  },
  csvUpload: {
    bucket: 'csv-uploads',
    path: '{companyId}/{jobId}',
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel'],
    isPublic: false,
  },
};

// ============================================================
// WEBHOOK TYPES
// ============================================================

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface StripeWebhookPayload {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

// ============================================================
// FILTER PROPS FOR COMPONENTS
// ============================================================

export interface SelectOption {
  label: string;
  value: string;
}

export interface TableSortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
}

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (item: T) => React.ReactNode;
}
