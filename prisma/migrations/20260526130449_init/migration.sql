-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'CONTENT_ADMIN');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MerchantOnboardingStep" AS ENUM ('APPLICATION', 'DOCUMENTS', 'AGREEMENT', 'COMPLETE');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING', 'APPROVED_PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'INELIGIBLE');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'LIVE', 'REJECTED', 'EXPIRED', 'REPLACED');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActionQueueStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ActionQueueType" AS ENUM ('MERCHANT_APPROVAL', 'OFFER_APPROVAL', 'OFFER_REPLACEMENT', 'PROFILE_EDIT_REQUEST', 'COMPANY_APPROVAL', 'ISSUE_REVIEW', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "CSVUploadStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "RealtimeEventType" AS ENUM ('REDEMPTION_CREATED', 'REDEMPTION_UPDATED', 'MERCHANT_STATUS_CHANGED', 'COMPANY_STATUS_CHANGED', 'OFFER_STATUS_CHANGED', 'ACTION_QUEUE_UPDATED', 'ANALYTICS_UPDATED', 'ISSUE_REPORTED', 'NOTIFICATION_CREATED', 'EMPLOYEE_STATUS_CHANGED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPPORT_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" VARCHAR(500),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "logoUrl" VARCHAR(500),
    "website" VARCHAR(500),
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING',
    "addressLine1" VARCHAR(255),
    "addressLine2" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "country" VARCHAR(100),
    "taxId" VARCHAR(50),
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_billing" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "plan" VARCHAR(50) NOT NULL,
    "billingEmail" VARCHAR(255),
    "billingCycle" VARCHAR(20) NOT NULL DEFAULT 'monthly',
    "pricePerEmployee" DECIMAL(10,2) NOT NULL DEFAULT 5.0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "stripeCustomerId" VARCHAR(255),
    "stripeSubscriptionId" VARCHAR(255),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "paymentMethodLast4" VARCHAR(4),
    "nextBillingDate" TIMESTAMP(3),
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_admins" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "employeeId" VARCHAR(100),
    "department" VARCHAR(100),
    "jobTitle" VARCHAR(100),
    "phone" VARCHAR(50),
    "avatarUrl" VARCHAR(500),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3),
    "invitedBy" UUID,
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL,
    "businessName" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "contactName" VARCHAR(255) NOT NULL,
    "contactPhone" VARCHAR(50),
    "description" TEXT,
    "logoUrl" VARCHAR(500),
    "coverImageUrl" VARCHAR(500),
    "website" VARCHAR(500),
    "categoryId" UUID,
    "status" "MerchantStatus" NOT NULL DEFAULT 'PENDING',
    "onboardingStep" "MerchantOnboardingStep" NOT NULL DEFAULT 'APPLICATION',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isTopRated" BOOLEAN NOT NULL DEFAULT false,
    "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "totalRedemptions" INTEGER NOT NULL DEFAULT 0,
    "totalSavings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "addressLine1" VARCHAR(255),
    "addressLine2" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "country" VARCHAR(100),
    "socialLinks" JSONB,
    "businessHours" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rejectionReason" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lastOfferSubmitAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_branches" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "addressLine1" VARCHAR(255) NOT NULL,
    "addressLine2" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100),
    "postalCode" VARCHAR(20) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(50),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_offers" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" VARCHAR(500),
    "termsAndConditions" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "offerType" VARCHAR(50) NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "discountMax" DECIMAL(10,2),
    "discountPercent" INTEGER,
    "minimumSpend" DECIMAL(10,2),
    "maxRedemptions" INTEGER DEFAULT 0,
    "currentRedemptions" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "redemptionCode" VARCHAR(100),
    "redemptionInstructions" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "liveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_replacement_requests" (
    "id" UUID NOT NULL,
    "currentOfferId" UUID NOT NULL,
    "newOfferId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "adminId" UUID,
    "adminNotes" TEXT,
    "isApproved" BOOLEAN,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_replacement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_profile_edit_requests" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "requestedFields" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "adminId" UUID,
    "adminNotes" TEXT,
    "isApproved" BOOLEAN,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_profile_edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "redemptionCode" VARCHAR(100) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "spentAmount" DECIMAL(10,2),
    "savingsAmount" DECIMAL(10,2) NOT NULL,
    "branchId" UUID,
    "merchantNotes" TEXT,
    "employeeNotes" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemption_analytics" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "companyId" UUID,
    "offerId" UUID,
    "date" DATE NOT NULL,
    "totalRedemptions" INTEGER NOT NULL DEFAULT 0,
    "totalDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalSavings" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "uniqueEmployees" INTEGER NOT NULL DEFAULT 0,
    "averageDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redemption_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_reports" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "redemptionId" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "adminId" UUID,
    "adminNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_queue_items" (
    "id" UUID NOT NULL,
    "type" "ActionQueueType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "referenceId" UUID NOT NULL,
    "referenceType" VARCHAR(50) NOT NULL,
    "status" "ActionQueueStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "assignedTo" UUID,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero_banners" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "subtitle" VARCHAR(500),
    "imageUrl" VARCHAR(500) NOT NULL,
    "linkUrl" VARCHAR(500),
    "linkText" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_picks" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "most_popular_merchants" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "most_popular_merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_upload_jobs" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "adminId" UUID,
    "fileName" VARCHAR(255) NOT NULL,
    "fileUrl" VARCHAR(500) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" "CSVUploadStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_upload_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_rejected_rows" (
    "id" UUID NOT NULL,
    "csvUploadId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "rowData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csv_rejected_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorType" VARCHAR(50) NOT NULL,
    "adminId" UUID,
    "merchantId" UUID,
    "companyId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" UUID NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" UUID NOT NULL,
    "recipientType" VARCHAR(50) NOT NULL,
    "adminId" UUID,
    "merchantId" UUID,
    "companyAdminId" UUID,
    "employeeId" UUID,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "referenceType" VARCHAR(50),
    "referenceId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_sessions" (
    "id" UUID NOT NULL,
    "userType" VARCHAR(50) NOT NULL,
    "adminId" UUID,
    "merchantId" UUID,
    "companyAdminId" UUID,
    "employeeId" UUID,
    "refreshToken" VARCHAR(500) NOT NULL,
    "accessToken" VARCHAR(500),
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "deviceInfo" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivityAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userType" VARCHAR(50) NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userType" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realtime_events" (
    "id" UUID NOT NULL,
    "eventType" "RealtimeEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "channel" VARCHAR(100) NOT NULL,
    "sourceId" UUID NOT NULL,
    "sourceType" VARCHAR(50) NOT NULL,
    "idempotencyKey" VARCHAR(255),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realtime_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renewal_gaming_alerts" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "alertType" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renewal_gaming_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_status_history" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "fromStatus" "MerchantStatus",
    "toStatus" "MerchantStatus" NOT NULL,
    "changedBy" UUID NOT NULL,
    "changedByType" VARCHAR(50) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_status_history" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "fromStatus" "CompanyStatus",
    "toStatus" "CompanyStatus" NOT NULL,
    "changedBy" UUID NOT NULL,
    "changedByType" VARCHAR(50) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_email_idx" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_role_idx" ON "admin_users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_email_key" ON "companies"("email");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "companies_slug_idx" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_email_idx" ON "companies"("email");

-- CreateIndex
CREATE UNIQUE INDEX "company_billing_companyId_key" ON "company_billing"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_admins_email_key" ON "company_admins"("email");

-- CreateIndex
CREATE INDEX "company_admins_email_idx" ON "company_admins"("email");

-- CreateIndex
CREATE INDEX "company_admins_companyId_idx" ON "company_admins"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_companyId_idx" ON "employees"("companyId");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "employees_companyId_status_idx" ON "employees"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_slug_key" ON "merchants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_email_key" ON "merchants"("email");

-- CreateIndex
CREATE INDEX "merchants_status_idx" ON "merchants"("status");

-- CreateIndex
CREATE INDEX "merchants_slug_idx" ON "merchants"("slug");

-- CreateIndex
CREATE INDEX "merchants_categoryId_idx" ON "merchants"("categoryId");

-- CreateIndex
CREATE INDEX "merchants_status_categoryId_idx" ON "merchants"("status", "categoryId");

-- CreateIndex
CREATE INDEX "merchant_branches_merchantId_idx" ON "merchant_branches"("merchantId");

-- CreateIndex
CREATE INDEX "categories_companyId_idx" ON "categories"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_companyId_slug_key" ON "categories"("companyId", "slug");

-- CreateIndex
CREATE INDEX "merchant_offers_merchantId_idx" ON "merchant_offers"("merchantId");

-- CreateIndex
CREATE INDEX "merchant_offers_status_idx" ON "merchant_offers"("status");

-- CreateIndex
CREATE INDEX "merchant_offers_startDate_endDate_idx" ON "merchant_offers"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "merchant_offers_merchantId_status_idx" ON "merchant_offers"("merchantId", "status");

-- CreateIndex
CREATE INDEX "merchant_offers_status_startDate_endDate_idx" ON "merchant_offers"("status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "offer_replacement_requests_currentOfferId_idx" ON "offer_replacement_requests"("currentOfferId");

-- CreateIndex
CREATE INDEX "offer_replacement_requests_newOfferId_idx" ON "offer_replacement_requests"("newOfferId");

-- CreateIndex
CREATE INDEX "merchant_profile_edit_requests_merchantId_idx" ON "merchant_profile_edit_requests"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_redemptionCode_key" ON "redemptions"("redemptionCode");

-- CreateIndex
CREATE INDEX "redemptions_merchantId_idx" ON "redemptions"("merchantId");

-- CreateIndex
CREATE INDEX "redemptions_offerId_idx" ON "redemptions"("offerId");

-- CreateIndex
CREATE INDEX "redemptions_employeeId_idx" ON "redemptions"("employeeId");

-- CreateIndex
CREATE INDEX "redemptions_companyId_idx" ON "redemptions"("companyId");

-- CreateIndex
CREATE INDEX "redemptions_redeemedAt_idx" ON "redemptions"("redeemedAt");

-- CreateIndex
CREATE INDEX "redemptions_merchantId_redeemedAt_idx" ON "redemptions"("merchantId", "redeemedAt");

-- CreateIndex
CREATE INDEX "redemptions_companyId_redeemedAt_idx" ON "redemptions"("companyId", "redeemedAt");

-- CreateIndex
CREATE INDEX "redemptions_offerId_redeemedAt_idx" ON "redemptions"("offerId", "redeemedAt");

-- CreateIndex
CREATE INDEX "redemption_analytics_merchantId_date_idx" ON "redemption_analytics"("merchantId", "date");

-- CreateIndex
CREATE INDEX "redemption_analytics_companyId_date_idx" ON "redemption_analytics"("companyId", "date");

-- CreateIndex
CREATE INDEX "redemption_analytics_offerId_date_idx" ON "redemption_analytics"("offerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "redemption_analytics_merchantId_date_key" ON "redemption_analytics"("merchantId", "date");

-- CreateIndex
CREATE INDEX "issue_reports_merchantId_idx" ON "issue_reports"("merchantId");

-- CreateIndex
CREATE INDEX "issue_reports_employeeId_idx" ON "issue_reports"("employeeId");

-- CreateIndex
CREATE INDEX "issue_reports_status_idx" ON "issue_reports"("status");

-- CreateIndex
CREATE INDEX "issue_reports_status_priority_idx" ON "issue_reports"("status", "priority");

-- CreateIndex
CREATE INDEX "action_queue_items_status_idx" ON "action_queue_items"("status");

-- CreateIndex
CREATE INDEX "action_queue_items_type_idx" ON "action_queue_items"("type");

-- CreateIndex
CREATE INDEX "action_queue_items_assignedTo_idx" ON "action_queue_items"("assignedTo");

-- CreateIndex
CREATE INDEX "action_queue_items_status_type_idx" ON "action_queue_items"("status", "type");

-- CreateIndex
CREATE INDEX "action_queue_items_referenceId_referenceType_idx" ON "action_queue_items"("referenceId", "referenceType");

-- CreateIndex
CREATE INDEX "weekly_picks_weekStart_weekEnd_idx" ON "weekly_picks"("weekStart", "weekEnd");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_picks_merchantId_weekStart_key" ON "weekly_picks"("merchantId", "weekStart");

-- CreateIndex
CREATE INDEX "most_popular_merchants_companyId_idx" ON "most_popular_merchants"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "most_popular_merchants_merchantId_companyId_key" ON "most_popular_merchants"("merchantId", "companyId");

-- CreateIndex
CREATE INDEX "csv_upload_jobs_companyId_idx" ON "csv_upload_jobs"("companyId");

-- CreateIndex
CREATE INDEX "csv_upload_jobs_status_idx" ON "csv_upload_jobs"("status");

-- CreateIndex
CREATE INDEX "csv_rejected_rows_csvUploadId_idx" ON "csv_rejected_rows"("csvUploadId");

-- CreateIndex
CREATE INDEX "audit_logs_adminId_idx" ON "audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "audit_logs_merchantId_idx" ON "audit_logs"("merchantId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_createdAt_idx" ON "audit_logs"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "notification_events_adminId_idx" ON "notification_events"("adminId");

-- CreateIndex
CREATE INDEX "notification_events_merchantId_idx" ON "notification_events"("merchantId");

-- CreateIndex
CREATE INDEX "notification_events_companyAdminId_idx" ON "notification_events"("companyAdminId");

-- CreateIndex
CREATE INDEX "notification_events_employeeId_idx" ON "notification_events"("employeeId");

-- CreateIndex
CREATE INDEX "notification_events_createdAt_idx" ON "notification_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "login_sessions_refreshToken_key" ON "login_sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "login_sessions_adminId_idx" ON "login_sessions"("adminId");

-- CreateIndex
CREATE INDEX "login_sessions_merchantId_idx" ON "login_sessions"("merchantId");

-- CreateIndex
CREATE INDEX "login_sessions_companyAdminId_idx" ON "login_sessions"("companyAdminId");

-- CreateIndex
CREATE INDEX "login_sessions_employeeId_idx" ON "login_sessions"("employeeId");

-- CreateIndex
CREATE INDEX "login_sessions_refreshToken_idx" ON "login_sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "login_sessions_isActive_idx" ON "login_sessions"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_userType_idx" ON "password_reset_tokens"("userId", "userType");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_userId_userType_idx" ON "email_verification_tokens"("userId", "userType");

-- CreateIndex
CREATE UNIQUE INDEX "realtime_events_idempotencyKey_key" ON "realtime_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "realtime_events_eventType_idx" ON "realtime_events"("eventType");

-- CreateIndex
CREATE INDEX "realtime_events_channel_idx" ON "realtime_events"("channel");

-- CreateIndex
CREATE INDEX "realtime_events_createdAt_idx" ON "realtime_events"("createdAt");

-- CreateIndex
CREATE INDEX "realtime_events_idempotencyKey_idx" ON "realtime_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "renewal_gaming_alerts_employeeId_idx" ON "renewal_gaming_alerts"("employeeId");

-- CreateIndex
CREATE INDEX "renewal_gaming_alerts_createdAt_idx" ON "renewal_gaming_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "merchant_status_history_merchantId_idx" ON "merchant_status_history"("merchantId");

-- CreateIndex
CREATE INDEX "merchant_status_history_createdAt_idx" ON "merchant_status_history"("createdAt");

-- CreateIndex
CREATE INDEX "company_status_history_companyId_idx" ON "company_status_history"("companyId");

-- CreateIndex
CREATE INDEX "company_status_history_createdAt_idx" ON "company_status_history"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");

-- AddForeignKey
ALTER TABLE "company_billing" ADD CONSTRAINT "company_billing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_admins" ADD CONSTRAINT "company_admins_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_branches" ADD CONSTRAINT "merchant_branches_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_offers" ADD CONSTRAINT "merchant_offers_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_replacement_requests" ADD CONSTRAINT "offer_replacement_requests_currentOfferId_fkey" FOREIGN KEY ("currentOfferId") REFERENCES "merchant_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_replacement_requests" ADD CONSTRAINT "offer_replacement_requests_newOfferId_fkey" FOREIGN KEY ("newOfferId") REFERENCES "merchant_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_replacement_requests" ADD CONSTRAINT "offer_replacement_requests_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_profile_edit_requests" ADD CONSTRAINT "merchant_profile_edit_requests_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_profile_edit_requests" ADD CONSTRAINT "merchant_profile_edit_requests_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "merchant_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_queue_items" ADD CONSTRAINT "action_queue_items_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_queue_items" ADD CONSTRAINT "action_queue_items_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_picks" ADD CONSTRAINT "weekly_picks_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "most_popular_merchants" ADD CONSTRAINT "most_popular_merchants_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "most_popular_merchants" ADD CONSTRAINT "most_popular_merchants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_upload_jobs" ADD CONSTRAINT "csv_upload_jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_rejected_rows" ADD CONSTRAINT "csv_rejected_rows_csvUploadId_fkey" FOREIGN KEY ("csvUploadId") REFERENCES "csv_upload_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_companyAdminId_fkey" FOREIGN KEY ("companyAdminId") REFERENCES "company_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_companyAdminId_fkey" FOREIGN KEY ("companyAdminId") REFERENCES "company_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_status_history" ADD CONSTRAINT "merchant_status_history_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_status_history" ADD CONSTRAINT "company_status_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
