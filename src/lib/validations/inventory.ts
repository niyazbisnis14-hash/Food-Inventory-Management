import { z } from 'zod';

// 1. Category Validation Schema
export const categorySchema = z.object({
  code: z
    .string({ required_error: 'Kode kategori wajib diisi' })
    .trim()
    .min(2, 'Kode kategori minimal 2 karakter')
    .max(50, 'Kode kategori maksimal 50 karakter')
    .regex(
      /^[A-Z0-9-_]+$/i,
      'Kode kategori hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_)'
    )
    .transform((val) => val.toUpperCase()),
  name: z
    .string({ required_error: 'Nama kategori wajib diisi' })
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter')
    .max(120, 'Nama kategori maksimal 120 karakter'),
  description: z
    .string()
    .trim()
    .max(500, 'Deskripsi maksimal 500 karakter')
    .optional()
    .or(z.literal('')),
});

// 2. Unit Validation Schema
export const unitSchema = z.object({
  code: z
    .string({ required_error: 'Simbol satuan wajib diisi' })
    .trim()
    .min(1, 'Simbol satuan wajib diisi')
    .max(25, 'Simbol satuan maksimal 25 karakter'),
  name: z
    .string({ required_error: 'Nama satuan wajib diisi' })
    .trim()
    .min(2, 'Nama satuan minimal 2 karakter')
    .max(80, 'Nama satuan maksimal 80 karakter'),
  dimension: z.enum(['MASS', 'VOLUME', 'COUNT', 'PACK'], {
    required_error: 'Dimensi satuan wajib dipilih',
  }),
  allow_decimal: z.boolean().default(true),
});

// 3. Unit Conversion Validation Schema
export const unitConversionSchema = z
  .object({
    from_unit_id: z
      .string({ required_error: 'Satuan asal wajib dipilih' })
      .uuid('Satuan asal tidak valid'),
    to_unit_id: z
      .string({ required_error: 'Satuan tujuan wajib dipilih' })
      .uuid('Satuan tujuan tidak valid'),
    multiplier: z.coerce
      .number({ required_error: 'Faktor pengali wajib diisi' })
      .positive('Faktor konversi harus lebih besar dari 0'),
  })
  .refine((data) => data.from_unit_id !== data.to_unit_id, {
    message: 'Satuan asal dan satuan tujuan tidak boleh sama',
    path: ['to_unit_id'],
  });

// 4. Product Validation Schema
// IMPORTANT: `current_stock` is intentionally omitted so it can NEVER be edited from the product form!
export const productSchema = z.object({
  sku: z
    .string({ required_error: 'SKU wajib diisi' })
    .trim()
    .min(2, 'SKU minimal 2 karakter')
    .max(64, 'SKU maksimal 64 karakter')
    .regex(
      /^[A-Z0-9-_./]+$/i,
      'SKU hanya boleh berisi huruf, angka, dan karakter (- _ . /)'
    )
    .transform((val) => val.toUpperCase()),
  barcode: z
    .string()
    .trim()
    .max(64, 'Barcode maksimal 64 karakter')
    .optional()
    .or(z.literal('')),
  name: z
    .string({ required_error: 'Nama produk wajib diisi' })
    .trim()
    .min(2, 'Nama produk minimal 2 karakter')
    .max(200, 'Nama produk maksimal 200 karakter'),
  category_id: z
    .string({ required_error: 'Kategori wajib dipilih' })
    .uuid('Pilih kategori produk yang valid'),
  product_type: z.enum(
    ['RAW_MATERIAL', 'FINISHED_PRODUCT', 'PACKAGING', 'OTHER'],
    {
      required_error: 'Tipe produk wajib dipilih',
    }
  ),
  base_unit_id: z
    .string({ required_error: 'Satuan dasar wajib dipilih' })
    .uuid('Pilih satuan dasar yang valid'),
  purchase_price: z.coerce
    .number()
    .min(0, 'Harga beli tidak boleh negatif')
    .default(0),
  selling_price: z.coerce
    .number()
    .min(0, 'Harga jual tidak boleh negatif')
    .default(0),
  min_stock: z.coerce
    .number()
    .min(0, 'Stok minimum tidak boleh negatif')
    .default(0),
  track_expiration: z.boolean().default(true),
  description: z
    .string()
    .trim()
    .max(1000, 'Deskripsi maksimal 1000 karakter')
    .optional()
    .or(z.literal('')),
  image_url: z
    .string()
    .trim()
    .url('Format URL gambar tidak valid')
    .optional()
    .or(z.literal('')),
  is_active: z.boolean().default(true),
});

// 5. Stock Adjustment Validation Schema (Ledger Mutation)
export const stockAdjustmentSchema = z.object({
  product_id: z
    .string({ required_error: 'Produk wajib dipilih' })
    .uuid('Pilih produk yang valid'),
  movement_type: z.enum(
    [
      'INITIAL_STOCK',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'RETURN_IN',
      'RETURN_OUT',
    ],
    {
      required_error: 'Tipe penyesuaian wajib dipilih',
    }
  ),
  quantity: z.coerce
    .number({ required_error: 'Kuantitas wajib diisi' })
    .positive('Kuantitas mutasi harus lebih besar dari 0'),
  input_unit_id: z
    .string({ required_error: 'Satuan input wajib dipilih' })
    .uuid('Pilih satuan yang valid'),
  reason: z
    .string({ required_error: 'Alasan penyesuaian wajib diisi' })
    .trim()
    .min(5, 'Alasan penyesuaian wajib diisi (minimal 5 karakter)')
    .max(500, 'Alasan maksimal 500 karakter'),
  batch_id: z.string().uuid().optional().or(z.literal('')),
  batch_number: z
    .string()
    .trim()
    .max(80, 'Nomor batch maksimal 80 karakter')
    .optional()
    .or(z.literal('')),
  expiration_date: z.string().optional().or(z.literal('')),
  unit_cost: z.coerce
    .number()
    .min(0, 'Harga pokok unit tidak boleh negatif')
    .optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type UnitInput = z.infer<typeof unitSchema>;
export type UnitConversionInput = z.infer<typeof unitConversionSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
