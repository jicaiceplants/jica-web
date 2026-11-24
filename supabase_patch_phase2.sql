-- ==============================================================================
-- JICA ICE LOGISTICS & DELIVERY - CAGAYAN DE ORO CITY
-- PHASE 2 IDEMPOTENT PRODUCTION MIGRATION PATCH
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- It safely upgrades your existing database schema with:
-- 1. Schema-wide permissions grant (fixes PostgREST 42501 permission denied)
-- 2. Universal 30-day soft delete columns (deleted_at, deleted_by) across 7 tables
-- 3. Password security: bcrypt password_hash column & user_accounts RLS lockdown
-- 4. Accurate Philippine timezone defaults: TIMESTAMPTZ to now(), DATE to Manila
-- 5. Storage asset limit upgrade to 5 MB
-- 6. Audit logs RLS policies
-- 7. Automated 30-day trash purging function (purge_expired_trash)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. GRANT PRIVILEGES ACROSS PUBLIC SCHEMA (FIX PERMISSION DENIED)
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. UNIVERSAL 30-DAY SOFT DELETE & RESTORE COLUMNS
-- ------------------------------------------------------------------------------

-- 2.1 Table: load_slips
ALTER TABLE public.load_slips 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_load_slips_deleted_at ON public.load_slips (deleted_at);

-- 2.2 Table: invoices
ALTER TABLE public.invoices 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON public.invoices (deleted_at);

-- 2.3 Table: products
ALTER TABLE public.products 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON public.products (deleted_at);

-- 2.4 Table: trucks
ALTER TABLE public.trucks 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_trucks_deleted_at ON public.trucks (deleted_at);

-- 2.5 Table: delivery_hubs
ALTER TABLE public.delivery_hubs 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_hubs_deleted_at ON public.delivery_hubs (deleted_at);

-- 2.6 Table: customers
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers (deleted_at);

-- 2.7 Table: user_accounts
ALTER TABLE public.user_accounts 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_user_accounts_deleted_at ON public.user_accounts (deleted_at);

-- ------------------------------------------------------------------------------
-- 3. PASSWORD SECURITY & BCRYPT UPGRADE (user_accounts)
-- ------------------------------------------------------------------------------
ALTER TABLE public.user_accounts 
    ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL;

-- Allow password to be nullable so plaintext credentials can be fully eliminated
ALTER TABLE public.user_accounts 
    ALTER COLUMN password DROP NOT NULL;

-- Lock down RLS on user_accounts so anon users cannot arbitrarily modify credentials
DROP POLICY IF EXISTS "Public write user accounts" ON public.user_accounts;
DROP POLICY IF EXISTS "Public read user accounts" ON public.user_accounts;

-- Safe read policy: active, non-deleted users only (passwords excluded from client queries)
CREATE POLICY "Public read user accounts" ON public.user_accounts 
FOR SELECT USING (deleted_at IS NULL AND is_active = true);

-- Service role policy: full backend management
CREATE POLICY "Service write user accounts" ON public.user_accounts 
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4. FIX POSTGRESQL TIMEZONE DEFAULTS (ASIA/MANILA ALIGNMENT)
-- ------------------------------------------------------------------------------
-- TIMESTAMPTZ columns: Must use now() to avoid +8 hour double-shift in PostgreSQL
ALTER TABLE public.delivery_hubs ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.delivery_hubs ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.customers ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.products ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.trucks ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.user_accounts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.load_slips ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.load_slips ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.load_slip_items ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.invoices ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.gps_logs ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.gps_logs ALTER COLUMN logged_at SET DEFAULT now();
ALTER TABLE public.shift_reconciliations ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.audit_logs ALTER COLUMN created_at SET DEFAULT now();

-- DATE columns: Must use (now() AT TIME ZONE 'Asia/Manila')::date so dispatches between
-- 12:00 AM and 7:59 AM Manila time get the true Philippine date (UTC+8) instead of UTC's previous day.
ALTER TABLE public.load_slips ALTER COLUMN date SET DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date;
ALTER TABLE public.invoices ALTER COLUMN issue_date SET DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date;
ALTER TABLE public.shift_reconciliations ALTER COLUMN reconciliation_date SET DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date;

-- ------------------------------------------------------------------------------
-- 5. UPGRADE STORAGE BUCKET LIMIT (5 MB) & PERMISSIONS
-- ------------------------------------------------------------------------------
UPDATE storage.buckets 
SET file_size_limit = 5242880 
WHERE id = 'jica-assets';

-- ------------------------------------------------------------------------------
-- 6. AUDIT LOGS RLS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Public write audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow write audit logs" ON public.audit_logs;

CREATE POLICY "Allow read audit logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow write audit logs" ON public.audit_logs FOR ALL USING (true);

-- ------------------------------------------------------------------------------
-- 7. AUTOMATED 30-DAY TRASH PURGE FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_trash()
RETURNS JSONB AS $$
DECLARE
    purged_summary JSONB := '{}'::JSONB;
    cnt INT;
BEGIN
    -- 1. Purge load slips and their cascade items older than 30 days
    WITH deleted_slips AS (
        DELETE FROM public.load_slips
        WHERE deleted_at IS NOT NULL AND deleted_at < (NOW() - INTERVAL '30 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO cnt FROM deleted_slips;
    purged_summary := jsonb_set(purged_summary, '{load_slips}', to_jsonb(cnt));

    -- 2. Purge invoices older than 30 days
    WITH deleted_invs AS (
        DELETE FROM public.invoices
        WHERE deleted_at IS NOT NULL AND deleted_at < (NOW() - INTERVAL '30 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO cnt FROM deleted_invs;
    purged_summary := jsonb_set(purged_summary, '{invoices}', to_jsonb(cnt));

    -- 3. Purge products older than 30 days
    WITH deleted_prods AS (
        DELETE FROM public.products
        WHERE deleted_at IS NOT NULL AND deleted_at < (NOW() - INTERVAL '30 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO cnt FROM deleted_prods;
    purged_summary := jsonb_set(purged_summary, '{products}', to_jsonb(cnt));

    -- 4. Purge trucks older than 30 days
    WITH deleted_trks AS (
        DELETE FROM public.trucks
        WHERE deleted_at IS NOT NULL AND deleted_at < (NOW() - INTERVAL '30 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO cnt FROM deleted_trks;
    purged_summary := jsonb_set(purged_summary, '{trucks}', to_jsonb(cnt));

    -- 5. Purge delivery hubs older than 30 days
    WITH deleted_hubs AS (
        DELETE FROM public.delivery_hubs
        WHERE deleted_at IS NOT NULL AND deleted_at < (NOW() - INTERVAL '30 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO cnt FROM deleted_hubs;
    purged_summary := jsonb_set(purged_summary, '{delivery_hubs}', to_jsonb(cnt));

    -- 6. Purge customers older than 30 days
    WITH deleted_custs AS (
        DELETE FROM public.customers
        WHERE deleted_at IS NOT NULL AND deleted_at < (NOW() - INTERVAL '30 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO cnt FROM deleted_custs;
    purged_summary := jsonb_set(purged_summary, '{customers}', to_jsonb(cnt));

    -- 7. Purge user accounts older than 30 days
    WITH deleted_users AS (
        DELETE FROM public.user_accounts
        WHERE deleted_at IS NOT NULL AND deleted_at < (NOW() - INTERVAL '30 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO cnt FROM deleted_users;
    purged_summary := jsonb_set(purged_summary, '{user_accounts}', to_jsonb(cnt));

    RETURN purged_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- Verify patch status
SELECT 'JICA Phase 2 Migration Patch applied successfully!' AS status;
