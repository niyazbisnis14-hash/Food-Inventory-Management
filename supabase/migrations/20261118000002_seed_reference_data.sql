-- ============================================================================
-- MIGRATION: 20261118000002_seed_reference_data.sql
-- PURPOSE  : Seed required system Roles, Base Units, Unit Conversions,
--            and standard F&B Categories (No fake production stats).
-- ============================================================================

-- 1. SEED ROLES (OWNER, ADMIN, STAFF)
INSERT INTO public.roles (code, name, description, permissions)
VALUES
    (
        'OWNER',
        'Pemilik Usaha (Owner)',
        'Akses penuh ke seluruh modul sistem, manajemen pengguna, laporan, pengaturan, dan audit log.',
        '{
            "dashboard": ["view"],
            "products": ["view", "create", "edit", "archive"],
            "categories": ["view", "create", "edit", "archive"],
            "units": ["view", "create", "edit"],
            "inventory": ["view", "adjust", "movements"],
            "transactions": ["view_all", "create", "reverse"],
            "restocks": ["view", "create"],
            "suppliers": ["view", "create", "edit", "archive"],
            "reports": ["view", "export"],
            "notifications": ["view", "manage"],
            "users": ["view", "create", "edit", "deactivate"],
            "audit_logs": ["view"],
            "settings": ["view", "edit"]
        }'::jsonb
    ),
    (
        'ADMIN',
        'Administrator Gudang / Operasional',
        'Mengelola produk, stok, penyesuaian stok, restock, supplier, transaksi, dan laporan operasional.',
        '{
            "dashboard": ["view"],
            "products": ["view", "create", "edit", "archive"],
            "categories": ["view", "create", "edit", "archive"],
            "units": ["view", "create", "edit"],
            "inventory": ["view", "adjust", "movements"],
            "transactions": ["view_all", "create", "reverse"],
            "restocks": ["view", "create"],
            "suppliers": ["view", "create", "edit", "archive"],
            "reports": ["view", "export"],
            "notifications": ["view", "manage"],
            "users": [],
            "audit_logs": [],
            "settings": []
        }'::jsonb
    ),
    (
        'STAFF',
        'Staf Operasional / Kasir / Dapur',
        'Melihat katalog produk dan stok, memindai barcode, membuat transaksi keluar yang diizinkan, serta melihat riwayat transaksi sendiri.',
        '{
            "dashboard": ["view"],
            "products": ["view"],
            "categories": ["view"],
            "units": ["view"],
            "inventory": ["view"],
            "transactions": ["view_own", "create"],
            "restocks": [],
            "suppliers": [],
            "reports": [],
            "notifications": ["view"],
            "users": [],
            "audit_logs": [],
            "settings": []
        }'::jsonb
    )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions;

-- 2. SEED STANDARD UNITS (kg, g, L, ml, pcs, bottle, box)
INSERT INTO public.units (code, name, dimension, allow_decimal)
VALUES
    ('kg', 'Kilogram', 'MASS', TRUE),
    ('g', 'Gram', 'MASS', TRUE),
    ('L', 'Liter', 'VOLUME', TRUE),
    ('ml', 'Mililiter', 'VOLUME', TRUE),
    ('pcs', 'Pieces (Pcs)', 'COUNT', FALSE),
    ('btl', 'Botol (Bottle)', 'PACK', FALSE),
    ('box', 'Box / Karton', 'PACK', FALSE)
ON CONFLICT (code) DO NOTHING;

-- 3. SEED CONFIGURABLE UNIT CONVERSIONS (1 kg = 1000 g, 1 L = 1000 ml, and inverses)
DO $$
DECLARE
    v_kg UUID;
    v_g UUID;
    v_l UUID;
    v_ml UUID;
BEGIN
    SELECT id INTO v_kg FROM public.units WHERE code = 'kg';
    SELECT id INTO v_g FROM public.units WHERE code = 'g';
    SELECT id INTO v_l FROM public.units WHERE code = 'L';
    SELECT id INTO v_ml FROM public.units WHERE code = 'ml';

    IF v_kg IS NOT NULL AND v_g IS NOT NULL THEN
        INSERT INTO public.unit_conversions (from_unit_id, to_unit_id, multiplier)
        VALUES
            (v_kg, v_g, 1000.000000),
            (v_g, v_kg, 0.001000)
        ON CONFLICT (from_unit_id, to_unit_id) DO UPDATE SET multiplier = EXCLUDED.multiplier;
    END IF;

    IF v_l IS NOT NULL AND v_ml IS NOT NULL THEN
        INSERT INTO public.unit_conversions (from_unit_id, to_unit_id, multiplier)
        VALUES
            (v_l, v_ml, 1000.000000),
            (v_ml, v_l, 0.001000)
        ON CONFLICT (from_unit_id, to_unit_id) DO UPDATE SET multiplier = EXCLUDED.multiplier;
    END IF;
END $$;

-- 4. SEED DEFAULT F&B CATEGORIES
INSERT INTO public.categories (code, name, description)
VALUES
    ('CAT-BERAS', 'Beras & Biji-bijian (Rice)', 'Beras putih, beras merah, tepung, dan bahan pokok sejenis'),
    ('CAT-AYAM', 'Unggas & Daging (Chicken & Meat)', 'Daging ayam segar, fillet, daging sapi, dan olahan protein hewani'),
    ('CAT-SAYUR', 'Sayuran & Segar (Vegetables)', 'Sayuran segar, umbi-umbian, dan bahan segar harian'),
    ('CAT-BUMBU', 'Bumbu & Rempah (Spices)', 'Bumbu dapur, rempah kering, saus, minyak goreng, dan penyedap'),
    ('CAT-MINUMAN', 'Minuman & Bahan Minuman (Beverages)', 'Sirup, susu, kopi, teh, bubuk minuman, dan air mineral'),
    ('CAT-KEMASAN', 'Kemasan & Alat Makan (Packaging)', 'Paper bowl, cup plastik, tutup cup, sedotan, kantong, dan box makanan'),
    ('CAT-PRODUK-JADI', 'Produk Makanan Jadi (Finished Products)', 'Makanan dan minuman siap jual atau hasil produksi dapur')
ON CONFLICT (code) DO NOTHING;
