import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function NotificationsPage() {
  await requireAuthenticatedUser(['OWNER', 'ADMIN', 'STAFF']);
  return (
    <ModulePageScaffold
      title="Pusat Notifikasi & Peringatan Inventori"
      description="Peringatan stok menipis, stok habis, peringatan kedaluwarsa (30 hari, 7 hari, hari H), dan aktivitas operasional."
      phaseBadge="Phase 4 — Advanced Features"
      allowedRoles={['OWNER', 'ADMIN', 'STAFF']}
    />
  );
}
