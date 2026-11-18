import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function RestocksPage() {
  await requireAuthenticatedUser(['OWNER', 'ADMIN']);
  return (
    <ModulePageScaffold
      title="Penerimaan Barang & Restock Inventori"
      description="Pencatatan barang masuk dari supplier yang secara otomatis menambah saldo stok dan membentuk batch kedaluwarsa baru."
      phaseBadge="Phase 3 — Operations"
      allowedRoles={['OWNER', 'ADMIN']}
    />
  );
}
