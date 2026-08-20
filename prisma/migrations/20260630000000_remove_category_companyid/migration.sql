-- Migration: Remove companyId from Category (global categories)
--
-- Step 1: Update merchants to point to the canonical (lowest-id) category per name
-- Step 2: Update merchant_offers to point to the canonical category (no FK, but maintain consistency)
-- Step 3: Delete duplicate category rows
-- Step 4: Drop FK constraint, indexes, and column
-- Step 5: Make slug globally unique

-- Step 1: Update merchants FK to point to canonical categories
UPDATE merchants m
SET "categoryId" = (
  SELECT MIN(c2.id)
  FROM categories c2
  WHERE c2.name = (SELECT c3.name FROM categories c3 WHERE c3.id = m."categoryId")
)
WHERE "categoryId" IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
    FROM categories
  ) sub
  WHERE sub.rn > 1
);

-- Step 2: Update merchant_offers categoryId (no FK, but keep consistent)
UPDATE merchant_offers mo
SET "categoryId" = (
  SELECT MIN(c2.id)
  FROM categories c2
  WHERE c2.name = (SELECT c3.name FROM categories c3 WHERE c3.id = mo."categoryId")
)
WHERE "categoryId" IS NOT NULL
  AND "categoryId" IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
      FROM categories
    ) sub
    WHERE sub.rn > 1
  );

-- Step 3: Delete duplicate category rows (keep lowest id per name)
DELETE FROM categories
WHERE id NOT IN (
  SELECT MIN(id) FROM categories GROUP BY name
);

-- Step 4a: Drop FK constraint from categories to companies
ALTER TABLE "categories" DROP CONSTRAINT "categories_companyId_fkey";

-- Step 4b: Drop indexes
DROP INDEX IF EXISTS "categories_companyId_idx";
DROP INDEX IF EXISTS "categories_companyId_slug_key";

-- Step 4c: Drop companyId column
ALTER TABLE "categories" DROP COLUMN "companyId";

-- Step 5: Make slug globally unique
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
