import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthenticatedUser(['OWNER', 'ADMIN', 'STAFF']);
  const { id } = await params;

  return (
    <ModulePageScaffold
      title={`Detail Transaksi (${id})`}
      description="Rincian item transaksi, batch FEFO yang digunakan, jejak audit, dan opsi Reversal Transaksi (khusus Owner/Admin)."
      phaseBadge="Phase 3 — Operations"
      allowedRoles={['OWNER', 'ADMIN', 'STAFF']}
    />
  );
}
