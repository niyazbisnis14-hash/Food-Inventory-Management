import React from 'react';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { BatchRecord, ProductRecord, UnitRecord } from '@/types/database';
import { StockAdjustmentFormClient } from '@/components/inventory/stock-adjustment-form-client';
import { Button } from '@/components/ui/button';

export default async function InventoryAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  await requireAuthenticatedUser(['OWNER', 'ADMIN']);
  const { productId } = await searchParams;

  let products: ProductRecord[] = [];
  let units: UnitRecord[] = [];
  let batches: BatchRecord[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();

    const [prodRes, unitRes, batchRes] = await Promise.all([
      supabase
        .from('products')
        .select('*, base_unit:units(id, code, name, dimension)')
        .eq('is_archived', false)
        .order('name', { ascending: true }),
      supabase
        .from('units')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true }),
      supabase
        .from('batches')
        .select('*')
        .eq('status', 'ACTIVE')
        .gt('remaining_qty', 0)
        .order('expiration_date', { ascending: true }),
    ]);

    products = (prodRes.data ?? []) as unknown as ProductRecord[];
    units = (unitRes.data ?? []) as UnitRecord[];
    batches = (batchRes.data ?? []) as BatchRecord[];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Penyesuaian Stok &amp; Saldo Awal (Stock Adjustment)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catat stok awal, selisih stock opname, atau retur secara atomik ke dalam Inventory Ledger.
          </p>
        </div>

        <Link href="/inventory/movements">
          <Button variant="outline" size="sm">
            <ArrowLeftRight className="h-4 w-4" />
            Lihat Jurnal Mutasi (Ledger)
          </Button>
        </Link>
      </div>

      <StockAdjustmentFormClient
        products={products}
        units={units}
        batches={batches}
        initialProductId={productId}
      />
    </div>
  );
}
