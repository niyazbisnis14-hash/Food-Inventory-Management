import React from 'react';
import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';

export default async function DashboardProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthenticatedUser();
  const configured = isSupabaseConfigured();

  let unreadCount = 0;
  if (configured) {
    const supabase = await createSupabaseServerClient();
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);

    unreadCount = count ?? 0;
  }

  return (
    <AppShell
      user={user}
      unreadNotificationsCount={unreadCount}
      supabaseConfigured={configured}
    >
      {children}
    </AppShell>
  );
}
