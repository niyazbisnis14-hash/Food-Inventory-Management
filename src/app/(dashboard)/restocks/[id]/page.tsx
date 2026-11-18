import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function RestockDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthenticatedUser(['OWNER', 'ADMIN']);
  const { id } = await params;

  return (
    <ModulePageScaffold
      title={`Detail Dokumen Restock (${id})`}
      description="Rincian penerimaan barang, nomor batch, tanggal kedaluwarsa, harga beli per unit, dan mutasi stok terkait."
      phaseBadge="Phase 3 — Operations"
      allowedRoles={['OWNER', 'ADMIN']}
    />
  );
}
