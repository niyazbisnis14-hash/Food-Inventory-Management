import Link from 'next/link';
import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function ReportsHubPage() {
  await requireAuthenticatedUser(['OWNER', 'ADMIN']);

  const subReports = [
    {
      title: 'Laporan Posisi Stok',
      href: '/reports/stock',
      desc: 'Valuasi stok saat ini, status stok menipis/habis, dan rincian per kategori.',
    },
    {
      title: 'Laporan Mutasi Inventori (Ledger)',
      href: '/reports/movements',
      desc: 'Rincian seluruh pergerakan stok masuk dan keluar berdasarkan periode dan tipe mutasi.',
    },
    {
      title: 'Laporan Transaksi Keluar',
      href: '/reports/transactions',
      desc: 'Rekapitulasi penjualan, pemakaian internal dapur, dan barang rusak.',
    },
    {
      title: 'Laporan Batch & Kedaluwarsa',
      href: '/reports/expiration',
      desc: 'Pemantauan batch mendekati kedaluwarsa (30 hari, 7 hari) dan batch kadaluarsa.',
    },
  ];

  return (
    <ModulePageScaffold
      title="Pusat Laporan & Ekspor Data (Excel / PDF)"
      description="Laporan komprehensif inventori pangan dengan filter rentang tanggal, kategori, supplier, dan pengguna."
      phaseBadge="Phase 4 — Advanced Features"
      allowedRoles={['OWNER', 'ADMIN']}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {subReports.map((rep) => (
          <Link key={rep.href} href={rep.href}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/40">
              <CardHeader>
                <CardTitle className="text-base">{rep.title}</CardTitle>
                <CardDescription>{rep.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </ModulePageScaffold>
  );
}
