-- ============================================================================
-- MIGRATION: 20261118000004_create_initial_admin_users.sql
-- PURPOSE  : Membuat user pertama di Supabase (auth.users + auth.identities)
--            dan menetapkan perannya di public.profiles (ADMIN & OWNER).
--            Dapat dijalankan langsung di Supabase Dashboard -> SQL Editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    v_admin_id UUID := '11111111-1111-1111-1111-111111111111';
    v_owner_id UUID := '22222222-2222-2222-2222-222222222222';
    v_admin_email TEXT := 'admin@umkm.id';
    v_owner_email TEXT := 'owner@umkm.id';
    v_default_password TEXT := 'AdminUMKM123!';
BEGIN
    -- ========================================================================
    -- 1. BUAT AKUN ADMIN PERTAMA (admin@umkm.id / AdminUMKM123!)
    -- ========================================================================
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_admin_email) THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_admin_id,
            'authenticated',
            'authenticated',
            v_admin_email,
            crypt(v_default_password, gen_salt('bf')),
            NOW(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Administrator Utama", "role_code": "ADMIN"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );

        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_admin_id,
            jsonb_build_object(
                'sub', v_admin_id::text,
                'email', v_admin_email,
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            v_admin_id::text,
            NOW(),
            NOW(),
            NOW()
        );
    ELSE
        SELECT id INTO v_admin_id FROM auth.users WHERE email = v_admin_email LIMIT 1;
        -- Pastikan password & konfirmasi email aktif
        UPDATE auth.users
        SET encrypted_password = crypt(v_default_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = v_admin_id;
    END IF;

    -- Pastikan profil Admin terdaftar dan berstatus ADMIN aktif
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role_code,
        is_active
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'Administrator Utama',
        'ADMIN',
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET role_code = 'ADMIN',
        full_name = 'Administrator Utama',
        is_active = TRUE,
        updated_at = NOW();

    -- ========================================================================
    -- 2. BUAT AKUN OWNER (owner@umkm.id / AdminUMKM123!) UNTUK AKSES PENUH
    -- ========================================================================
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_owner_email) THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_owner_id,
            'authenticated',
            'authenticated',
            v_owner_email,
            crypt(v_default_password, gen_salt('bf')),
            NOW(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Pemilik Usaha (Super Admin)", "role_code": "OWNER"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );

        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_owner_id,
            jsonb_build_object(
                'sub', v_owner_id::text,
                'email', v_owner_email,
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            v_owner_id::text,
            NOW(),
            NOW(),
            NOW()
        );
    ELSE
        SELECT id INTO v_owner_id FROM auth.users WHERE email = v_owner_email LIMIT 1;
        UPDATE auth.users
        SET encrypted_password = crypt(v_default_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = v_owner_id;
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role_code,
        is_active
    ) VALUES (
        v_owner_id,
        v_owner_email,
        'Pemilik Usaha (Super Admin)',
        'OWNER',
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET role_code = 'OWNER',
        full_name = 'Pemilik Usaha (Super Admin)',
        is_active = TRUE,
        updated_at = NOW();
END $$;
