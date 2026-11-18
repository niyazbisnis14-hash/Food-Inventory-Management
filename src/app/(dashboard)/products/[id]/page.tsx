import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Boxes,
  ArrowLeftRight,
  SlidersHorizontal,
  CalendarClock,
} from 'lucide-react';
import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { hasPermission } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import {
  BatchRecord,
  ProductRecord,
  StockMovementRecord,
} from '@/types/database';
import {
  formatDateTimeWIB,
  formatQuantity,
  formatRupiah,
} from '@/lib/utils';
import { PRODUCT_TYPE_LABELS } from '@/components/products/products-catalog-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuthenticatedUser(['OWNER', 'ADMIN', 'STAFF']);
  const canAdjust = hasPermission(user.role_code, 'inventory:adjust');
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <Link href="/products">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Katalog Produk
          </Button>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Detail Produk ({id})</CardTitle>
            <CardDescription>
              Hubungkan database Supabase untuk memuat rincian batch dan ledger produk.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();

  const [prodRes, batchesRes, movementsRes] = await Promise.all([
    supabase
      .from('products')
      .select(
        `
        *,
        category:categories(id, code, name),
        base_unit:units(id, code, name)
      `
      )
      .eq('id', id)
      .single(),
    supabase
      .from('batches')
      .select('*')
      .eq('product_id', id)
      .order('expiration_date', { ascending: true, nullsFirst: false })
      .order('received_date', { ascending: true }),
    supabase
      .from('stock_movements')
      .select(
        `
        *,
        unit:units(id, code, name),
        batch:batches(id, batch_number, expiration_date),
        creator:profiles(id, full_name, role_code)
      `
      )
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  if (!prodRes.data) {
    notFound();
  }

  const product = prodRes.data as unknown as ProductRecord;
  const batches = (batchesRes.data ?? []) as BatchRecord[];
  const movements = (movementsRes.data ?? []) as unknown as StockMovementRecord[];
  const unitCode = product.base_unit?.code ?? '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Katalog Produk
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">
              {product.name}
            </h1>
            <Badge variant="outline" className="font-mono">
              {product.sku}
            </Badge>
            {product.is_archived ? (
              <Badge variant="secondary">Diarsipkan</Badge>
            ) : (
              <Badge variant="success">Aktif</Badge>
            )}
          </div>
        </div>

        {canAdjust && (
          <Link href={`/inventory/adjustments?productId=${product.id}`}>
            <Button size="sm">
              <SlidersHorizontal className="h-4 w-4" />
              Sesuaikan Stok Produk Ini
            </Button>
          </Link>
        )}
      </div>

      {/* Product Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Saldo Stok Saat Ini (Ledger)</CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">
              {formatQuantity(product.current_stock, unitCode)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Batas Minimum: {formatQuantity(product.min_stock, unitCode)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Kategori &amp; Tipe</CardDescription>
            <CardTitle className="text-base">
              {product.category?.name ?? '-'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {PRODUCT_TYPE_LABELS[product.product_type]}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Harga Beli Standar</CardDescription>
            <CardTitle className="text-lg">
              {formatRupiah(product.purchase_price)} / {unitCode}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Harga Jual: {formatRupiah(product.selling_price)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Barcode &amp; Pelacakan FEFO</CardDescription>
            <CardTitle className="font-mono text-base">
              {product.barcode || 'Tanpa Barcode'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pelacakan Kedaluwarsa: {product.track_expiration ? 'Aktif (FEFO)' : 'Nonaktif'}
          </CardContent>
        </Card>
      </div>

      {/* Active Batches (FEFO Order) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              Daftar Batch &amp; Urutan Prioritas FEFO (First Expired, First Out)
            </CardTitle>
          </div>
          <CardDescription>
            Saat terjadi transaksi keluar, sistem otomatis memotong batch dengan tanggal kedaluwarsa paling dekat.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">No. Batch</th>
                  <th className="px-4 py-3">Tgl Diterima</th>
                  <th className="px-4 py-3">Tgl Kedaluwarsa</th>
                  <th className="px-4 py-3 text-right">Qty Awal</th>
                  <th className="px-4 py-3 text-right">Sisa Qty</th>
                  <th className="px-4 py-3 text-right">Harga Pokok</th>
                  <th className="px-4 py-3">Status Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {batches.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Belum ada batch tercatat untuk produk ini.
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-bold">
                        {b.batch_number}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {formatDateTimeWIB(b.received_date, false)}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">
                        {b.expiration_date ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
                            {formatDateTimeWIB(b.expiration_date, false)}
                          </span>
                        ) : (
                          'Tanpa Kedaluwarsa'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {formatQuantity(b.received_qty, unitCode)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold">
                        {formatQuantity(b.remaining_qty, unitCode)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        {formatRupiah(b.unit_cost)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            b.status === 'ACTIVE'
                              ? 'success'
                              : b.status === 'EXPIRED'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {b.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Product Stock Movement History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              Riwayat Mutasi Ledger Produk Ini (25 Terakhir)
            </CardTitle>
          </div>
          <CardDescription>
            Setiap perubahan stok tercatat secara permanen beserta saldo sebelum dan sesudah.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Waktu (WIB)</th>
                  <th className="px-4 py-3">No. Mutasi</th>
                  <th className="px-4 py-3">Tipe &amp; Arah</th>
                  <th className="px-4 py-3 text-right">Kuantitas</th>
                  <th className="px-4 py-3 text-right">Stok Sebelum</th>
                  <th className="px-4 py-3 text-right">Stok Sesudah</th>
                  <th className="px-4 py-3">Batch / Alasan</th>
                  <th className="px-4 py-3">Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Belum ada riwayat mutasi stok untuk produk ini.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {formatDateTimeWIB(mov.created_at)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        {mov.movement_number}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            mov.direction === 'IN' ? 'success' : 'warning'
                          }
                        >
                          {mov.direction === 'IN' ? '+' : '-'} {mov.movement_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {mov.direction === 'IN' ? '+' : '-'}
                        {formatQuantity(mov.quantity, unitCode)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                        {formatQuantity(mov.before_stock, unitCode)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
