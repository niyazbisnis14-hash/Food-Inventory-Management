'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import {
  forgotPasswordSchema,
  loginSchema,
  ForgotPasswordInput,
  LoginInput,
} from '@/lib/validations/auth';
import { ActionResponse } from '@/types/database';

export async function loginAction(
  input: LoginInput
): Promise<ActionResponse<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validasi kredensial gagal. Periksa kembali input Anda.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message:
        'Supabase belum dikonfigurasi pada .env.local. Salin .env.example ke .env.local dan isi NEXT_PUBLIC_SUPABASE_URL serta NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return {
      success: false,
      message: 'Email atau kata sandi salah, atau akun belum terdaftar.',
    };
  }

  // Verify active profile & record last_login_at + Audit Log
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role_code, is_active, full_name')
    .eq('id', data.user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return {
      success: false,
      message:
        'Akun Anda sedang dinonaktifkan. Hubungi Pemilik (Owner) untuk mengaktifkan kembali.',
    };
  }

  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.user.id);

  await supabase.from('audit_logs').insert({
    actor_id: data.user.id,
    actor_email: data.user.email,
    actor_role: profile.role_code,
    action: 'USER_LOGIN',
    entity_type: 'auth',
    entity_id: data.user.id,
    description: `Pengguna ${profile.full_name} (${profile.role_code}) berhasil masuk ke sistem.`,
  });

  return {
    success: true,
    message: 'Login berhasil. Mengalihkan ke Dashboard...',
    data: { redirectTo: '/dashboard' },
  };
}

export async function forgotPasswordAction(
  input: ForgotPasswordInput
): Promise<ActionResponse> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Format email tidak valid.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message:
        'Supabase belum dikonfigurasi pada .env.local. Harap lengkapi konfigurasi Supabase terlebih dahulu.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${appUrl}/login?reset=requested`,
    }
  );

  if (error) {
    return {
      success: false,
      message: 'Gagal mengirim tautan pemulihan kata sandi. Silakan coba lagi.',
    };
  }

  return {
    success: true,
    message:
      'Jika email terdaftar, tautan pengaturan ulang kata sandi telah dikirimkan ke kotak masuk Anda.',
  };
}

export async function logoutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_code, full_name')
        .eq('id', user.id)
        .single();

      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        actor_email: user.email,
        actor_role: profile?.role_code ?? null,
        action: 'USER_LOGOUT',
        entity_type: 'auth',
        entity_id: user.id,
        description: `Pengguna ${profile?.full_name ?? user.email} keluar dari sistem.`,
      });
    }

    await supabase.auth.signOut();
  }

  redirect('/login');
}
