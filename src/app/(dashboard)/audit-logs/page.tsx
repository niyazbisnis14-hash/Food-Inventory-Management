import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function AuditLogsPage() {
  await requireAuthenticatedUser(['OWNER']);
  return (
    <ModulePageScaffold
      title="Log Audit Keamanan & Operasional (Immutable)"
      description="Rekam jejak permanen seluruh aktivitas penting: login, perubahan produk, penyesuaian stok, restock, transaksi, dan pengaturan."
      phaseBadge="Phase 4 — Advanced Features"
      allowedRoles={['OWNER']}
    />
  );
}
