import React from 'react';
import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { hasPermission } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import {
  CategoryRecord,
  ProductRecord,
  UnitRecord,
} from '@/types/database';
import { ProductsCatalogClient } from '@/components/products/products-catalog-client';

export default async function ProductsPage() {
  const user = await requireAuthenticatedUser(['OWNER', 'ADMIN', 'STAFF']);
  const canManage = hasPermission(user.role_code, 'products:manage');

  let products: ProductRecord[] = [];
  let categories: CategoryRecord[] = [];
  let units: UnitRecord[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();

    const [prodRes, catRes, unitRes] = await Promise.all([
      supabase
        .from('products')
        .select(
          `
          *,
          category:categories(id, code, name, is_archived),
          base_unit:units(id, code, name, dimension, allow_decimal)
        `
        )
        .order('is_archived', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true }),
      supabase
        .from('units')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true }),
    ]);

    products = (prodRes.data ?? []) as unknown as ProductRecord[];
    categories = (catRes.data ?? []) as CategoryRecord[];
    units = (unitRes.data ?? []) as UnitRecord[];
  }

  return (
    <ProductsCatalogClient
      products={products}
      categories={categories}
      units={units}
      canManage={canManage}
    />
  );
}
