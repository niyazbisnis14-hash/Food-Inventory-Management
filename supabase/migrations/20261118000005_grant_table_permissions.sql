-- ============================================================================
-- MIGRATION: 20261118000005_grant_table_permissions.sql
-- PURPOSE  : Memberikan izin (GRANT) skema public, tabel, dan fungsi RPC
--            kepada role Supabase `authenticated` dan `service_role`.
--            Tanpa ini, query dari aplikasi akan ditolak dengan kode 42501.
-- ============================================================================

-- 1. Berikan hak akses penggunaan skema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Berikan hak akses tabel di skema public (tetap dilindungi oleh RLS Policies!)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- 3. Pastikan tabel dan fungsi yang dibuat di masa mendatang otomatis mendapat GRANT
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- 4. Pastikan akun admin@umkm.id dan owner@umkm.id berstatus aktif di public.profiles
UPDATE public.profiles
SET role_code = 'OWNER',
    is_active = TRUE
WHERE email = 'owner@umkm.id';

UPDATE public.profiles
SET role_code = 'ADMIN',
    is_active = TRUE
WHERE email = 'admin@umkm.id';
