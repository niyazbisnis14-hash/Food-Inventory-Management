import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function UsersManagementPage() {
  await requireAuthenticatedUser(['OWNER']);
  return (
    <ModulePageScaffold
      title="Manajemen Pengguna & Hak Akses (RBAC)"
      description="Kelola akun Owner, Admin, dan Staf beserta status keaktifan pengguna."
      phaseBadge="Phase 4 — Advanced Features"
      allowedRoles={['OWNER']}
    />
  );
}
