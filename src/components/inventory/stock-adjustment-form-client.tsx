'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  SlidersHorizontal,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BatchRecord,
  ProductRecord,
  StockMovementType,
  UnitRecord,
} from '@/types/database';
import { recordStockAdjustmentAction } from '@/services/inventory.actions';
import { formatQuantity } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const ADJUSTMENT_TYPES: Array<{
  value: Extract<
    StockMovementType,
    | 'INITIAL_STOCK'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT'
    | 'RETURN_IN'
    | 'RETURN_OUT'
  >;
  label: string;
  direction: 'IN' | 'OUT';
}> = [
  {
    value: 'INITIAL_STOCK',
    label: 'Stok Awal (Initial Stock — Menambah Stok + Buat Batch)',
    direction: 'IN',
  },
  {
    value: 'ADJUSTMENT_IN',
    label: 'Penyesuaian Masuk (Stock Opname Lebih / +)',
    direction: 'IN',
  },
  {
    value: 'ADJUSTMENT_OUT',
    label: 'Penyesuaian Keluar (Stock Opname Kurang / Susut / -)',
    direction: 'OUT',
  },
  {
    value: 'RETURN_IN',
    label: 'Retur Masuk (Pengembalian ke Gudang / +)',
    direction: 'IN',
  },
  {
    value: 'RETURN_OUT',
    label: 'Retur Keluar (Pengembalian ke Supplier / -)',
    direction: 'OUT',
  },
];

interface StockAdjustmentFormClientProps {
  products: ProductRecord[];
  units: UnitRecord[];
  batches: BatchRecord[];
  initialProductId?: string;
}

export function StockAdjustmentFormClient({
  products,
  units,
  batches,
  initialProductId,
}: StockAdjustmentFormClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [productId, setProductId] = useState(
    initialProductId || products[0]?.id || ''
  );
  const [movementType, setMovementType] = useState<
    | 'INITIAL_STOCK'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT'
    | 'RETURN_IN'
    | 'RETURN_OUT'
  >('INITIAL_STOCK');
  const [quantity, setQuantity] = useState('');
  const [inputUnitId, setInputUnitId] = useState('');
  const [reason, setReason] = useState('');
  const [batchId, setBatchId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  // Sync default unit to selected product's base_unit_id
  React.useEffect(() => {
    if (selectedProduct) {
      setInputUnitId(selectedProduct.base_unit_id);
      setUnitCost(String(selectedProduct.purchase_price ?? 0));
      setBatchId('');
    }
  }, [selectedProduct]);

  const productBatches = useMemo(
    () =>
      batches.filter(
        (b) => b.product_id === productId && b.status === 'ACTIVE'
      ),
    [batches, productId]
  );

  const isInbound = ['INITIAL_STOCK', 'ADJUSTMENT_IN', 'RETURN_IN'].includes(
    movementType
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordStockAdjustmentAction({
        product_id: productId,
        movement_type: movementType,
        quantity: Number(quantity),
        input_unit_id: inputUnitId || selectedProduct?.base_unit_id || '',
        reason,
        batch_id: batchId || '',
        batch_number: batchNumber,
        expiration_date: expirationDate,
        unit_cost: unitCost ? Number(unitCost) : undefined,
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setQuantity('');
      setReason('');
      setBatchNumber('');
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              Formulir Mutasi &amp; Penyesuaian Stok (Atomic RPC)
            </CardTitle>
          </div>
          <CardDescription>
            Setiap penyesuaian wajib menyertakan alasan yang sah dan akan tercatat permanen di dalam Inventory Ledger serta Audit Log.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="productId">Pilih Produk / Bahan Baku *</Label>
                <select
                  id="productId"
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  required
                  disabled={isPending}
                >
                  <option value="">-- Pilih Produk --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Stok: {p.current_stock}{' '}
                      {p.base_unit?.code ?? ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="movementType">Tipe Penyesuaian *</Label>
                <select
                  id="movementType"
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                  value={movementType}
                  onChange={(e) =>
                    setMovementType(
                      e.target.value as typeof movementType
                    )
                  }
                  disabled={isPending}
                >
                  {ADJUSTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quantity">Kuantitas Mutasi *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  placeholder="Contoh: 25"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inputUnitId">
                  Satuan Input (Otomatis Dikonversi ke Satuan Dasar) *
                </Label>
                <select
                  id="inputUnitId"
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                  value={inputUnitId}
                  onChange={(e) => setInputUnitId(e.target.value)}
                  required
                  disabled={isPending}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code}) [{u.dimension}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Batch Fields */}
            {isInbound ? (
              <div className="grid gap-4 rounded-md border bg-slate-50/70 p-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="batchNumber">
                    Nomor Batch Baru (Opsional, Otomatis jika kosong)
                  </Label>
                  <Input
                    id="batchNumber"
                    placeholder="Contoh: BATCH-202611-01"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expirationDate">Tanggal Kedaluwarsa</Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unitCost">Harga Pokok per Satuan Dasar (IDR)</Label>
                  <Input
                    id="unitCost"
                    type="number"
                    min="0"
                    step="100"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 rounded-md border bg-amber-50/60 p-4">
                <Label htmlFor="batchId">
                  Pilih Batch yang Dikurangi (Opsional)
                </Label>
                <select
                  id="batchId"
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  disabled={isPending}
                >
                  <option value="">
                    -- Kurangi Saldo Produk Tanpa Spesifik Batch --
                  </option>
                  {productBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number} — Sisa: {b.remaining_qty} (Exp:{' '}
                      {b.expiration_date ?? 'Non-Exp'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="reason">
                Alasan Penyesuaian Stok (Wajib Diisi Minimal 5 Karakter) *
              </Label>
              <Input
                id="reason"
                placeholder="Contoh: Saldo awal pembukaan gudang / Selisih stock opname mingguan dapur"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={5}
                disabled={isPending}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isPending || !productId}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Konfirmasi &amp; Catat ke Inventory Ledger
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Selected Product Live Info Panel */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Ringkasan Produk Terpilih</CardTitle>
          <CardDescription>
            Validasi stok negatif aktif di tingkat transaksi PostgreSQL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {selectedProduct ? (
            <>
              <div className="rounded-md border bg-slate-50 p-3.5">
                <p className="text-xs text-muted-foreground">Nama Produk</p>
                <p className="font-semibold">{selectedProduct.name}</p>
                <p className="font-mono text-xs text-primary">
                  SKU: {selectedProduct.sku}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Stok Saat Ini
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold">
                    {formatQuantity(
                      selectedProduct.current_stock,
                      selectedProduct.base_unit?.code
                    )}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Stok Minimum
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-muted-foreground">
                    {formatQuantity(
                      selectedProduct.min_stock,
                      selectedProduct.base_unit?.code
                    )}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Pilih produk terlebih dahulu untuk melihat posisi stok saat ini.
            </p>
          )}

          <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <strong>Aturan Ledger Ketat:</strong> Sistem menolak pengurangan
              stok apabila kuantitas keluar melebihi saldo stok tersedia (mencegah
              stok negatif).
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
