import { createClient as createUtilsServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getServerSupabaseConfig } from '@/lib/env';

/**
 * Server-side Supabase client bound to the user's cookies & Row Level Security (RLS).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createUtilsServerClient(cookieStore);
}

/**
 * Strictly Server-Only Admin Client using SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).
 * NEVER import this file in Client Components!
 */
export function createSupabaseServiceRoleClient() {
  const { url, secretKey } = getServerSupabaseConfig();

  if (
    !secretKey ||
    secretKey.includes('your-supabase-service-role') ||
    secretKey.includes('REPLACE_WITH_YOUR_FULL_SECRET_KEY') ||
    secretKey.includes('••••')
  ) {
    throw new Error(
      'SUPABASE_SECRET_KEY (atau SUPABASE_SERVICE_ROLE_KEY) belum diisi secara utuh pada .env.local.'
    );
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
