import React from 'react';
import Link from 'next/link';
import { ArrowLeftRight, SlidersHorizontal } from 'lucide-react';
import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { hasPermission } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { StockMovementRecord } from '@/types/database';
import { formatDateTimeWIB, formatQuantity } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function InventoryMovementsPage() {
  const user = await requireAuthenticatedUser(['OWNER', 'ADMIN', 'STAFF']);
  const canAdjust = hasPermission(user.role_code, 'inventory:adjust');

  let movements: StockMovementRecord[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
      .from('stock_movements')
      .select(
        `
        *,
        product:products(id, sku, name),
        unit:units(id, code, name),
        batch:batches(id, batch_number, expiration_date),
        creator:profiles(id, full_name, role_code)
      `
      )
      .order('created_at', { ascending: false })
      .limit(100);

    movements = (data ?? []) as unknown as StockMovementRecord[];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Jurnal Mutasi Stok (Immutable Inventory Ledger)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rekam jejak permanen seluruh stok masuk dan keluar. Rumus: Stok Saat Ini = Total Masuk - Total Keluar.
          </p>
        </div>

        {canAdjust && (
          <Link href="/inventory/adjustments">
            <Button size="sm">
              <SlidersHorizontal className="h-4 w-4" />
              Catat Penyesuaian Stok
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              100 Pergerakan Stok Terakhir (Real-Time Ledger)
            </CardTitle>
          </div>
          <CardDescription>
            Dilindungi oleh database trigger PostgreSQL — baris mutasi tidak dapat diedit atau dihapus.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Waktu (WIB)</th>
                  <th className="px-4 py-3">No. Mutasi</th>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">Tipe Mutasi</th>
                  <th className="px-4 py-3 text-right">Kuantitas</th>
                  <th className="px-4 py-3 text-right">Saldo Awal</th>
                  <th className="px-4 py-3 text-right">Saldo Akhir</th>
                  <th className="px-4 py-3">Batch / Referensi / Alasan</th>
                  <th className="px-4 py-3">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Belum ada mutasi stok yang tercatat di Inventory Ledger.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => {
                    const unitCode = mov.unit?.code ?? '';
                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {formatDateTimeWIB(mov.created_at)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                          {mov.movement_number}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/products/${mov.product_id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {mov.product?.name ?? '-'}
                          </Link>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {mov.product?.sku}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              mov.direction === 'IN' ? 'success' : 'warning'
                            }
                          >
                            {mov.direction === 'IN' ? 'MASUK' : 'KELUAR'} •{' '}
                            {mov.movement_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {mov.direction === 'IN' ? '+' : '-'}
                          {formatQuantity(mov.quantity, unitCode)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                          {formatQuantity(mov.before_stock, unitCode)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold">
                          {formatQuantity(mov.after_stock, unitCode)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {mov.batch?.batch_number && (
                            <span className="mr-1.5 font-mono font-semibold text-primary">
                              [{mov.batch.batch_number}]
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {mov.reason || mov.reference_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {mov.creator?.full_name ?? '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
