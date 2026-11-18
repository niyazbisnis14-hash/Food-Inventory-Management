import React from 'react';
import Link from 'next/link';
import {
  Boxes,
  SlidersHorizontal,
  ArrowLeftRight,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react';
import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { hasPermission } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { BatchRecord, ProductRecord } from '@/types/database';
import {
  formatDateTimeWIB,
  formatQuantity,
  formatRupiah,
} from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function InventoryOverviewPage() {
  const user = await requireAuthenticatedUser(['OWNER', 'ADMIN', 'STAFF']);
  const canAdjust = hasPermission(user.role_code, 'inventory:adjust');

  let products: ProductRecord[] = [];
  let activeBatches: BatchRecord[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();

    const [prodRes, batchRes] = await Promise.all([
      supabase
        .from('products')
        .select(
          `
          *,
          category:categories(id, code, name),
          base_unit:units(id, code, name)
        `
        )
        .eq('is_archived', false)
        .order('current_stock', { ascending: true }),
      supabase
        .from('batches')
        .select(
          `
          *,
          product:products(id, sku, name, base_unit:units(code))
        `
        )
        .gt('remaining_qty', 0)
        .order('expiration_date', { ascending: true, nullsFirst: false })
        .order('received_date', { ascending: true })
        .limit(50),
    ]);

    products = (prodRes.data ?? []) as unknown as ProductRecord[];
    activeBatches = (batchRes.data ?? []) as unknown as BatchRecord[];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Status Inventori &amp; Manajemen Batch (FEFO)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sumber kebenaran stok berbasis Inventory Ledger dan prioritas penggunaan batch First Expired, First Out.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/inventory/movements">
            <Button variant="outline" size="sm">
              <ArrowLeftRight className="h-4 w-4" />
              Jurnal Mutasi (Ledger)
            </Button>
          </Link>
          {canAdjust && (
            <Link href="/inventory/adjustments">
              <Button size="sm">
                <SlidersHorizontal className="h-4 w-4" />
                Buat Penyesuaian Stok
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Section 1: FEFO Batch Allocation Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              Antrean Batch Aktif Berdasarkan Prioritas FEFO (First Expired, First Out)
            </CardTitle>
          </div>
          <CardDescription>
            Batch diurutkan dari tanggal kedaluwarsa terdekat. Batch yang sudah kedaluwarsa otomatis diblokir dari transaksi penjualan/pemakaian normal.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Prioritas</th>
                  <th className="px-4 py-3">Nomor Batch</th>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">Tgl Diterima</th>
                  <th className="px-4 py-3">Tgl Kedaluwarsa</th>
                  <th className="px-4 py-3 text-right">Sisa Stok Batch</th>
                  <th className="px-4 py-3 text-right">Harga Pokok</th>
                  <th className="px-4 py-3">Status Umur Simpan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeBatches.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      Belum ada batch aktif dengan sisa stok &gt; 0. Tambahkan melalui Stok Awal / Penyesuaian atau Restock.
                    </td>
                  </tr>
                ) : (
                  activeBatches.map((batch, index) => {
                    const expDate = batch.expiration_date
                      ? new Date(batch.expiration_date)
                      : null;
                    let daysLeft: number | null = null;
                    if (expDate) {
                      daysLeft = Math.ceil(
                        (expDate.getTime() - today.getTime()) /
                          (1000 * 60 * 60 * 24)
                      );
                    }

                    let expiryBadge = (
                      <Badge variant="outline">Non-Expired</Badge>
                    );
                    if (daysLeft !== null) {
                      if (daysLeft < 0) {
                        expiryBadge = (
                          <Badge variant="destructive">
                            Kedaluwarsa ({Math.abs(daysLeft)} hari lalu)
                          </Badge>
                        );
                      } else if (daysLeft <= 7) {
                        expiryBadge = (
                          <Badge variant="destructive">
                            Kritis: {daysLeft} hari lagi
                          </Badge>
                        );
                      } else if (daysLeft <= 30) {
                        expiryBadge = (
                          <Badge variant="warning">
                            Peringatan: {daysLeft} hari lagi
                          </Badge>
                        );
                      } else {
                        expiryBadge = (
                          <Badge variant="success">Aman ({daysLeft} hari)</Badge>
                        );
                      }
                    }

                    const unitCode =
                      (
                        batch.product as unknown as {
                          base_unit?: { code?: string };
                        }
                      )?.base_unit?.code ?? '';

                    return (
                      <tr key={batch.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500">
                          #{index + 1}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                          {batch.batch_number}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/products/${batch.product_id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {batch.product?.name ?? '-'}
                          </Link>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {batch.product?.sku}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {formatDateTimeWIB(batch.received_date, false)}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium">
                          {batch.expiration_date
                            ? formatDateTimeWIB(batch.expiration_date, false)
                            : 'Tanpa Kedaluwarsa'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {formatQuantity(batch.remaining_qty, unitCode)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          {formatRupiah(batch.unit_cost)}
                        </td>
                        <td className="px-4 py-3">{expiryBadge}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Product Stock Balance Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              Ringkasan Saldo Stok per Produk (Urutan Stok Terendah)
            </CardTitle>
          </div>
          <CardDescription>
            Menampilkan perbandingan antara Stok Saat Ini (Ledger) dan Batas Stok Minimum.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Nama Produk</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3 text-right">Batas Minimum</th>
                  <th className="px-4 py-3 text-right">Saldo Stok (Ledger)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Belum ada produk aktif.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const stock = Number(p.current_stock ?? 0);
                    const min = Number(p.min_stock ?? 0);
                    const unitCode = p.base_unit?.code ?? '';

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                          {p.sku}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={`/products/${p.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {p.category?.name ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {formatQuantity(min, unitCode)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {formatQuantity(stock, unitCode)}
                        </td>
                        <td className="px-4 py-3">
                          {stock <= 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Habis
                            </span>
                          ) : stock <= min ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Menipis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Aman
                            </span>
                          )}
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
