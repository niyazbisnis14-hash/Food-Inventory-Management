import React from 'react';
import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { hasPermission } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import {
  CategoryRecord,
  UnitRecord,
  UnitConversionRecord,
} from '@/types/database';
import { CategoriesUnitsClient } from '@/components/inventory/categories-units-client';

export default async function CategoriesPage() {
  const user = await requireAuthenticatedUser(['OWNER', 'ADMIN', 'STAFF']);
  const canManage = hasPermission(user.role_code, 'categories:manage');

  let categories: CategoryRecord[] = [];
  let units: UnitRecord[] = [];
  let conversions: UnitConversionRecord[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();

    const [catRes, unitRes, convRes] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .order('is_archived', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('units')
        .select('*')
        .order('dimension', { ascending: true })
        .order('code', { ascending: true }),
      supabase
        .from('unit_conversions')
        .select(
          `
          id,
          from_unit_id,
          to_unit_id,
          multiplier,
          from_unit:units!unit_conversions_from_unit_id_fkey(id, code, name, dimension),
          to_unit:units!unit_conversions_to_unit_id_fkey(id, code, name, dimension)
        `
        )
        .order('multiplier', { ascending: false }),
    ]);

    categories = (catRes.data ?? []) as CategoryRecord[];
    units = (unitRes.data ?? []) as UnitRecord[];
    conversions = (convRes.data ?? []) as unknown as UnitConversionRecord[];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Kategori Produk &amp; Konversi Satuan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola pengelompokan bahan pangan (Beras, Ayam, Sayuran, Bumbu, Minuman, Kemasan) dan rumus konversi satuan dasar.
        </p>
      </div>

      <CategoriesUnitsClient
        categories={categories}
        units={units}
        conversions={conversions}
        canManage={canManage}
      />
    </div>
  );
}
