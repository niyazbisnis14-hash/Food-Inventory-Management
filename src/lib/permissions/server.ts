import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { hasPermission, PermissionKey } from '@/lib/permissions';
import { UserProfile, UserRoleCode } from '@/types/database';

/**
 * Retrieves the currently authenticated active user profile from Supabase.
 * When Supabase environment variables are not yet configured locally, returns a
 * clearly labeled Setup/Preview Owner profile so the UI layout remains inspectable.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'owner@umkm-pangan.id',
      full_name: 'Mode Konfigurasi Awal (Owner)',
      phone: '081234567890',
      role_code: 'OWNER',
      is_active: true,
      last_login_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  if (!profile) {
    return null;
  }

  return profile as UserProfile;
}

/**
 * Server Guard: Requires an authenticated active user and optionally checks allowed roles.
 */
export async function requireAuthenticatedUser(
  allowedRoles?: UserRoleCode[]
): Promise<UserProfile> {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/login');
  }

  if (allowedRoles && !allowedRoles.includes(profile.role_code)) {
    redirect('/dashboard?error=akses_ditolak');
  }

  return profile;
}

/**
 * Server Action Guard: Verifies permission and throws structured Bahasa Indonesia error if unauthorized.
 */
export async function assertServerPermission(
  permission: PermissionKey
): Promise<UserProfile> {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
  }

  if (!hasPermission(profile.role_code, permission)) {
    throw new Error(
      `Akses ditolak: Peran Anda (${profile.role_code}) tidak memiliki izin untuk melakukan operasi ini.`
    );
  }

  return profile;
}
