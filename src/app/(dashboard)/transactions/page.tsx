import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function TransactionsPage() {
  await requireAuthenticatedUser(['OWNER', 'ADMIN', 'STAFF']);
  return (
    <ModulePageScaffold
      title="Transaksi Keluar (Penjualan, Pemakaian Internal & Kerusakan)"
      description="Pemrosesan transaksi keluar secara atomik dengan alokasi batch FEFO otomatis dan dukungan pemindaian barcode."
      phaseBadge="Phase 3 — Operations"
      allowedRoles={['OWNER', 'ADMIN', 'STAFF']}
    />
  );
}
