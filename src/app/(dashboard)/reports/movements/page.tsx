import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function MovementsReportPage() {
  await requireAuthenticatedUser(['OWNER', 'ADMIN']);
  return (
    <ModulePageScaffold
      title="Laporan Mutasi Stok (Ledger Report)"
      description="Laporan historis seluruh mutasi masuk dan keluar dengan ekspor Excel dan PDF."
      phaseBadge="Phase 4 — Advanced Features"
      allowedRoles={['OWNER', 'ADMIN']}
    />
  );
}
