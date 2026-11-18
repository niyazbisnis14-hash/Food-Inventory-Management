import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function ExpirationReportPage() {
  await requireAuthenticatedUser(['OWNER', 'ADMIN']);
  return (
    <ModulePageScaffold
      title="Laporan Batch & Tanggal Kedaluwarsa"
      description="Analisis umur simpan bahan baku, peringatan H-30, H-7, dan produk kedaluwarsa."
      phaseBadge="Phase 4 — Advanced Features"
      allowedRoles={['OWNER', 'ADMIN']}
    />
  );
}
