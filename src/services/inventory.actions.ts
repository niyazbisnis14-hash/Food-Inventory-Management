'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertServerPermission } from '@/lib/permissions/server';
import {
  categorySchema,
  unitSchema,
  unitConversionSchema,
  productSchema,
  stockAdjustmentSchema,
  CategoryInput,
  UnitInput,
  UnitConversionInput,
  ProductInput,
  StockAdjustmentInput,
} from '@/lib/validations/inventory';
import { ActionResponse } from '@/types/database';

// ============================================================================
// 1. CATEGORIES SERVER ACTIONS
// ============================================================================

export async function createCategoryAction(
  input: CategoryInput
): Promise<ActionResponse> {
  try {
    const actor = await assertServerPermission('categories:manage');
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Validasi kategori gagal. Periksa kembali input Anda.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('categories')
      .insert({
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description || null,
        created_by: actor.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          message: 'Kode atau nama kategori sudah terdaftar. Gunakan kode/nama unik.',
        };
      }
      return { success: false, message: `Gagal menyimpan kategori: ${error.message}` };
    }

    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role_code,
      action: 'CATEGORY_CREATED',
      entity_type: 'categories',
      entity_id: data.id,
      description: `Menambahkan kategori baru: ${data.name} (${data.code})`,
      new_values: data,
    });

    revalidatePath('/categories');
    revalidatePath('/products');
    return {
      success: true,
      message: `Kategori "${data.name}" berhasil ditambahkan.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
    };
  }
}

export async function updateCategoryAction(
  id: string,
  input: CategoryInput
): Promise<ActionResponse> {
  try {
    const actor = await assertServerPermission('categories:manage');
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Validasi kategori gagal.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();

    const { data: oldRow } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('categories')
      .update({
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          message: 'Kode atau nama kategori sudah digunakan oleh kategori lain.',
        };
      }
      return { success: false, message: `Gagal memperbarui kategori: ${error.message}` };
    }

    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role_code,
      action: 'CATEGORY_UPDATED',
      entity_type: 'categories',
      entity_id: id,
      description: `Memperbarui kategori: ${data.name} (${data.code})`,
      old_values: oldRow,
      new_values: data,
    });

    revalidatePath('/categories');
    revalidatePath('/products');
    return {
      success: true,
      message: `Kategori "${data.name}" berhasil diperbarui.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
    };
  }
}

export async function toggleArchiveCategoryAction(
  id: string,
  archive: boolean
): Promise<ActionResponse> {
  try {
    const actor = await assertServerPermission('categories:manage');
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('categories')
      .update({ is_archived: archive })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        message: `Gagal mengubah status arsip kategori: ${error.message}`,
      };
    }

    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role_code,
      action: archive ? 'CATEGORY_ARCHIVED' : 'CATEGORY_RESTORED',
      entity_type: 'categories',
      entity_id: id,
      description: `${archive ? 'Mengarsipkan' : 'Mengaktifkan kembali'} kategori ${data.name}`,
    });

    revalidatePath('/categories');
    revalidatePath('/products');
    return {
      success: true,
      message: `Kategori "${data.name}" berhasil ${archive ? 'diarsipkan' : 'diaktifkan kembali'}.`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
    };
  }
}

// ============================================================================
// 2. UNITS & UNIT CONVERSIONS SERVER ACTIONS
// ============================================================================

export async function createUnitAction(
  input: UnitInput
): Promise<ActionResponse> {
  try {
    const actor = await assertServerPermission('units:manage');
    const parsed = unitSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Validasi satuan gagal.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('units')
      .insert({
        code: parsed.data.code,
        name: parsed.data.name,
        dimension: parsed.data.dimension,
        allow_decimal: parsed.data.allow_decimal,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          message: 'Simbol atau nama satuan sudah terdaftar.',
        };
      }
      return { success: false, message: `Gagal menyimpan satuan: ${error.message}` };
    }

    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role_code,
      action: 'UNIT_CREATED',
      entity_type: 'units',
      entity_id: data.id,
      description: `Menambahkan satuan baru: ${data.name} (${data.code})`,
      new_values: data,
    });

    revalidatePath('/categories');
    revalidatePath('/products');
    return {
      success: true,
      message: `Satuan "${data.name} (${data.code})" berhasil ditambahkan.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
    };
  }
}

export async function upsertUnitConversionAction(
  input: UnitConversionInput
): Promise<ActionResponse> {
  try {
    const actor = await assertServerPermission('units:manage');
    const parsed = unitConversionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Validasi konversi satuan gagal.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();

    // Verify compatible unit dimensions before inserting
    const { data: unitsData } = await supabase
      .from('units')
      .select('id, code, name, dimension')
      .in('id', [parsed.data.from_unit_id, parsed.data.to_unit_id]);

    const fromUnit = unitsData?.find((u) => u.id === parsed.data.from_unit_id);
    const toUnit = unitsData?.find((u) => u.id === parsed.data.to_unit_id);

    if (!fromUnit || !toUnit) {
      return {
        success: false,
        message: 'Satuan asal atau satuan tujuan tidak ditemukan.',
      };
    }

    if (fromUnit.dimension !== toUnit.dimension) {
      return {
        success: false,
        message: `Konversi tidak kompatibel: ${fromUnit.name} (${fromUnit.dimension}) tidak dapat dikonversi ke ${toUnit.name} (${toUnit.dimension}).`,
      };
    }

    const { data, error } = await supabase
      .from('unit_conversions')
      .upsert(
        {
          from_unit_id: parsed.data.from_unit_id,
          to_unit_id: parsed.data.to_unit_id,
          multiplier: parsed.data.multiplier,
        },
        { onConflict: 'from_unit_id,to_unit_id' }
      )
      .select()
      .single();

    if (error) {
      return {
        success: false,
        message: `Gagal menyimpan konversi satuan: ${error.message}`,
      };
    }

    // Automatically upsert the inverse conversion so conversions work bidirectionally
    const inverseMultiplier = Number((1 / parsed.data.multiplier).toFixed(6));
    if (inverseMultiplier > 0) {
      await supabase.from('unit_conversions').upsert(
        {
          from_unit_id: parsed.data.to_unit_id,
          to_unit_id: parsed.data.from_unit_id,
          multiplier: inverseMultiplier,
        },
        { onConflict: 'from_unit_id,to_unit_id' }
      );
    }

    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role_code,
      action: 'UNIT_CONVERSION_UPSERTED',
      entity_type: 'unit_conversions',
      entity_id: data.id,
      description: `Mengatur konversi: 1 ${fromUnit.code} = ${parsed.data.multiplier} ${toUnit.code}`,
      new_values: data,
    });

    revalidatePath('/categories');
    return {
      success: true,
      message: `Konversi 1 ${fromUnit.code} = ${parsed.data.multiplier} ${toUnit.code} berhasil disimpan.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
    };
  }
}

// ============================================================================
// 3. PRODUCTS SERVER ACTIONS (Read-Only Stock Enforced)
// ============================================================================

export async function createProductAction(
  input: ProductInput
): Promise<ActionResponse> {
  try {
    const actor = await assertServerPermission('products:manage');
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Validasi data produk gagal. Periksa kembali form Anda.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('products')
      .insert({
        sku: parsed.data.sku,
        barcode: parsed.data.barcode ? parsed.data.barcode.trim() : null,
        name: parsed.data.name,
        category_id: parsed.data.category_id,
        product_type: parsed.data.product_type,
        base_unit_id: parsed.data.base_unit_id,
        purchase_price: parsed.data.purchase_price,
        selling_price: parsed.data.selling_price,
        min_stock: parsed.data.min_stock,
        track_expiration: parsed.data.track_expiration,
        description: parsed.data.description || null,
        image_url: parsed.data.image_url || null,
        is_active: parsed.data.is_active,
        created_by: actor.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          message:
            'SKU atau Barcode sudah digunakan oleh produk lain. SKU dan Barcode wajib unik.',
        };
      }
      return { success: false, message: `Gagal menyimpan produk: ${error.message}` };
    }

    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role_code,
      action: 'PRODUCT_CREATED',
      entity_type: 'products',
      entity_id: data.id,
      description: `Membuat produk baru: ${data.name} (SKU: ${data.sku})`,
      new_values: data,
    });

    revalidatePath('/products');
    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return {
      success: true,
      message: `Produk "${data.name}" (${data.sku}) berhasil dibuat. Gunakan Penyesuaian Stok atau Restock untuk mengisi stok awal.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
    };
  }
}

export async function updateProductAction(
  id: string,
  input: ProductInput
): Promise<ActionResponse> {
  try {
    const actor = await assertServerPermission('products:manage');
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Validasi perubahan produk gagal.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();

    const { data: oldProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldProduct) {
      return { success: false, message: 'Produk tidak ditemukan.' };
    }

    // Notice: `current_stock` is NEVER included in the update payload!
    const { data, error } = await supabase
      .from('products')
      .update({
        sku: parsed.data.sku,
        barcode: parsed.data.barcode ? parsed.data.barcode.trim() : null,
        name: parsed.data.name,
        category_id: parsed.data.category_id,
        product_type: parsed.data.product_type,
        base_unit_id: parsed.data.base_unit_id,
        purchase_price: parsed.data.purchase_price,
        selling_price: parsed.data.selling_price,
        min_stock: parsed.data.min_stock,
        track_expiration: parsed.data.track_expiration,
        description: parsed.data.description || null,
        image_url: parsed.data.image_url || null,
        is_active: parsed.data.is_active,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          message: 'SKU atau Barcode sudah digunakan oleh produk lain.',
        };
      }
      return {
        success: false,
        message: `Gagal memperbarui produk: ${error.message}`,
      };
    }

    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role_code,
      action: 'PRODUCT_UPDATED',
      entity_type: 'products',
      entity_id: id,
      description: `Memperbarui produk: ${data.name} (SKU: ${data.sku})`,
      old_values: oldProduct,
      new_values: data,
    });

    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return {
      success: true,
      message: `Produk "${data.name}" berhasil diperbarui.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
    };
  }
}

export async function toggleArchiveProductAction(
  id: string,
  archive: boolean
): Promise<ActionResponse> {
  try {
    const actor = await assertServerPermission('products:manage');
    const supabase = await createSupabaseServerClient();

    const { data: oldProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldProduct) {
      return { success: false, message: 'Produk tidak ditemukan.' };
    }

    const { data, error } = await supabase
      .from('products')
      .update({
        is_archived: archive,
        is_active: archive ? false : true,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        message: `Gagal mengubah status arsip produk: ${error.message}`,
      };
    }

    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role_code,
      action: archive ? 'PRODUCT_ARCHIVED' : 'PRODUCT_RESTORED',
      entity_type: 'products',
      entity_id: id,
      description: `${archive ? 'Mengarsipkan' : 'Mengaktifkan kembali'} produk ${data.name} (${data.sku})`,
      old_values: oldProduct,
      new_values: data,
    });

    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    return {
      success: true,
      message: `Produk "${data.name}" berhasil ${archive ? 'diarsipkan' : 'dipulihkan'}.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
    };
  }
}

// ============================================================================
// 4. ATOMIC INVENTORY LEDGER ADJUSTMENT ACTION (Via PostgreSQL RPC)
// ============================================================================

export async function recordStockAdjustmentAction(
  input: StockAdjustmentInput
): Promise<ActionResponse> {
  try {
    const actor = await assertServerPermission('inventory:adjust');
    const parsed = stockAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Validasi penyesuaian stok gagal. Periksa kembali input Anda.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc('record_stock_adjustment', {
      p_product_id: parsed.data.product_id,
      p_movement_type: parsed.data.movement_type,
      p_quantity: parsed.data.quantity,
      p_input_unit_id: parsed.data.input_unit_id,
      p_reason: parsed.data.reason,
      p_batch_id: parsed.data.batch_id || null,
      p_batch_number: parsed.data.batch_number || null,
      p_expiration_date: parsed.data.expiration_date || null,
      p_unit_cost: parsed.data.unit_cost ?? null,
      p_actor_id: actor.id,
    });

    if (error) {
      return {
        success: false,
        message: error.message || 'Gagal mencatat mutasi penyesuaian stok.',
      };
    }

    revalidatePath('/inventory');
    revalidatePath('/inventory/adjustments');
    revalidatePath('/inventory/movements');
    revalidatePath('/products');
    revalidatePath(`/products/${parsed.data.product_id}`);
    revalidatePath('/dashboard');
    revalidatePath('/notifications');

    return {
      success: true,
      message: `Mutasi stok berhasil dicatat ke Inventory Ledger (${data?.movement_number ?? 'OK'}). Saldo stok terkini: ${data?.after_stock ?? '-'}.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
    };
  }
}
