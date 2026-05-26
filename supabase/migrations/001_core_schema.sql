-- ============================================================
  -- SUPABASE MIGRATION 001: CORE SCHEMA + RLS
-- ============================================================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'CONTENT_ADMIN');
CREATE TYPE merchant_status AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'ARCHIVED', 'REJECTED');
CREATE TYPE merchant_onboarding_step AS ENUM ('APPLICATION', 'DOCUMENTS', 'AGREEMENT', 'COMPLETE');
CREATE TYPE company_status AS ENUM ('PENDING', 'APPROVED_PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'CANCELLED');
CREATE TYPE employee_status AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'INELIGIBLE');
CREATE TYPE offer_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'LIVE', 'REJECTED', 'EXPIRED', 'REPLACED');
CREATE TYPE issue_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE action_queue_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');
CREATE TYPE action_queue_type AS ENUM ('MERCHANT_APPROVAL', 'OFFER_APPROVAL', 'OFFER_REPLACEMENT', 'PROFILE_EDIT_REQUEST', 'COMPANY_APPROVAL', 'ISSUE_REVIEW', 'CSV_IMPORT');
CREATE TYPE csv_upload_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED');
CREATE TYPE notification_channel AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');
CREATE TYPE notification_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE realtime_event_type AS ENUM (
  'REDEMPTION_CREATED', 'REDEMPTION_UPDATED',
  'MERCHANT_STATUS_CHANGED', 'COMPANY_STATUS_CHANGED',
  'OFFER_STATUS_CHANGED', 'ACTION_QUEUE_UPDATED',
  'ANALYTICS_UPDATED', 'ISSUE_REPORTED',
  'NOTIFICATION_CREATED', 'EMPLOYEE_STATUS_CHANGED'
);

-- Core tables are managed by Prisma; this migration provides
-- RLS policies, triggers, and helper functions.

-- ============================================================
-- HELPER: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- REALTIME: Broadcast on action queue changes
-- ============================================================
CREATE OR REPLACE FUNCTION broadcast_action_queue_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'realtime:action_queue',
    json_build_object(
      'event', TG_OP,
      'id', NEW.id,
      'type', NEW.type,
      'status', NEW.status,
      'timestamp', NOW()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_action_queue_broadcast
  AFTER INSERT OR UPDATE ON action_queue_items
  FOR EACH ROW EXECUTE FUNCTION broadcast_action_queue_update();

-- ============================================================
-- REALTIME: Broadcast on redemption
-- ============================================================
CREATE OR REPLACE FUNCTION broadcast_redemption()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'realtime:redemptions',
    json_build_object(
      'event', TG_OP,
      'id', NEW.id,
      'merchant_id', NEW.merchant_id,
      'offer_id', NEW.offer_id,
      'employee_id', NEW.employee_id,
      'company_id', NEW.company_id,
      'discount_amount', NEW.discount_amount,
      'redeemed_at', NEW.redeemed_at,
      'timestamp', NOW()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_redemption_broadcast
  AFTER INSERT ON redemptions
  FOR EACH ROW EXECUTE FUNCTION broadcast_redemption();

-- ============================================================
-- REALTIME: Broadcast on merchant status change
-- ============================================================
CREATE OR REPLACE FUNCTION broadcast_merchant_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM pg_notify(
      'realtime:merchant_status',
      json_build_object(
        'merchant_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'timestamp', NOW()
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_merchant_status_broadcast
  AFTER UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION broadcast_merchant_status_change();

-- ============================================================
-- REALTIME: Broadcast on offer status change
-- ============================================================
CREATE OR REPLACE FUNCTION broadcast_offer_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM pg_notify(
      'realtime:offer_status',
      json_build_object(
        'offer_id', NEW.id,
        'merchant_id', NEW.merchant_id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'timestamp', NOW()
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_offer_status_broadcast
  AFTER UPDATE ON merchant_offers
  FOR EACH ROW EXECUTE FUNCTION broadcast_offer_status_change();

-- ============================================================
-- REALTIME: Broadcast on company status change
-- ============================================================
CREATE OR REPLACE FUNCTION broadcast_company_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM pg_notify(
      'realtime:company_status',
      json_build_object(
        'company_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'timestamp', NOW()
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_status_broadcast
  AFTER UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION broadcast_company_status_change();

-- ============================================================
-- SOFT DELETE HELPER
-- ============================================================
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  NEW.deleted_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply soft-delete triggers where applicable
-- Companies: deleted_at column
CREATE TRIGGER trg_company_soft_delete
  BEFORE UPDATE ON companies
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION soft_delete();

-- Employees: deleted_at column
CREATE TRIGGER trg_employee_soft_delete
  BEFORE UPDATE ON employees
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION soft_delete();

-- Merchants: deleted_at column
CREATE TRIGGER trg_merchant_soft_delete
  BEFORE UPDATE ON merchants
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION soft_delete();

-- ============================================================
-- ANALYTICS AGGREGATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION aggregate_daily_redemption_analytics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  merchant_id UUID,
  company_id UUID,
  offer_id UUID,
  total_redemptions BIGINT,
  total_discount DECIMAL,
  total_savings DECIMAL,
  unique_employees BIGINT,
  avg_discount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.merchant_id,
    r.company_id,
    r.offer_id,
    COUNT(*)::BIGINT AS total_redemptions,
    COALESCE(SUM(r.discount_amount), 0) AS total_discount,
    COALESCE(SUM(r.savings_amount), 0) AS total_savings,
    COUNT(DISTINCT r.employee_id)::BIGINT AS unique_employees,
    COALESCE(AVG(r.discount_amount), 0) AS avg_discount
  FROM redemptions r
  WHERE r.redeemed_at::DATE = target_date
  GROUP BY r.merchant_id, r.company_id, r.offer_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- REDEMPTION ANALYTICS UPSERT (called by trigger or cron)
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_daily_analytics()
RETURNS TRIGGER AS $$
DECLARE
  agg RECORD;
BEGIN
  FOR agg IN SELECT * FROM aggregate_daily_redemption_analytics(NEW.redeemed_at::DATE) LOOP
    INSERT INTO redemption_analytics (
      merchant_id, company_id, offer_id, date,
      total_redemptions, total_discount, total_savings,
      unique_employees, average_discount
    ) VALUES (
      agg.merchant_id, agg.company_id, agg.offer_id,
      NEW.redeemed_at::DATE,
      agg.total_redemptions, agg.total_discount, agg.total_savings,
      agg.unique_employees, agg.avg_discount
    )
    ON CONFLICT (merchant_id, date) DO UPDATE SET
      total_redemptions = EXCLUDED.total_redemptions,
      total_discount = EXCLUDED.total_discount,
      total_savings = EXCLUDED.total_savings,
      unique_employees = EXCLUDED.unique_employees,
      average_discount = EXCLUDED.average_discount,
      updated_at = NOW();
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_redemption_analytics_upsert
  AFTER INSERT ON redemptions
  FOR EACH ROW EXECUTE FUNCTION upsert_daily_analytics();

-- ============================================================
-- AUTO-CREATE ACTION QUEUE ON NEW MERCHANT
-- ============================================================
CREATE OR REPLACE FUNCTION auto_create_merchant_approval_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO action_queue_items (type, title, description, reference_id, reference_type, status, priority)
  VALUES (
    'MERCHANT_APPROVAL',
    'New Merchant Application: ' || NEW.business_name,
    'Merchant ' || NEW.business_name || ' has submitted an application and requires review.',
    NEW.id,
    'merchant',
    'PENDING',
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_merchant_approval_action
  AFTER INSERT ON merchants
  FOR EACH ROW
  WHEN (NEW.status = 'PENDING')
  EXECUTE FUNCTION auto_create_merchant_approval_action();

-- ============================================================
-- AUTO-CREATE ACTION QUEUE ON NEW OFFER
-- ============================================================
CREATE OR REPLACE FUNCTION auto_create_offer_approval_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO action_queue_items (type, title, description, reference_id, reference_type, status, priority)
  VALUES (
    'OFFER_APPROVAL',
    'New Offer Pending Approval: ' || NEW.title,
    'Offer "' || NEW.title || '" submitted by merchant requires review.',
    NEW.id,
    'offer',
    'PENDING',
    2
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_offer_approval_action
  AFTER UPDATE ON merchant_offers
  FOR EACH ROW
  WHEN (NEW.status = 'PENDING_APPROVAL' AND OLD.status IS DISTINCT FROM 'PENDING_APPROVAL')
  EXECUTE FUNCTION auto_create_offer_approval_action();

-- ============================================================
-- AUTO CREATE AUDIT LOG
-- ============================================================
CREATE OR REPLACE FUNCTION auto_log_audit()
RETURNS TRIGGER AS $$
BEGIN
  -- merchant status changes
  IF TG_TABLE_NAME = 'merchants' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (actor_id, actor_type, action, entity_type, entity_id, changes, metadata)
    VALUES (
      COALESCE(NEW.id, OLD.id), 'system', 'merchant.status_changed', 'merchant', NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status),
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_merchant_audit
  AFTER UPDATE ON merchants
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_log_audit();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Admin Users: only admins can read; only super_admin can write
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_users_select ON admin_users
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

CREATE POLICY admin_users_insert ON admin_users
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'user_type' = 'admin' AND
    auth.jwt() ->> 'admin_role' = 'SUPER_ADMIN'
  );

CREATE POLICY admin_users_update ON admin_users
  FOR UPDATE USING (
    auth.jwt() ->> 'user_type' = 'admin' AND
    auth.jwt() ->> 'admin_role' = 'SUPER_ADMIN'
  );

-- Merchants: merchant reads own, admin reads all
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchants_select_own ON merchants
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'merchant' AND
    auth.uid()::text = id::text
  );

CREATE POLICY merchants_select_admin ON merchants
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

CREATE POLICY merchants_update_own ON merchants
  FOR UPDATE USING (
    auth.jwt() ->> 'user_type' = 'merchant' AND
    auth.uid()::text = id::text
  );

CREATE POLICY merchants_update_admin ON merchants
  FOR UPDATE USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

-- Redemptions: merchant sees own, company sees own employees, admin sees all
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY redemptions_select_merchant ON redemptions
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'merchant' AND
    merchant_id::text = auth.uid()::text
  );

CREATE POLICY redemptions_select_company ON redemptions
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'company_admin' AND
    company_id IN (
      SELECT company_id FROM company_admins WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY redemptions_select_admin ON redemptions
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

CREATE POLICY redemptions_insert_employee ON redemptions
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'user_type' = 'employee' AND
    employee_id::text = auth.uid()::text
  );

-- Action Queue: admin only
ALTER TABLE action_queue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_queue_select ON action_queue_items
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

CREATE POLICY action_queue_update ON action_queue_items
  FOR UPDATE USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

-- Companies: admin sees all, company_admin sees own
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_select_admin ON companies
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

CREATE POLICY companies_select_own ON companies
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'company_admin' AND
    id IN (
      SELECT company_id FROM company_admins WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY companies_update_admin ON companies
  FOR UPDATE USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

-- Employees: company_admin sees own employees, admin sees all, employee sees own
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_select_company ON employees
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'company_admin' AND
    company_id IN (
      SELECT company_id FROM company_admins WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY employees_select_admin ON employees
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

CREATE POLICY employees_select_own ON employees
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'employee' AND
    id::text = auth.uid()::text
  );

-- Offers: merchant sees own, admin sees all, company/employee sees live
ALTER TABLE merchant_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY offers_select_merchant ON merchant_offers
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'merchant' AND
    merchant_id::text = auth.uid()::text
  );

CREATE POLICY offers_select_admin ON merchant_offers
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

CREATE POLICY offers_select_public ON merchant_offers
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' IN ('company_admin', 'employee') AND
    status = 'LIVE'
  );

-- Notification Events: recipient sees own
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notification_events
  FOR SELECT USING (
    recipient_id::text = auth.uid()::text
  );

CREATE POLICY notifications_update ON notification_events
  FOR UPDATE USING (
    recipient_id::text = auth.uid()::text
  );

-- Audit Logs: admin only
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

-- CSV Upload Jobs: company sees own, admin sees all
ALTER TABLE csv_upload_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY csv_upload_select_company ON csv_upload_jobs
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'company_admin' AND
    company_id IN (
      SELECT company_id FROM company_admins WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY csv_upload_select_admin ON csv_upload_jobs
  FOR SELECT USING (
    auth.jwt() ->> 'user_type' = 'admin'
  );

-- ============================================================
-- STORAGE BUCKETS & POLICIES
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES
  ('merchant-logos', 'merchant-logos', true),
  ('offer-images', 'offer-images', true),
  ('hero-banners', 'hero-banners', true),
  ('csv-uploads', 'csv-uploads', false),
  ('employee-avatars', 'employee-avatars', true);

-- Merchant logos: authenticated merchants can upload own
CREATE POLICY "merchant_logos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'merchant-logos' AND
    auth.role() = 'authenticated'
  );

-- Offer images: authenticated merchants can upload
CREATE POLICY "offer_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'offer-images' AND
    auth.role() = 'authenticated'
  );

-- CSV uploads: company admins can upload
CREATE POLICY "csv_uploads_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'csv-uploads' AND
    auth.jwt() ->> 'user_type' = 'company_admin'
  );

CREATE POLICY "csv_uploads_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'csv-uploads' AND
    auth.jwt() ->> 'user_type' IN ('company_admin', 'admin')
  );

-- Public read for public buckets
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('merchant-logos', 'offer-images', 'hero-banners', 'employee-avatars')
  );

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE action_queue_items;
ALTER PUBLICATION supabase_realtime ADD TABLE redemptions;
ALTER PUBLICATION supabase_realtime ADD TABLE merchants;
ALTER PUBLICATION supabase_realtime ADD TABLE merchant_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE companies;
ALTER PUBLICATION supabase_realtime ADD TABLE notification_events;

COMMIT;
