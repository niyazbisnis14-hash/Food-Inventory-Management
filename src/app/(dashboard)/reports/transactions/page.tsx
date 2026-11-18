import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function TransactionsReportPage() {
  await requireAuthenticatedUser(['OWNER', 'ADMIN']);
  return (
    <ModulePageScaffold
      title="Laporan Transaksi Operasional"
      description="Rekapitulasi transaksi penjualan, pemakaian dapur, dan barang rusak."
      phaseBadge="Phase 4 — Advanced Features"
      allowedRoles={['OWNER', 'ADMIN']}
    />
  );
}
