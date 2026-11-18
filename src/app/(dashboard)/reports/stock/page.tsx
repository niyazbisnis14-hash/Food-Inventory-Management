import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function StockReportPage() {
  await requireAuthenticatedUser(['OWNER', 'ADMIN']);
  return (
    <ModulePageScaffold
      title="Laporan Posisi & Valuasi Stok"
      description="Laporan saldo stok terkini, nilai persediaan (IDR), dan filter status ketersediaan."
      phaseBadge="Phase 4 — Advanced Features"
      allowedRoles={['OWNER', 'ADMIN']}
    />
  );
}
