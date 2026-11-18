-- ============================================================================
-- MIGRATION: 20261118000003_auth_profile_sync_trigger.sql
-- PURPOSE  : Automatically synchronize Supabase auth.users into public.profiles
--            First user in the system is automatically granted OWNER role.
--            Also backfills any existing auth.users rows missing from profiles.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_count INTEGER;
    v_assigned_role user_role_code;
    v_full_name VARCHAR(150);
BEGIN
    SELECT COUNT(*) INTO v_existing_count FROM public.profiles;

    -- Check if role was explicitly passed in raw_user_meta_data, otherwise:
    -- First user becomes OWNER, subsequent users default to STAFF
    IF NEW.raw_user_meta_data->>'role_code' IN ('OWNER', 'ADMIN', 'STAFF') THEN
        v_assigned_role := (NEW.raw_user_meta_data->>'role_code')::user_role_code;
    ELSIF v_existing_count = 0 THEN
        v_assigned_role := 'OWNER';
    ELSE
        v_assigned_role := 'STAFF';
    END IF;

    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        role_code,
        is_active
    ) VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        NEW.phone,
        v_assigned_role,
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO public.audit_logs (
        actor_id,
        actor_email,
        actor_role,
        action,
        entity_type,
        entity_id,
        description,
        new_values
    ) VALUES (
        NEW.id,
        NEW.email,
        v_assigned_role,
        'USER_PROVISIONED',
        'profiles',
        NEW.id::text,
        format('Profil pengguna %s (%s) otomatis dibuat dengan peran %s.', v_full_name, NEW.email, v_assigned_role),
        jsonb_build_object('email', NEW.email, 'role_code', v_assigned_role)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill any existing users in auth.users that do not yet have a row in public.profiles
DO $$
DECLARE
    r_user RECORD;
    v_count INTEGER;
    v_role user_role_code;
BEGIN
    FOR r_user IN
        SELECT u.*
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE p.id IS NULL
        ORDER BY u.created_at ASC
    LOOP
        SELECT COUNT(*) INTO v_count FROM public.profiles;
        IF v_count = 0 THEN
            v_role := 'OWNER';
        ELSE
            v_role := 'STAFF';
        END IF;

        INSERT INTO public.profiles (
            id,
            email,
            full_name,
            role_code,
            is_active
        ) VALUES (
            r_user.id,
            COALESCE(r_user.email, 'user-' || r_user.id::text || '@umkm.id'),
            COALESCE(
                NULLIF(trim(r_user.raw_user_meta_data->>'full_name'), ''),
                split_part(COALESCE(r_user.email, 'Owner'), '@', 1)
            ),
            v_role,
            TRUE
        )
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;
