-- Migration: Centralize email into Account table
-- Removes email columns from profile tables, adds accountId FK relations

-- Step 1: Add accountId columns to profile tables (nullable initially)
ALTER TABLE "admin_users" ADD COLUMN "accountId" UUID;
ALTER TABLE "company_admins" ADD COLUMN "accountId" UUID;
ALTER TABLE "employees" ADD COLUMN "accountId" UUID;
ALTER TABLE "merchants" ADD COLUMN "accountId" UUID;

-- Step 2: Link existing profiles to their accounts via matching email
-- AdminUser -> Account
UPDATE "admin_users" u
SET "accountId" = a."authUserId"
FROM "accounts" a
WHERE a.email = u.email AND a."profileType" = 'ADMIN';

-- CompanyAdmin -> Account
UPDATE "company_admins" ca
SET "accountId" = a."authUserId"
FROM "accounts" a
WHERE a.email = ca.email AND a."profileType" = 'COMPANY';

-- Employee -> Account
UPDATE "employees" e
SET "accountId" = a."authUserId"
FROM "accounts" a
WHERE a.email = e.email AND a."profileType" = 'EMPLOYEE';

-- Merchant -> Account
UPDATE "merchants" m
SET "accountId" = a."authUserId"
FROM "accounts" a
WHERE a.email = m.email AND a."profileType" = 'MERCHANT';

-- Step 3: Add unique constraints on accountId
CREATE UNIQUE INDEX "admin_users_accountId_key" ON "admin_users"("accountId");
CREATE UNIQUE INDEX "company_admins_accountId_key" ON "company_admins"("accountId");
CREATE UNIQUE INDEX "employees_accountId_key" ON "employees"("accountId");
CREATE UNIQUE INDEX "merchants_accountId_key" ON "merchants"("accountId");

-- Step 4: Add foreign key constraints
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("authUserId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "company_admins" ADD CONSTRAINT "company_admins_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("authUserId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("authUserId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("authUserId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 5: Backfill passwordHash into accounts from profile tables
UPDATE "accounts" a
SET "passwordHash" = u."passwordHash"
FROM "admin_users" u
WHERE u."accountId" = a."authUserId";

UPDATE "accounts" a
SET "passwordHash" = ca."passwordHash"
FROM "company_admins" ca
WHERE ca."accountId" = a."authUserId";

UPDATE "accounts" a
SET "passwordHash" = m."passwordHash"
FROM "merchants" m
WHERE m."accountId" = a."authUserId";

-- Step 6: Drop old columns from profile tables (source of truth is now Account.email + Account.passwordHash)
-- Drop passwordHash from admin_users, company_admins, merchants (Prisma schema already removed them)
-- Keep passwordHash on employees (Prisma schema still has it)
-- Add password_hash to accounts table for admin/merchant/company_admin auth
ALTER TABLE "accounts" ADD COLUMN "passwordHash" VARCHAR(255);
ALTER TABLE "admin_users" DROP COLUMN "email";
ALTER TABLE "admin_users" DROP COLUMN "passwordHash";
ALTER TABLE "company_admins" DROP COLUMN "email";
ALTER TABLE "company_admins" DROP COLUMN "passwordHash";
ALTER TABLE "employees" DROP COLUMN "email";
ALTER TABLE "merchants" DROP COLUMN "email";
ALTER TABLE "merchants" DROP COLUMN "passwordHash";
