# Prisma Schema — Entity Relationship Model

> Generated from `prisma/schema.prisma` — 1317 lines, PostgreSQL

---

## Legend

| Symbol | Meaning |
|---|---|
| `id` | Primary Key |
| `FK` | Foreign Key |
| `?` | Nullable |
| `[]` | To-many relationship |
| `1──N` | One-to-Many |
| `1──1` | One-to-One |
| `N──N` | Many-to-Many (via junction table) |

---

## Core User / Auth Models

### Account

| Column | Type | Constraint | References |
|---|---|---|---|
| `authUserId` | `uuid` | `PK` | — |
| `email` | `varchar(255)` | `UNIQUE` | — |
| `role` | `AccountRole` | — | — |
| `profileType` | `ProfileType` | — | — |
| `status` | `AccountStatus` | `DEFAULT PENDING` | — |

**Relations:**

```
Account 1──N Employee  ("EmployeeAccount", via accountId FK)
Account 1──N Merchant  (via accountId FK)
```

---

### AdminUser

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `role` | `AdminRole` | `DEFAULT SUPPORT_ADMIN` | — |

**Relations:**

```
AdminUser 1──N ActionQueueItem              (via assignedTo FK)
AdminUser 1──N AuditLog                     ("AdminAuditLogs")
AdminUser 1──N IssueReport                  ("AdminIssueReview", via adminId FK)
AdminUser 1──N LoginSession
AdminUser 1──N MerchantProfileEditRequest   ("AdminProfileEdit")
AdminUser 1──N NotificationEvent            ("AdminNotification")
AdminUser 1──N OfferReplacementRequest      ("AdminOfferReplacement")
AdminUser 1──N ComplaintEscalation          (via superAdminId FK)
AdminUser 1──N ComplaintAction              ("AdminComplaintActions")
```

---

### LoginSession

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `userType` | `varchar(50)` | — | — |
| `adminId` | `uuid?` | `FK` | `admin_users(id)` |
| `companyAdminId` | `uuid?` | `FK` | `company_admins(id)` |
| `employeeId` | `uuid?` | `FK` | `employees(id)` |
| `merchantId` | `uuid?` | `FK` | `merchants(id)` |

**Relations:**

```
LoginSession N──1 AdminUser
LoginSession N──1 CompanyAdmin
LoginSession N──1 Employee
LoginSession N──1 Merchant
```

---

## Company Domain

### Company

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `name` | `varchar(255)` | — | — |
| `slug` | `varchar(255)` | `UNIQUE` | — |
| `email` | `varchar(255)` | `UNIQUE` | — |
| `status` | `CompanyStatus` | `DEFAULT PENDING` | — |

**Relations:**

```
Company 1──1  CompanyBilling
Company 1──N  CompanyAdmin
Company 1──N  CompanyStatusHistory
Company 1──N  CSVUploadJob
Company 1──N  Employee
Company 1──N  MostPopularMerchant
Company 1──N  Redemption
Company 1──N  AuditLog               ("CompanyAuditLogs")
Company 1──N  Complaint
Company 1──N  MerchantReview
```

---

### CompanyBilling

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `companyId` | `uuid` | `UNIQUE FK CASCADE` | `companies(id)` |

**Relations:**

```
CompanyBilling 1──1 Company
```

---

### CompanyAdmin

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `companyId` | `uuid` | `FK CASCADE` | `companies(id)` |

**Relations:**

```
CompanyAdmin N──1 Company
CompanyAdmin 1──N LoginSession
CompanyAdmin 1──N NotificationEvent        ("CompanyAdminNotification")
CompanyAdmin 1──N AuditLog                 ("CompanyAdminAuditLogs")
CompanyAdmin 1──N ComplaintEscalation
CompanyAdmin 1──N ComplaintAction          ("CompanyAdminComplaintActions")
```

---

### CompanyStatusHistory

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `companyId` | `uuid` | `FK` | `companies(id)` |

**Relations:**

```
CompanyStatusHistory N──1 Company
```

---

### Employee

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `companyId` | `uuid` | `FK` | `companies(id)` |
| `accountId` | `uuid?` | `FK` | `accounts(authUserId)` |

**Relations:**

```
Employee N──1  Company
Employee N──1  Account              ("EmployeeAccount")
Employee 1──N  IssueReport
Employee 1──N  LoginSession
Employee 1──N  NotificationEvent    ("EmployeeNotification")
Employee 1──N  Redemption
Employee 1──N  OfferView
Employee 1──N  AuditLog             ("EmployeeAuditLogs")
Employee 1──N  Complaint
Employee 1──N  ComplaintAction      ("EmployeeComplaintActions")
Employee 1──N  MerchantReview
```

---

## Merchant Domain

### Merchant

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `slug` | `varchar(255)` | `UNIQUE` | — |
| `categoryId` | `uuid?` | `FK` | `categories(id)` |
| `accountId` | `uuid?` | `FK` | `accounts(authUserId)` |

**Relations:**

```
Merchant N──1  Account
Merchant N──1  Category
Merchant 1──N  ActionQueueItem
Merchant 1──N  AuditLog                      ("MerchantAuditLogs")
Merchant 1──N  HeroBanner
Merchant 1──N  IssueReport
Merchant 1──N  LoginSession
Merchant 1──N  MerchantBranch
Merchant 1──N  MerchantOffer
Merchant 1──N  MerchantProfileEditRequest
Merchant 1──N  MerchantStatusHistory
Merchant 1──N  MostPopularMerchant
Merchant 1──N  NotificationEvent             ("MerchantNotification")
Merchant 1──N  Redemption
Merchant 1──N  WeeklyPick
Merchant 1──N  Complaint
Merchant 1──N  ComplaintAction               ("MerchantComplaintActions")
Merchant 1──N  MerchantReview
Merchant 1──N  BannerBooking
```

---

### MerchantBranch

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `merchantId` | `uuid` | `FK CASCADE` | `merchants(id)` |

**Relations:**

```
MerchantBranch N──1 Merchant
```

---

### MerchantStatusHistory

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `merchantId` | `uuid` | `FK` | `merchants(id)` |

**Relations:**

```
MerchantStatusHistory N──1 Merchant
```

---

### Category

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `slug` | `varchar(100)` | `UNIQUE` | — |

**Relations:**

```
Category 1──N Merchant
```

---

### MerchantProfileEditRequest

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `merchantId` | `uuid` | `FK` | `merchants(id)` |
| `adminId` | `uuid?` | `FK` | `admin_users(id)` |

**Relations:**

```
MerchantProfileEditRequest N──1 Merchant
MerchantProfileEditRequest N──1 AdminUser  ("AdminProfileEdit")
```

---

### MerchantReview

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `employeeId` | `uuid` | `FK NOT NULL` | `employees(id)` |
| `merchantId` | `uuid` | `FK NOT NULL` | `merchants(id)` |
| `companyId` | `uuid` | `FK NOT NULL` | `companies(id)` |
| `offerId` | `uuid?` | `FK` | `merchant_offers(id)` |
| `redemptionId` | `uuid?` | `FK` | `redemptions(id)` |
| `rating` | `int` | `CHECK 1–5` | — |

**Constraints:** `@@unique([employeeId, merchantId])`

**Relations:**

```
MerchantReview N──1 Employee
MerchantReview N──1 Merchant
MerchantReview N──1 Company
MerchantReview N──1 MerchantOffer
MerchantReview 1──1 Redemption
```

---

## Offer Domain

### MerchantOffer

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `merchantId` | `uuid` | `FK` | `merchants(id)` |
| `replacesOfferId` | `uuid?` | `FK` | `merchant_offers(id)` |

**Relations:**

```
MerchantOffer N──1  Merchant
MerchantOffer 1──1  OfferContent
MerchantOffer 1──1  OfferPricing
MerchantOffer 1──1  OfferRedemption
MerchantOffer 1──1  OfferReview
MerchantOffer 1──1  OfferAnalytics
MerchantOffer 1──N  DailyOfferAnalytics
MerchantOffer 1──N  Redemption
MerchantOffer 1──N  OfferView
MerchantOffer 1──N  OfferReplacementRequest  ("CurrentOffer")
MerchantOffer 1──N  OfferReplacementRequest  ("NewOffer")
MerchantOffer 1──N  Complaint
MerchantOffer 1──N  MerchantReview

-- Self-referencing:
MerchantOffer 1──N  MerchantOffer            ("OfferReplacement", via replacesOfferId)
```

---

### OfferContent

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `offerId` | `uuid` | `UNIQUE FK CASCADE` | `merchant_offers(id)` |

**Relations:**

```
OfferContent 1──1 MerchantOffer
```

---

### OfferPricing

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `offerId` | `uuid` | `UNIQUE FK CASCADE` | `merchant_offers(id)` |

**Relations:**

```
OfferPricing 1──1 MerchantOffer
```

---

### OfferRedemption

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `offerId` | `uuid` | `UNIQUE FK CASCADE` | `merchant_offers(id)` |

**Relations:**

```
OfferRedemption 1──1 MerchantOffer
```

---

### OfferReview

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `offerId` | `uuid` | `UNIQUE FK CASCADE` | `merchant_offers(id)` |

**Relations:**

```
OfferReview 1──1 MerchantOffer
```

---

### OfferAnalytics

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `offerId` | `uuid` | `UNIQUE FK CASCADE` | `merchant_offers(id)` |

**Relations:**

```
OfferAnalytics 1──1 MerchantOffer
```

---

### DailyOfferAnalytics

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `offerId` | `uuid` | `FK CASCADE` | `merchant_offers(id)` |
| `date` | `date` | — | — |

**Constraints:** `@@unique([offerId, date])`

**Relations:**

```
DailyOfferAnalytics N──1 MerchantOffer
```

---

### OfferView

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `offerId` | `uuid` | `FK CASCADE` | `merchant_offers(id)` |
| `employeeId` | `uuid` | `FK CASCADE` | `employees(id)` |

**Constraints:** `@@unique([offerId, employeeId])`

**Relations:**

```
OfferView N──1 MerchantOffer
OfferView N──1 Employee
```

---

### OfferReplacementRequest

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `currentOfferId` | `uuid` | `FK` | `merchant_offers(id)` |
| `newOfferId` | `uuid` | `FK` | `merchant_offers(id)` |
| `adminId` | `uuid?` | `FK` | `admin_users(id)` |

**Relations:**

```
OfferReplacementRequest N──1 MerchantOffer  ("CurrentOffer")
OfferReplacementRequest N──1 MerchantOffer  ("NewOffer")
OfferReplacementRequest N──1 AdminUser      ("AdminOfferReplacement")
```

---

## Redemption Domain

### Redemption

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `merchantId` | `uuid` | `FK` | `merchants(id)` |
| `offerId` | `uuid` | `FK` | `merchant_offers(id)` |
| `employeeId` | `uuid` | `FK` | `employees(id)` |
| `companyId` | `uuid` | `FK` | `companies(id)` |

**Relations:**

```
Redemption N──1 Company
Redemption N──1 Employee
Redemption N──1 Merchant
Redemption N──1 MerchantOffer
Redemption 1──1 MerchantReview?  (optional inverse)
```

---

### RedemptionAnalytics

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `merchantId` | `uuid` | — | — |
| `companyId` | `uuid?` | — | — |
| `offerId` | `uuid?` | — | — |
| `date` | `date` | — | — |

**Constraints:** `@@unique([merchantId, date])`

**(No FK constraints — aggregated data table)**

---

## Complaint Domain

### Complaint

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `offerId` | `uuid` | `FK` | `merchant_offers(id)` |
| `employeeId` | `uuid` | `FK` | `employees(id)` |
| `merchantId` | `uuid` | `FK` | `merchants(id)` |
| `companyId` | `uuid` | `FK` | `companies(id)` |

**Relations:**

```
Complaint N──1 MerchantOffer
Complaint N──1 Employee
Complaint N──1 Merchant
Complaint N──1 Company
Complaint 1──N ComplaintEscalation
Complaint 1──N ComplaintAction
```

---

### ComplaintEscalation

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `complaintId` | `uuid` | `FK CASCADE` | `complaints(id)` |
| `companyAdminId` | `uuid` | `FK` | `company_admins(id)` |
| `superAdminId` | `uuid?` | `FK` | `admin_users(id)` |

**Relations:**

```
ComplaintEscalation N──1 Complaint
ComplaintEscalation N──1 CompanyAdmin
ComplaintEscalation N──1 AdminUser  (via superAdminId)
```

---

### ComplaintAction

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `complaintId` | `uuid` | `FK CASCADE` | `complaints(id)` |
| `adminId` | `uuid?` | `FK` | `admin_users(id)` |
| `companyAdminId` | `uuid?` | `FK` | `company_admins(id)` |
| `employeeId` | `uuid?` | `FK` | `employees(id)` |
| `merchantId` | `uuid?` | `FK` | `merchants(id)` |

**Relations:**

```
ComplaintAction N──1 Complaint
ComplaintAction N──1 AdminUser       ("AdminComplaintActions")
ComplaintAction N──1 CompanyAdmin    ("CompanyAdminComplaintActions")
ComplaintAction N──1 Employee        ("EmployeeComplaintActions")
ComplaintAction N──1 Merchant        ("MerchantComplaintActions")
```

---

## Banner / Promotions Domain

### Banner

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `position` | `varchar(50)` | — | — |

**Relations:**

```
Banner 1──N BannerBooking
```

---

### BannerBooking

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `bannerId` | `uuid` | `FK` | `banners(id)` |
| `merchantId` | `uuid` | `FK` | `merchants(id)` |

**Relations:**

```
BannerBooking N──1 Banner
BannerBooking N──1 Merchant
BannerBooking 1──1 BannerContent
```

---

### BannerContent

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `bookingId` | `uuid` | `UNIQUE FK CASCADE` | `banner_bookings(id)` |

**Relations:**

```
BannerContent 1──1 BannerBooking
```

---

## Content / Marketing Models

### HeroBanner

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `merchantId` | `uuid?` | `FK` | `merchants(id)` |

**Relations:**

```
HeroBanner N──1 Merchant
```

---

### WeeklyPick

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `merchantId` | `uuid` | `FK` | `merchants(id)` |
| `weekStart` | `date` | — | — |

**Constraints:** `@@unique([merchantId, weekStart])`

**Relations:**

```
WeeklyPick N──1 Merchant
```

---

### MostPopularMerchant

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `merchantId` | `uuid` | `FK` | `merchants(id)` |
| `companyId` | `uuid` | `FK` | `companies(id)` |

**Constraints:** `@@unique([merchantId, companyId])`

**Relations:**

```
MostPopularMerchant N──1 Merchant
MostPopularMerchant N──1 Company
```

---

## Issue / Support Models

### IssueReport

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `merchantId` | `uuid` | `FK` | `merchants(id)` |
| `employeeId` | `uuid?` | `FK` | `employees(id)` |
| `adminId` | `uuid?` | `FK` | `admin_users(id)` |

**Relations:**

```
IssueReport N──1 Merchant
IssueReport N──1 Employee
IssueReport N──1 AdminUser  ("AdminIssueReview")
```

---

### ActionQueueItem

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `assignedTo` | `uuid?` | `FK` | `admin_users(id)` |
| `referenceId` | `uuid` | `FK` | `merchants(id)` |

**Relations:**

```
ActionQueueItem N──1 AdminUser
ActionQueueItem N──1 Merchant
```

---

## CSV Upload

### CSVUploadJob

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `companyId` | `uuid` | `FK` | `companies(id)` |

**Relations:**

```
CSVUploadJob N──1 Company
CSVUploadJob 1──N CSVRejectedRow
```

---

### CSVRejectedRow

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `csvUploadId` | `uuid` | `FK CASCADE` | `csv_upload_jobs(id)` |

**Relations:**

```
CSVRejectedRow N──1 CSVUploadJob
```

---

## Notification / Audit / Utility Models

### NotificationEvent

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `adminId` | `uuid?` | `FK` | `admin_users(id)` |
| `companyAdminId` | `uuid?` | `FK` | `company_admins(id)` |
| `employeeId` | `uuid?` | `FK` | `employees(id)` |
| `merchantId` | `uuid?` | `FK` | `merchants(id)` |

**Relations:**

```
NotificationEvent N──1 AdminUser       ("AdminNotification")
NotificationEvent N──1 CompanyAdmin    ("CompanyAdminNotification")
NotificationEvent N──1 Employee        ("EmployeeNotification")
NotificationEvent N──1 Merchant        ("MerchantNotification")
```

---

### AuditLog

| Column | Type | Constraint | References |
|---|---|---|---|
| `id` | `uuid` | `PK` | — |
| `adminId` | `uuid?` | `FK` | `admin_users(id)` |
| `merchantId` | `uuid?` | `FK` | `merchants(id)` |
| `companyId` | `uuid?` | `FK` | `companies(id)` |
| `companyAdminId` | `uuid?` | `FK` | `company_admins(id)` |
| `employeeId` | `uuid?` | `FK` | `employees(id)` |

**Relations:**

```
AuditLog N──1 AdminUser       ("AdminAuditLogs")
AuditLog N──1 Company         ("CompanyAuditLogs")
AuditLog N──1 Merchant        ("MerchantAuditLogs")
AuditLog N──1 CompanyAdmin    ("CompanyAdminAuditLogs")
AuditLog N──1 Employee        ("EmployeeAuditLogs")
```

---

### LoginBranding

Single-row branding config — no foreign key relationships.

---

### PasswordResetToken / EmailVerificationToken / RealtimeEvent / PlatformSettings / RenewalGamingAlert

Utility / token / event models — no FK relations to other models (referenced by `userId` + `userType` pattern or standalone).

---

## Enum Summary

| Enum | Values |
|---|---|
| `AccountRole` | `SUPER_ADMIN`, `COMPANY_ADMIN`, `EMPLOYEE`, `MERCHANT` |
| `ProfileType` | `ADMIN`, `COMPANY`, `EMPLOYEE`, `MERCHANT` |
| `AccountStatus` | `ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING` |
| `AdminRole` | `SUPER_ADMIN`, `SUPPORT_ADMIN`, `FINANCE_ADMIN`, `CONTENT_ADMIN` |
| `MerchantStatus` | `PENDING`, `ACTIVE`, `PAUSED`, `SUSPENDED`, `ARCHIVED`, `REJECTED` |
| `MerchantOnboardingStep` | `APPLICATION`, `DOCUMENTS`, `AGREEMENT`, `COMPLETE` |
| `CompanyStatus` | `PENDING`, `APPROVED_PENDING_PAYMENT`, `ACTIVE`, `PAUSED`, `SUSPENDED`, `CANCELLED` |
| `BillingStatus` | `ACTIVE`, `INVOICE_OVERDUE`, `ON_HOLD` |
| `EmployeeStatus` | `INVITED`, `ACTIVE`, `INACTIVE`, `SUSPENDED`, `INELIGIBLE` |
| `OfferStatus` | `DRAFT`, `PENDING_APPROVAL`, `LIVE`, `REJECTED`, `EXPIRED`, `REPLACED`, `VALIDATION_IN_PROGRESS`, `AWAITING_APPROVAL`, `VALIDATION_FAILED`, `ARCHIVED`, `CHANGES_REQUESTED` |
| `IssueStatus` | `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `REJECTED` |
| `ReplacementStatus` | `PENDING`, `AWAITING_APPROVAL`, `APPROVED`, `REJECTED`, `CLARIFICATION_REQUESTED` |
| `ActionQueueStatus` | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `SKIPPED` |
| `ActionQueueType` | `NEW_MERCHANT_APPLICATION`, `FIRST_OFFER_APPROVAL`, `OFFER_REPLACEMENT`, `PROFILE_EDIT_REQUEST`, `COMPANY_ACTIVATION`, `ISSUE_REVIEW`, `CSV_IMPORT`, `BRANCH_EDIT_REQUEST`, `ASSET_REVIEW` |
| `CSVUploadStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `PARTIALLY_COMPLETED`, `FAILED` |
| `NotificationChannel` | `IN_APP`, `EMAIL`, `PUSH`, `SMS` |
| `NotificationPriority` | `LOW`, `NORMAL`, `HIGH`, `URGENT` |
| `RealtimeEventType` | `REDEMPTION_CREATED`, `REDEMPTION_UPDATED`, `MERCHANT_STATUS_CHANGED`, `COMPANY_STATUS_CHANGED`, `OFFER_STATUS_CHANGED`, `ACTION_QUEUE_UPDATED`, `ANALYTICS_UPDATED`, `ISSUE_REPORTED`, `NOTIFICATION_CREATED`, `EMPLOYEE_STATUS_CHANGED` |
| `BranchType` | `IN_STORE`, `ONLINE` |
| `BranchStatus` | `ACTIVE`, `INACTIVE`, `CLOSED` |
| `ComplaintType` | `MISLEADING`, `INVALID_TERMS`, `NON_FUNCTIONAL`, `POLICY_VIOLATION` |
| `ComplaintStatus` | `OPEN`, `UNDER_REVIEW`, `CLARIFICATION_REQ`, `ESCALATED`, `RESOLVED`, `REJECTED` |
| `ComplaintPriority` | `HIGH`, `MEDIUM`, `LOW` |
| `BookingStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |

---

## High-Level Entity Map (Cardinality)

```
Account ──1──N── Employee
Account ──1──N── Merchant
AdminUser ──1──N── (sessions, audits, notifications, escalations, actions)
Company ──1──1── CompanyBilling
Company ──1──N── CompanyAdmin
Company ──1──N── Employee
Company ──1──N── Redemption
Company ──1──N── Complaint
Company ──1──N── MerchantReview
Merchant ──1──N── MerchantOffer
Merchant ──1──N── MerchantBranch
Merchant ──1──N── Redemption
Merchant ──1──N── BannerBooking
Merchant ──1──N── Complaint
Merchant ──1──N── MerchantReview
MerchantOffer ──1──1── OfferContent
MerchantOffer ──1──1── OfferPricing
MerchantOffer ──1──1── OfferRedemption
MerchantOffer ──1──1── OfferReview
MerchantOffer ──1──1── OfferAnalytics
MerchantOffer ──1──N── Redemption
MerchantOffer ──1──N── DailyOfferAnalytics
MerchantOffer ──1──N── MerchantReview
Employee ──1──N── Redemption
Employee ──1──N── Complaint
Employee ──1──N── MerchantReview
Redemption ──1──1── MerchantReview
Banner ──1──N── BannerBooking ──1──1── BannerContent
Complaint ──1──N── ComplaintEscalation
Complaint ──1──N── ComplaintAction
```
