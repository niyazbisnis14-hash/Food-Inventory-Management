import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function SuppliersPage() {
  await requireAuthenticatedUser(['OWNER', 'ADMIN']);
  return (
    <ModulePageScaffold
      title="Manajemen Data Supplier & Pemasok"
      description="Daftar pemasok bahan baku dan kemasan beserta kontak, alamat, dan riwayat penerimaan restock."
      phaseBadge="Phase 3 — Operations"
      allowedRoles={['OWNER', 'ADMIN']}
    />
  );
}
