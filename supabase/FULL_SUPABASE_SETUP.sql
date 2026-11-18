-- MIGRATION: 20261118000001_initial_schema.sql
-- PROJECT  : FOOD INVENTORY MANAGEMENT SYSTEM (UMKM PANGAN & MINUMAN)
-- TIMEZONE : Asia/Jakarta
-- CURRENCY : IDR (Indonesian Rupiah)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUM TYPES & DOMAINS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE user_role_code AS ENUM ('OWNER', 'ADMIN', 'STAFF');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE product_type_enum AS ENUM (
        'RAW_MATERIAL',
        'FINISHED_PRODUCT',
        'PACKAGING',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE unit_dimension_enum AS ENUM (
        'MASS',
        'VOLUME',
        'COUNT',
        'PACK'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE stock_movement_type_enum AS ENUM (
        'INITIAL_STOCK',
        'RESTOCK',
        'SALE',
        'INTERNAL_USAGE',
        'DAMAGE',
        'RETURN_IN',
        'RETURN_OUT',
        'ADJUSTMENT_IN',
        'ADJUSTMENT_OUT'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE movement_direction_enum AS ENUM ('IN', 'OUT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE batch_status_enum AS ENUM (
        'ACTIVE',
        'DEPLETED',
        'EXPIRED',
        'QUARANTINED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type_enum AS ENUM (
        'SALE',
        'INTERNAL_USAGE',
        'DAMAGE',
        'OTHER_OUTBOUND'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status_enum AS ENUM (
        'POSTED',
        'REVERSED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE restock_status_enum AS ENUM (
        'COMPLETED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type_enum AS ENUM (
        'LOW_STOCK',
        'OUT_OF_STOCK',
        'EXPIRATION_WARNING',
        'EXPIRED_PRODUCT',
        'RESTOCK_COMPLETED',
        'STOCK_ADJUSTMENT',
        'TRANSACTION_COMPLETED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_severity_enum AS ENUM (
        'INFO',
        'WARNING',
        'CRITICAL'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE webhook_status_enum AS ENUM (
        'PENDING',
        'PROCESSING',
        'DELIVERED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. UTILITY FUNCTIONS (UPDATED_AT & CONTEXT HELPERS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. CORE TABLES (16 NORMALIZED TABLES)
-- ============================================================================

-- 3.1 ROLES
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code user_role_code NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_roles_updated_at ON public.roles;
CREATE TRIGGER set_roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- 3.2 PROFILES (Users linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    role_code user_role_code NOT NULL DEFAULT 'STAFF' REFERENCES public.roles(code),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role_code ON public.profiles(role_code);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Helper function for RLS role resolution
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role_code
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role_code
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = TRUE
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND is_active = TRUE
    );
$$;

-- 3.3 CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_is_archived ON public.categories(is_archived);

DROP TRIGGER IF EXISTS set_categories_updated_at ON public.categories;
CREATE TRIGGER set_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- 3.4 UNITS
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(25) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL UNIQUE,
    dimension unit_dimension_enum NOT NULL,
    allow_decimal BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_units_updated_at ON public.units;
CREATE TRIGGER set_units_updated_at
    BEFORE UPDATE ON public.units
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- 3.5 UNIT CONVERSIONS
CREATE TABLE IF NOT EXISTS public.unit_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    to_unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    multiplier NUMERIC(18, 6) NOT NULL CHECK (multiplier > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_unit_conversion_pair UNIQUE (from_unit_id, to_unit_id)
);

DROP TRIGGER IF EXISTS set_unit_conversions_updated_at ON public.unit_conversions;
CREATE TRIGGER set_unit_conversions_updated_at
    BEFORE UPDATE ON public.unit_conversions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_unit_conversion_dimensions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_from_dim unit_dimension_enum;
    v_to_dim unit_dimension_enum;
BEGIN
    SELECT dimension INTO v_from_dim FROM public.units WHERE id = NEW.from_unit_id;
    SELECT dimension INTO v_to_dim FROM public.units WHERE id = NEW.to_unit_id;

    IF v_from_dim IS DISTINCT FROM v_to_dim THEN
        RAISE EXCEPTION 'Konversi satuan tidak kompatibel: dimensi % tidak dapat dikonversi ke %', v_from_dim, v_to_dim;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_unit_conversion_dimensions ON public.unit_conversions;
CREATE TRIGGER trg_validate_unit_conversion_dimensions
    BEFORE INSERT OR UPDATE ON public.unit_conversions
    FOR EACH ROW EXECUTE FUNCTION public.validate_unit_conversion_dimensions();

CREATE OR REPLACE FUNCTION public.resolve_unit_multiplier(
    p_from_unit_id UUID,
    p_to_unit_id UUID
)
RETURNS NUMERIC(18, 6)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_multiplier NUMERIC(18, 6);
BEGIN
    IF p_from_unit_id = p_to_unit_id THEN
        RETURN 1.000000;
    END IF;

    SELECT multiplier INTO v_multiplier
    FROM public.unit_conversions
    WHERE from_unit_id = p_from_unit_id
      AND to_unit_id = p_to_unit_id;

    IF v_multiplier IS NULL THEN
        RAISE EXCEPTION 'Konversi satuan tidak ditemukan atau tidak diizinkan antara satuan yang dipilih.';
    END IF;

    RETURN v_multiplier;
END;
$$;

-- 3.6 PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(64) NOT NULL UNIQUE,
    barcode VARCHAR(64) UNIQUE,
    name VARCHAR(200) NOT NULL,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    product_type product_type_enum NOT NULL DEFAULT 'RAW_MATERIAL',
    base_unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
    selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    min_stock NUMERIC(15, 4) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    current_stock NUMERIC(15, 4) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    track_expiration BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON public.products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_is_active_archived ON public.products(is_active, is_archived);
CREATE INDEX IF NOT EXISTS idx_products_name_search ON public.products USING gin (to_tsvector('simple', name || ' ' || sku || ' ' || COALESCE(barcode, '')));

DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_product_stock_and_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.current_stock IS DISTINCT FROM OLD.current_stock
           AND current_setting('app.allow_ledger_stock_sync', TRUE) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Stok produk tidak boleh diubah secara langsung dari form produk. Gunakan mutasi/ledger inventori.';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF EXISTS (SELECT 1 FROM public.stock_movements WHERE product_id = OLD.id LIMIT 1) THEN
            RAISE EXCEPTION 'Produk yang memiliki riwayat transaksi atau mutasi stok tidak boleh dihapus permanen. Gunakan fitur Arsip.';
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- 3.7 SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    contact_person VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON public.suppliers(is_active);

DROP TRIGGER IF EXISTS set_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER set_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- 3.8 BATCHES (Batch & Expiration Tracking for FEFO)
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(80) NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    received_qty NUMERIC(15, 4) NOT NULL CHECK (received_qty > 0),
    remaining_qty NUMERIC(15, 4) NOT NULL CHECK (remaining_qty >= 0 AND remaining_qty <= received_qty),
    unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    status batch_status_enum NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_batch_number UNIQUE (product_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_batches_product_fefo
    ON public.batches(product_id, status, expiration_date ASC NULLS LAST, received_date ASC);
CREATE INDEX IF NOT EXISTS idx_batches_expiration_date ON public.batches(expiration_date);

DROP TRIGGER IF EXISTS set_batches_updated_at ON public.batches;
CREATE TRIGGER set_batches_updated_at
    BEFORE UPDATE ON public.batches
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_batch_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.remaining_qty = 0 AND NEW.status = 'ACTIVE' THEN
        NEW.status := 'DEPLETED';
    ELSIF NEW.remaining_qty > 0 AND NEW.status = 'DEPLETED' THEN
        NEW.status := 'ACTIVE';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_batch_status ON public.batches;
CREATE TRIGGER trg_sync_batch_status
    BEFORE INSERT OR UPDATE ON public.batches
    FOR EACH ROW EXECUTE FUNCTION public.sync_batch_status();

-- 3.9 RESTOCKS (Header)
CREATE TABLE IF NOT EXISTS public.restocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restock_number VARCHAR(64) NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    restock_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status restock_status_enum NOT NULL DEFAULT 'COMPLETED',
    total_items INTEGER NOT NULL DEFAULT 0 CHECK (total_items >= 0),
    total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
    invoice_reference VARCHAR(100),
    notes TEXT,
    idempotency_key VARCHAR(120) UNIQUE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restocks_supplier_id ON public.restocks(supplier_id);
CREATE INDEX IF NOT EXISTS idx_restocks_restock_date ON public.restocks(restock_date DESC);

DROP TRIGGER IF EXISTS set_restocks_updated_at ON public.restocks;
CREATE TRIGGER set_restocks_updated_at
    BEFORE UPDATE ON public.restocks
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- 3.10 RESTOCK ITEMS
CREATE TABLE IF NOT EXISTS public.restock_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restock_id UUID NOT NULL REFERENCES public.restocks(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
    input_qty NUMERIC(15, 4) NOT NULL CHECK (input_qty > 0),
    input_unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    normalized_qty NUMERIC(15, 4) NOT NULL CHECK (normalized_qty > 0),
    unit_cost NUMERIC(15, 2) NOT NULL CHECK (unit_cost >= 0),
    subtotal NUMERIC(15, 2) NOT NULL CHECK (subtotal >= 0),
    batch_number VARCHAR(80) NOT NULL,
    expiration_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restock_items_restock_id ON public.restock_items(restock_id);
CREATE INDEX IF NOT EXISTS idx_restock_items_product_id ON public.restock_items(product_id);

-- 3.11 TRANSACTIONS (Outbound Header: Sale, Internal Usage, Damage, Other Outbound)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number VARCHAR(64) NOT NULL UNIQUE,
    transaction_type transaction_type_enum NOT NULL,
    status transaction_status_enum NOT NULL DEFAULT 'POSTED',
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    customer_or_department VARCHAR(150),
    total_items INTEGER NOT NULL DEFAULT 0 CHECK (total_items >= 0),
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    notes TEXT,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    reversal_of_id UUID UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
    reversed_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions(created_by);

DROP TRIGGER IF EXISTS set_transactions_updated_at ON public.transactions;
CREATE TRIGGER set_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_posted_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Transaksi yang telah diposting bersifat permanen (immutable) dan tidak dapat dihapus.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'REVERSED' THEN
            RAISE EXCEPTION 'Transaksi yang sudah dibatalkan (reversed) tidak dapat diubah kembali.';
        END IF;

        IF NEW.transaction_number IS DISTINCT FROM OLD.transaction_number
           OR NEW.transaction_type IS DISTINCT FROM OLD.transaction_type
           OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
           OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'Detail transaksi yang telah diposting bersifat immutable. Gunakan fitur Reversal Transaksi.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_posted_transactions ON public.transactions;
CREATE TRIGGER trg_guard_posted_transactions
    BEFORE UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.guard_posted_transactions();

-- 3.12 TRANSACTION ITEMS
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES public.batches(id) ON DELETE RESTRICT,
    input_qty NUMERIC(15, 4) NOT NULL CHECK (input_qty > 0),
    input_unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    normalized_qty NUMERIC(15, 4) NOT NULL CHECK (normalized_qty > 0),
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    unit_cost_snapshot NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (unit_cost_snapshot >= 0),
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_tx_id ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id ON public.transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_batch_id ON public.transaction_items(batch_id);

-- 3.13 STOCK MOVEMENTS (THE IMMUTABLE INVENTORY LEDGER)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_number VARCHAR(64) NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES public.batches(id) ON DELETE RESTRICT,
    movement_type stock_movement_type_enum NOT NULL,
    direction movement_direction_enum NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    before_stock NUMERIC(15, 4) NOT NULL CHECK (before_stock >= 0),
    after_stock NUMERIC(15, 4) NOT NULL CHECK (after_stock >= 0),
    unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    reference_type VARCHAR(50) NOT NULL,
    reference_id UUID,
    reference_code VARCHAR(80) NOT NULL,
    reason TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ledger_balance_math CHECK (
        (direction = 'IN' AND after_stock = before_stock + quantity)
        OR
        (direction = 'OUT' AND after_stock = before_stock - quantity AND before_stock >= quantity)
    )
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type_created ON public.stock_movements(movement_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch_id ON public.stock_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements(reference_type, reference_id);

CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Ledger mutasi stok (stock_movements) bersifat immutable dan tidak dapat diubah atau dihapus.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ledger_mutation ON public.stock_movements;
CREATE TRIGGER trg_prevent_ledger_mutation
    BEFORE UPDATE OR DELETE ON public.stock_movements
    FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_guard_product_stock_and_deletion ON public.products;
CREATE TRIGGER trg_guard_product_stock_and_deletion
    BEFORE UPDATE OR DELETE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.guard_product_stock_and_deletion();

-- 3.14 NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type notification_type_enum NOT NULL,
    severity notification_severity_enum NOT NULL DEFAULT 'INFO',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
    reference_type VARCHAR(50),
    reference_id UUID,
    dedup_key VARCHAR(180) UNIQUE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type, created_at DESC);

-- 3.15 AUDIT LOGS (Immutable Security & Operational Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_email VARCHAR(255),
    actor_role user_role_code,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(100),
    description TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs bersifat immutable dan tidak dapat diubah atau dihapus.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- 3.16 WEBHOOK EVENTS (Transactional Outbox Pattern for n8n)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100) NOT NULL UNIQUE,
    event_type VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL,
    status webhook_status_enum NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_response_code INTEGER,
    last_error TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_poll
    ON public.webhook_events(status, next_retry_at ASC)
    WHERE status IN ('PENDING', 'FAILED');

DROP TRIGGER IF EXISTS set_webhook_events_updated_at ON public.webhook_events;
CREATE TRIGGER set_webhook_events_updated_at
    BEFORE UPDATE ON public.webhook_events
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ============================================================================
-- 4. ATOMIC INVENTORY LEDGER, FEFO & OUTBOX STORED PROCEDURES (RPC)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
    p_event_type VARCHAR(80),
    p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.webhook_events (
        event_id,
        event_type,
        payload,
        status,
        next_retry_at
    ) VALUES (
        'evt_' || encode(gen_random_bytes(12), 'hex'),
        p_event_type,
        p_payload,
        'PENDING',
        NOW()
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_product_stock_alerts(
    p_product_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product RECORD;
    v_dedup_key VARCHAR(180);
BEGIN
    SELECT p.*, u.code AS unit_code
    INTO v_product
    FROM public.products p
    JOIN public.units u ON u.id = p.base_unit_id
    WHERE p.id = p_product_id;

    IF NOT FOUND OR v_product.is_archived THEN
        RETURN;
    END IF;

    IF v_product.current_stock <= 0 THEN
        v_dedup_key := 'OUT_OF_STOCK:' || v_product.id::text || ':' || CURRENT_DATE::text;

        INSERT INTO public.notifications (
            notification_type,
            severity,
            title,
            message,
            product_id,
            dedup_key
        ) VALUES (
            'OUT_OF_STOCK',
            'CRITICAL',
            'Stok Habis: ' || v_product.name,
            format('Stok untuk produk %s (%s) telah habis (0 %s). Segera lakukan restock.', v_product.name, v_product.sku, v_product.unit_code),
            v_product.id,
            v_dedup_key
        )
        ON CONFLICT (dedup_key) DO NOTHING;

        IF FOUND THEN
            PERFORM public.enqueue_webhook_event(
                'inventory.out_of_stock',
                jsonb_build_object(
                    'product_id', v_product.id,
                    'sku', v_product.sku,
                    'product_name', v_product.name,
                    'current_stock', v_product.current_stock,
                    'min_stock', v_product.min_stock,
                    'unit', v_product.unit_code,
                    'timestamp', NOW()
                )
            );
        END IF;

    ELSIF v_product.current_stock <= v_product.min_stock THEN
        v_dedup_key := 'LOW_STOCK:' || v_product.id::text || ':' || CURRENT_DATE::text;

        INSERT INTO public.notifications (
            notification_type,
            severity,
            title,
            message,
            product_id,
            dedup_key
        ) VALUES (
            'LOW_STOCK',
            'WARNING',
            'Stok Menipis: ' || v_product.name,
            format('Stok %s (%s) tersisa %s %s (batas minimum: %s %s).', v_product.name, v_product.sku, v_product.current_stock, v_product.unit_code, v_product.min_stock, v_product.unit_code),
            v_product.id,
            v_dedup_key
        )
        ON CONFLICT (dedup_key) DO NOTHING;

        IF FOUND THEN
            PERFORM public.enqueue_webhook_event(
                'inventory.low_stock',
                jsonb_build_object(
                    'product_id', v_product.id,
                    'sku', v_product.sku,
                    'product_name', v_product.name,
                    'current_stock', v_product.current_stock,
                    'min_stock', v_product.min_stock,
                    'unit', v_product.unit_code,
                    'timestamp', NOW()
                )
            );
        END IF;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_stock_adjustment(
    p_product_id UUID,
    p_movement_type stock_movement_type_enum,
    p_quantity NUMERIC(15, 4),
    p_input_unit_id UUID,
    p_reason TEXT,
    p_batch_id UUID DEFAULT NULL,
    p_batch_number VARCHAR(80) DEFAULT NULL,
    p_expiration_date DATE DEFAULT NULL,
    p_unit_cost NUMERIC(15, 2) DEFAULT NULL,
    p_actor_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role_code;
    v_product RECORD;
    v_multiplier NUMERIC(18, 6);
    v_normalized_qty NUMERIC(15, 4);
    v_direction movement_direction_enum;
    v_before_stock NUMERIC(15, 4);
    v_after_stock NUMERIC(15, 4);
    v_target_batch_id UUID;
    v_batch RECORD;
    v_movement_number VARCHAR(64);
    v_movement_id UUID;
BEGIN
    SELECT role_code INTO v_role FROM public.profiles WHERE id = p_actor_id AND is_active = TRUE;
    IF v_role IS NULL OR v_role NOT IN ('OWNER', 'ADMIN') THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Owner atau Admin yang dapat melakukan penyesuaian stok.';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Kuantitas mutasi stok harus lebih besar dari 0.';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Alasan penyesuaian stok wajib diisi (minimal 5 karakter).';
    END IF;

    IF p_movement_type NOT IN ('INITIAL_STOCK', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT') THEN
        RAISE EXCEPTION 'Tipe mutasi % tidak valid untuk fungsi penyesuaian stok.', p_movement_type;
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = p_product_id AND is_archived = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produk tidak ditemukan atau telah diarsipkan.';
    END IF;

    v_multiplier := public.resolve_unit_multiplier(p_input_unit_id, v_product.base_unit_id);
    v_normalized_qty := round(p_quantity * v_multiplier, 4);

    v_before_stock := v_product.current_stock;

    IF p_movement_type IN ('INITIAL_STOCK', 'ADJUSTMENT_IN', 'RETURN_IN') THEN
        v_direction := 'IN';
        v_after_stock := v_before_stock + v_normalized_qty;

        IF p_batch_id IS NOT NULL THEN
            SELECT * INTO v_batch FROM public.batches WHERE id = p_batch_id AND product_id = p_product_id FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Batch tidak ditemukan untuk produk ini.';
            END IF;

            UPDATE public.batches
            SET received_qty = GREATEST(received_qty, remaining_qty + v_normalized_qty),
                remaining_qty = remaining_qty + v_normalized_qty
            WHERE id = p_batch_id;

            v_target_batch_id := p_batch_id;
        ELSE
            INSERT INTO public.batches (
                batch_number,
                product_id,
                received_qty,
                remaining_qty,
                unit_cost,
                received_date,
                expiration_date,
                status,
                notes,
                created_by
            ) VALUES (
                COALESCE(NULLIF(trim(p_batch_number), ''), 'BATCH-ADJ-' || to_char(NOW(), 'YYYYMMDD-HH24MISS')),
                p_product_id,
                v_normalized_qty,
                v_normalized_qty,
                COALESCE(p_unit_cost, v_product.purchase_price),
                CURRENT_DATE,
                p_expiration_date,
                'ACTIVE',
                p_reason,
                p_actor_id
            )
            RETURNING id INTO v_target_batch_id;
        END IF;
    ELSE
        v_direction := 'OUT';
        IF v_before_stock < v_normalized_qty THEN
            RAISE EXCEPTION 'Stok tidak mencukupi. Stok saat ini: %, jumlah pengurangan: %.', v_before_stock, v_normalized_qty;
        END IF;
        v_after_stock := v_before_stock - v_normalized_qty;

        IF p_batch_id IS NOT NULL THEN
            SELECT * INTO v_batch FROM public.batches WHERE id = p_batch_id AND product_id = p_product_id FOR UPDATE;
            IF NOT FOUND OR v_batch.remaining_qty < v_normalized_qty THEN
                RAISE EXCEPTION 'Stok pada batch yang dipilih tidak mencukupi.';
            END IF;

            UPDATE public.batches
            SET remaining_qty = remaining_qty - v_normalized_qty
            WHERE id = p_batch_id;

            v_target_batch_id := p_batch_id;
        END IF;
    END IF;

    v_movement_number := 'MOV-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

    INSERT INTO public.stock_movements (
        movement_number,
        product_id,
        batch_id,
        movement_type,
        direction,
        quantity,
        unit_id,
        before_stock,
        after_stock,
        unit_cost,
        reference_type,
        reference_id,
        reference_code,
        reason,
        created_by
    ) VALUES (
        v_movement_number,
        p_product_id,
        v_target_batch_id,
        p_movement_type,
        v_direction,
        v_normalized_qty,
        v_product.base_unit_id,
        v_before_stock,
        v_after_stock,
        COALESCE(p_unit_cost, v_product.purchase_price),
        'ADJUSTMENT',
        v_target_batch_id,
        v_movement_number,
        p_reason,
        p_actor_id
    )
    RETURNING id INTO v_movement_id;

    PERFORM set_config('app.allow_ledger_stock_sync', 'true', TRUE);
    UPDATE public.products
    SET current_stock = v_after_stock
    WHERE id = p_product_id;

    INSERT INTO public.audit_logs (
        actor_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        description,
        old_values,
        new_values
    ) VALUES (
        p_actor_id,
        v_role,
        'STOCK_ADJUSTMENT',
        'products',
        p_product_id::text,
        format('Penyesuaian stok (%s) produk %s sebesar %s. Alasan: %s', p_movement_type, v_product.name, v_normalized_qty, p_reason),
        jsonb_build_object('before_stock', v_before_stock),
        jsonb_build_object('after_stock', v_after_stock, 'movement_id', v_movement_id, 'reason', p_reason)
    );

    INSERT INTO public.notifications (
        notification_type,
        severity,
        title,
        message,
        product_id,
        batch_id,
        reference_type,
        reference_id
    ) VALUES (
        'STOCK_ADJUSTMENT',
        'INFO',
        'Penyesuaian Stok: ' || v_product.name,
        format('Mutasi %s sebesar %s berhasil dicatat (%s). Stok akhir: %s.', p_movement_type, v_normalized_qty, v_movement_number, v_after_stock),
        p_product_id,
        v_target_batch_id,
        'STOCK_MOVEMENT',
        v_movement_id
    );

    PERFORM public.evaluate_product_stock_alerts(p_product_id);

    PERFORM public.enqueue_webhook_event(
        'inventory.stock_adjusted',
        jsonb_build_object(
            'movement_id', v_movement_id,
            'movement_number', v_movement_number,
            'product_id', p_product_id,
            'product_name', v_product.name,
            'movement_type', p_movement_type,
            'direction', v_direction,
            'quantity', v_normalized_qty,
            'before_stock', v_before_stock,
            'after_stock', v_after_stock,
            'reason', p_reason,
            'actor_id', p_actor_id,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object(
        'movement_id', v_movement_id,
        'movement_number', v_movement_number,
        'before_stock', v_before_stock,
        'after_stock', v_after_stock,
        'batch_id', v_target_batch_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_restock_atomic(
    p_supplier_id UUID,
    p_restock_date DATE,
    p_invoice_reference VARCHAR(100),
    p_notes TEXT,
    p_idempotency_key VARCHAR(120),
    p_items JSONB,
    p_actor_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role_code;
    v_restock_id UUID;
    v_restock_number VARCHAR(64);
    v_item JSONB;
    v_product RECORD;
    v_multiplier NUMERIC(18, 6);
    v_normalized_qty NUMERIC(15, 4);
    v_before_stock NUMERIC(15, 4);
    v_after_stock NUMERIC(15, 4);
    v_batch_id UUID;
    v_batch_number VARCHAR(80);
    v_unit_cost NUMERIC(15, 2);
    v_subtotal NUMERIC(15, 2);
    v_total_cost NUMERIC(15, 2) := 0;
    v_total_items INTEGER := 0;
    v_movement_number VARCHAR(64);
BEGIN
    SELECT role_code INTO v_role FROM public.profiles WHERE id = p_actor_id AND is_active = TRUE;
    IF v_role IS NULL OR v_role NOT IN ('OWNER', 'ADMIN') THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Owner atau Admin yang dapat memproses Restock.';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Daftar item restock tidak boleh kosong.';
    END IF;

    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, restock_number INTO v_restock_id, v_restock_number
        FROM public.restocks
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'restock_id', v_restock_id,
                'restock_number', v_restock_number,
                'idempotent_replay', TRUE
            );
        END IF;
    END IF;

    v_restock_number := 'RST-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

    INSERT INTO public.restocks (
        restock_number,
        supplier_id,
        restock_date,
        status,
        invoice_reference,
        notes,
        idempotency_key,
        created_by
    ) VALUES (
        v_restock_number,
        p_supplier_id,
        COALESCE(p_restock_date, CURRENT_DATE),
        'COMPLETED',
        p_invoice_reference,
        p_notes,
        p_idempotency_key,
        p_actor_id
    )
    RETURNING id INTO v_restock_id;

    PERFORM set_config('app.allow_ledger_stock_sync', 'true', TRUE);

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT * INTO v_product
        FROM public.products
        WHERE id = (v_item->>'product_id')::UUID AND is_archived = FALSE
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produk dalam daftar restock tidak ditemukan atau sudah diarsipkan.';
        END IF;

        v_multiplier := public.resolve_unit_multiplier(
            (v_item->>'input_unit_id')::UUID,
            v_product.base_unit_id
        );
        v_normalized_qty := round(((v_item->>'quantity')::NUMERIC) * v_multiplier, 4);
        v_unit_cost := COALESCE((v_item->>'unit_cost')::NUMERIC, v_product.purchase_price);
        v_subtotal := round(((v_item->>'quantity')::NUMERIC) * v_unit_cost, 2);
        v_batch_number := COALESCE(
            NULLIF(trim(v_item->>'batch_number'), ''),
            'B-' || to_char(COALESCE(p_restock_date, CURRENT_DATE), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4))
        );

        INSERT INTO public.batches (
            batch_number,
            product_id,
            supplier_id,
            received_qty,
            remaining_qty,
            unit_cost,
            received_date,
            expiration_date,
            status,
            notes,
            created_by
        ) VALUES (
            v_batch_number,
            v_product.id,
            p_supplier_id,
            v_normalized_qty,
            v_normalized_qty,
            v_unit_cost,
            COALESCE(p_restock_date, CURRENT_DATE),
            NULLIF(v_item->>'expiration_date', '')::DATE,
            'ACTIVE',
            p_notes,
            p_actor_id
        )
        ON CONFLICT (product_id, batch_number) DO UPDATE
        SET received_qty = public.batches.received_qty + EXCLUDED.received_qty,
            remaining_qty = public.batches.remaining_qty + EXCLUDED.remaining_qty,
            unit_cost = EXCLUDED.unit_cost
        RETURNING id INTO v_batch_id;

        INSERT INTO public.restock_items (
            restock_id,
            product_id,
            batch_id,
            input_qty,
            input_unit_id,
            normalized_qty,
            unit_cost,
            subtotal,
            batch_number,
            expiration_date
        ) VALUES (
            v_restock_id,
            v_product.id,
            v_batch_id,
            (v_item->>'quantity')::NUMERIC,
            (v_item->>'input_unit_id')::UUID,
            v_normalized_qty,
            v_unit_cost,
            v_subtotal,
            v_batch_number,
            NULLIF(v_item->>'expiration_date', '')::DATE
        );

        v_before_stock := v_product.current_stock;
        v_after_stock := v_before_stock + v_normalized_qty;

        v_movement_number := 'MOV-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

        INSERT INTO public.stock_movements (
            movement_number,
            product_id,
            batch_id,
            movement_type,
            direction,
            quantity,
            unit_id,
            before_stock,
            after_stock,
            unit_cost,
            reference_type,
            reference_id,
            reference_code,
            reason,
            created_by
        ) VALUES (
            v_movement_number,
            v_product.id,
            v_batch_id,
            'RESTOCK',
            'IN',
            v_normalized_qty,
            v_product.base_unit_id,
            v_before_stock,
            v_after_stock,
            v_unit_cost,
            'RESTOCK',
            v_restock_id,
            v_restock_number,
            COALESCE(p_notes, 'Penerimaan barang restock ' || v_restock_number),
            p_actor_id
        );

        UPDATE public.products
        SET current_stock = v_after_stock,
            purchase_price = v_unit_cost
        WHERE id = v_product.id;

        v_total_cost := v_total_cost + v_subtotal;
        v_total_items := v_total_items + 1;
    END LOOP;

    UPDATE public.restocks
    SET total_items = v_total_items,
        total_cost = v_total_cost
    WHERE id = v_restock_id;

    INSERT INTO public.notifications (
        notification_type,
        severity,
        title,
        message,
        reference_type,
        reference_id
    ) VALUES (
        'RESTOCK_COMPLETED',
        'INFO',
        'Restock Selesai: ' || v_restock_number,
        format('Restock %s dengan %s item (Total Rp %s) berhasil ditambahkan ke inventori.', v_restock_number, v_total_items, v_total_cost),
        'RESTOCK',
        v_restock_id
    );

    INSERT INTO public.audit_logs (
        actor_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        description,
        new_values
    ) VALUES (
        p_actor_id,
        v_role,
        'RESTOCK_COMPLETED',
        'restocks',
        v_restock_id::text,
        format('Memproses restock %s (%s item, total Rp %s)', v_restock_number, v_total_items, v_total_cost),
        jsonb_build_object('restock_number', v_restock_number, 'total_items', v_total_items, 'total_cost', v_total_cost)
    );

    PERFORM public.enqueue_webhook_event(
        'inventory.restock_completed',
        jsonb_build_object(
            'restock_id', v_restock_id,
            'restock_number', v_restock_number,
            'supplier_id', p_supplier_id,
            'total_items', v_total_items,
            'total_cost', v_total_cost,
            'actor_id', p_actor_id,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object(
        'restock_id', v_restock_id,
        'restock_number', v_restock_number,
        'total_items', v_total_items,
        'total_cost', v_total_cost
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_outbound_transaction(
    p_transaction_type transaction_type_enum,
    p_customer_or_department VARCHAR(150),
    p_notes TEXT,
    p_idempotency_key VARCHAR(120),
    p_items JSONB,
    p_actor_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role_code;
    v_tx_id UUID;
    v_tx_number VARCHAR(64);
    v_movement_type stock_movement_type_enum;
    v_item JSONB;
    v_product RECORD;
    v_multiplier NUMERIC(18, 6);
    v_needed_qty NUMERIC(15, 4);
    v_remaining_to_allocate NUMERIC(15, 4);
    v_alloc_qty NUMERIC(15, 4);
    v_batch RECORD;
    v_before_stock NUMERIC(15, 4);
    v_after_stock NUMERIC(15, 4);
    v_unit_price NUMERIC(15, 2);
    v_subtotal NUMERIC(15, 2);
    v_total_amount NUMERIC(15, 2) := 0;
    v_total_items INTEGER := 0;
    v_movement_number VARCHAR(64);
    v_non_expired_stock NUMERIC(15, 4);
BEGIN
    SELECT role_code INTO v_role FROM public.profiles WHERE id = p_actor_id AND is_active = TRUE;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Akses ditolak: Pengguna tidak aktif atau belum terautentikasi.';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Daftar produk transaksi tidak boleh kosong.';
    END IF;

    SELECT id, transaction_number INTO v_tx_id, v_tx_number
    FROM public.transactions
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'transaction_id', v_tx_id,
            'transaction_number', v_tx_number,
            'idempotent_replay', TRUE
        );
    END IF;

    v_movement_type := CASE p_transaction_type
        WHEN 'SALE' THEN 'SALE'::stock_movement_type_enum
        WHEN 'INTERNAL_USAGE' THEN 'INTERNAL_USAGE'::stock_movement_type_enum
        WHEN 'DAMAGE' THEN 'DAMAGE'::stock_movement_type_enum
        ELSE 'INTERNAL_USAGE'::stock_movement_type_enum
    END;

    v_tx_number := 'TRX-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

    INSERT INTO public.transactions (
        transaction_number,
        transaction_type,
        status,
        customer_or_department,
        notes,
        idempotency_key,
        created_by
    ) VALUES (
        v_tx_number,
        p_transaction_type,
        'POSTED',
        p_customer_or_department,
        p_notes,
        p_idempotency_key,
        p_actor_id
    )
    RETURNING id INTO v_tx_id;

    PERFORM set_config('app.allow_ledger_stock_sync', 'true', TRUE);

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT * INTO v_product
        FROM public.products
        WHERE id = (v_item->>'product_id')::UUID AND is_archived = FALSE AND is_active = TRUE
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produk tidak ditemukan atau sedang tidak aktif.';
        END IF;

        v_multiplier := public.resolve_unit_multiplier(
            (v_item->>'input_unit_id')::UUID,
            v_product.base_unit_id
        );
        v_needed_qty := round(((v_item->>'quantity')::NUMERIC) * v_multiplier, 4);

        IF v_needed_qty <= 0 THEN
            RAISE EXCEPTION 'Kuantitas produk % harus lebih dari 0.', v_product.name;
        END IF;

        IF v_product.current_stock < v_needed_qty THEN
            RAISE EXCEPTION 'Stok produk "%" tidak mencukupi (Tersedia: %, Dibutuhkan: %).',
                v_product.name, v_product.current_stock, v_needed_qty;
        END IF;

        IF p_transaction_type IN ('SALE', 'INTERNAL_USAGE') THEN
            SELECT COALESCE(SUM(remaining_qty), 0) INTO v_non_expired_stock
            FROM public.batches
            WHERE product_id = v_product.id
              AND status = 'ACTIVE'
              AND remaining_qty > 0
              AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE);

            IF v_non_expired_stock < v_needed_qty THEN
                RAISE EXCEPTION 'Stok layak pakai (belum kedaluwarsa) untuk produk "%" tidak mencukupi (Layak pakai: %, Dibutuhkan: %). Periksa batch yang sudah kedaluwarsa!',
                    v_product.name, v_non_expired_stock, v_needed_qty;
            END IF;
        END IF;

        v_unit_price := CASE
            WHEN p_transaction_type = 'SALE' THEN COALESCE((v_item->>'unit_price')::NUMERIC, v_product.selling_price)
            ELSE v_product.purchase_price
        END;

        v_remaining_to_allocate := v_needed_qty;
        v_before_stock := v_product.current_stock;

        FOR v_batch IN
            SELECT *
            FROM public.batches
            WHERE product_id = v_product.id
              AND status = 'ACTIVE'
              AND remaining_qty > 0
              AND (
                  p_transaction_type = 'DAMAGE'
                  OR expiration_date IS NULL
                  OR expiration_date >= CURRENT_DATE
              )
            ORDER BY expiration_date ASC NULLS LAST, received_date ASC, created_at ASC
            FOR UPDATE
        LOOP
            EXIT WHEN v_remaining_to_allocate <= 0;

            v_alloc_qty := LEAST(v_batch.remaining_qty, v_remaining_to_allocate);

            UPDATE public.batches
            SET remaining_qty = remaining_qty - v_alloc_qty
            WHERE id = v_batch.id;

            v_subtotal := round((v_alloc_qty / v_multiplier) * v_unit_price, 2);

            INSERT INTO public.transaction_items (
                transaction_id,
                product_id,
                batch_id,
                input_qty,
                input_unit_id,
                normalized_qty,
                unit_price,
                unit_cost_snapshot,
                subtotal
            ) VALUES (
                v_tx_id,
                v_product.id,
                v_batch.id,
                round(v_alloc_qty / v_multiplier, 4),
                (v_item->>'input_unit_id')::UUID,
                v_alloc_qty,
                v_unit_price,
                v_batch.unit_cost,
                v_subtotal
            );

            v_after_stock := v_before_stock - v_alloc_qty;
            v_movement_number := 'MOV-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

            INSERT INTO public.stock_movements (
                movement_number,
                product_id,
                batch_id,
                movement_type,
                direction,
                quantity,
                unit_id,
                before_stock,
                after_stock,
                unit_cost,
                reference_type,
                reference_id,
                reference_code,
                reason,
                created_by
            ) VALUES (
                v_movement_number,
                v_product.id,
                v_batch.id,
                v_movement_type,
                'OUT',
                v_alloc_qty,
                v_product.base_unit_id,
                v_before_stock,
                v_after_stock,
                v_batch.unit_cost,
                'TRANSACTION',
                v_tx_id,
                v_tx_number,
                COALESCE(p_notes, 'Transaksi ' || p_transaction_type || ' ' || v_tx_number || ' (FEFO Batch: ' || v_batch.batch_number || ')'),
                p_actor_id
            );

            v_before_stock := v_after_stock;
            v_remaining_to_allocate := v_remaining_to_allocate - v_alloc_qty;
            v_total_amount := v_total_amount + v_subtotal;
        END LOOP;

        IF v_remaining_to_allocate > 0 THEN
            RAISE EXCEPTION 'Gagal mengalokasikan batch FEFO penuh untuk produk "%". Sisa yang belum teralokasi: %.',
                v_product.name, v_remaining_to_allocate;
        END IF;

        UPDATE public.products
        SET current_stock = v_before_stock
        WHERE id = v_product.id;

        PERFORM public.evaluate_product_stock_alerts(v_product.id);
        v_total_items := v_total_items + 1;
    END LOOP;

    UPDATE public.transactions
    SET total_items = v_total_items,
        total_amount = v_total_amount
    WHERE id = v_tx_id;

    INSERT INTO public.notifications (
        notification_type,
        severity,
        title,
        message,
        reference_type,
        reference_id
    ) VALUES (
        'TRANSACTION_COMPLETED',
        'INFO',
        'Transaksi Berhasil: ' || v_tx_number,
        format('Transaksi %s (%s) sejumlah Rp %s telah diproses.', v_tx_number, p_transaction_type, v_total_amount),
        'TRANSACTION',
        v_tx_id
    );

    INSERT INTO public.audit_logs (
        actor_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        description,
        new_values
    ) VALUES (
        p_actor_id,
        v_role,
        'TRANSACTION_CREATED',
        'transactions',
        v_tx_id::text,
        format('Membuat transaksi %s (%s) senilai Rp %s', v_tx_number, p_transaction_type, v_total_amount),
        jsonb_build_object('transaction_number', v_tx_number, 'type', p_transaction_type, 'total_amount', v_total_amount)
    );

    PERFORM public.enqueue_webhook_event(
        'transaction.completed',
        jsonb_build_object(
            'transaction_id', v_tx_id,
            'transaction_number', v_tx_number,
            'transaction_type', p_transaction_type,
            'total_items', v_total_items,
            'total_amount', v_total_amount,
            'actor_id', p_actor_id,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object(
        'transaction_id', v_tx_id,
        'transaction_number', v_tx_number,
        'total_items', v_total_items,
        'total_amount', v_total_amount
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_outbound_transaction(
    p_transaction_id UUID,
    p_reason TEXT,
    p_actor_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role_code;
    v_tx RECORD;
    v_tx_item RECORD;
    v_product RECORD;
    v_before_stock NUMERIC(15, 4);
    v_after_stock NUMERIC(15, 4);
    v_movement_number VARCHAR(64);
BEGIN
    SELECT role_code INTO v_role FROM public.profiles WHERE id = p_actor_id AND is_active = TRUE;
    IF v_role IS NULL OR v_role NOT IN ('OWNER', 'ADMIN') THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Owner atau Admin yang dapat melakukan Reversal Transaksi.';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Alasan reversal transaksi wajib diisi (minimal 5 karakter).';
    END IF;

    SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaksi tidak ditemukan.';
    END IF;

    IF v_tx.status = 'REVERSED' THEN
        RAISE EXCEPTION 'Transaksi % sudah pernah dibatalkan (reversed).', v_tx.transaction_number;
    END IF;

    PERFORM set_config('app.allow_ledger_stock_sync', 'true', TRUE);

    FOR v_tx_item IN
        SELECT * FROM public.transaction_items WHERE transaction_id = p_transaction_id
    LOOP
        SELECT * INTO v_product FROM public.products WHERE id = v_tx_item.product_id FOR UPDATE;

        IF v_tx_item.batch_id IS NOT NULL THEN
            UPDATE public.batches
            SET remaining_qty = remaining_qty + v_tx_item.normalized_qty
            WHERE id = v_tx_item.batch_id;
        END IF;

        v_before_stock := v_product.current_stock;
        v_after_stock := v_before_stock + v_tx_item.normalized_qty;
        v_movement_number := 'MOV-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

        INSERT INTO public.stock_movements (
            movement_number,
            product_id,
            batch_id,
            movement_type,
            direction,
            quantity,
            unit_id,
            before_stock,
            after_stock,
            unit_cost,
            reference_type,
            reference_id,
            reference_code,
            reason,
            created_by
        ) VALUES (
            v_movement_number,
            v_product.id,
            v_tx_item.batch_id,
            'RETURN_IN',
            'IN',
            v_tx_item.normalized_qty,
            v_product.base_unit_id,
            v_before_stock,
            v_after_stock,
            v_tx_item.unit_cost_snapshot,
            'REVERSAL',
            v_tx.id,
            'REV-' || v_tx.transaction_number,
            'Reversal transaksi ' || v_tx.transaction_number || ': ' || p_reason,
            p_actor_id
        );

        UPDATE public.products
        SET current_stock = v_after_stock
        WHERE id = v_product.id;
    END LOOP;

    UPDATE public.transactions
    SET status = 'REVERSED',
        reversed_by_id = p_actor_id,
        reversed_at = NOW(),
        reversal_reason = p_reason
    WHERE id = p_transaction_id;

    INSERT INTO public.audit_logs (
        actor_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        description,
        new_values
    ) VALUES (
        p_actor_id,
        v_role,
        'TRANSACTION_REVERSED',
        'transactions',
        p_transaction_id::text,
        format('Membatalkan (reverse) transaksi %s. Alasan: %s', v_tx.transaction_number, p_reason),
        jsonb_build_object('transaction_number', v_tx.transaction_number, 'reason', p_reason)
    );

    RETURN jsonb_build_object(
        'transaction_id', p_transaction_id,
        'transaction_number', v_tx.transaction_number,
        'status', 'REVERSED'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.scan_expiration_alerts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_batch RECORD;
    v_days_left INTEGER;
    v_bucket VARCHAR(30);
    v_type notification_type_enum;
    v_severity notification_severity_enum;
    v_title VARCHAR(200);
    v_msg TEXT;
    v_dedup_key VARCHAR(180);
    v_alerts_created INTEGER := 0;
BEGIN
    FOR v_batch IN
        SELECT
            b.id AS batch_id,
            b.batch_number,
            b.product_id,
            b.remaining_qty,
            b.expiration_date,
            p.name AS product_name,
            p.sku AS product_sku,
            u.code AS unit_code
        FROM public.batches b
        JOIN public.products p ON p.id = b.product_id
        JOIN public.units u ON u.id = p.base_unit_id
        WHERE b.remaining_qty > 0
          AND b.expiration_date IS NOT NULL
          AND b.expiration_date <= (CURRENT_DATE + INTERVAL '30 days')
          AND p.is_archived = FALSE
    LOOP
        v_days_left := (v_batch.expiration_date - CURRENT_DATE);

        IF v_days_left < 0 THEN
            v_bucket := 'EXPIRED';
            v_type := 'EXPIRED_PRODUCT';
            v_severity := 'CRITICAL';
            v_title := format('Batch Kedaluwarsa: %s (%s)', v_batch.product_name, v_batch.batch_number);
            v_msg := format('Batch %s untuk produk %s (%s %s) telah melewati tanggal kedaluwarsa (%s). Dilarang digunakan untuk produksi/penjualan!',
                v_batch.batch_number, v_batch.product_name, v_batch.remaining_qty, v_batch.unit_code, v_batch.expiration_date);

            UPDATE public.batches SET status = 'EXPIRED' WHERE id = v_batch.batch_id AND status != 'EXPIRED';
        ELSIF v_days_left = 0 THEN
            v_bucket := 'EXPIRING_TODAY';
            v_type := 'EXPIRATION_WARNING';
            v_severity := 'CRITICAL';
            v_title := format('Kedaluwarsa Hari Ini: %s (%s)', v_batch.product_name, v_batch.batch_number);
            v_msg := format('Batch %s untuk produk %s (%s %s) kedaluwarsa hari ini (%s).',
                v_batch.batch_number, v_batch.product_name, v_batch.remaining_qty, v_batch.unit_code, v_batch.expiration_date);
        ELSIF v_days_left <= 7 THEN
            v_bucket := 'EXPIRING_7D';
            v_type := 'EXPIRATION_WARNING';
            v_severity := 'WARNING';
            v_title := format('Peringatan Kedaluwarsa <= 7 Hari: %s', v_batch.product_name);
            v_msg := format('Batch %s (%s %s) akan kedaluwarsa dalam %s hari (%s). Prioritaskan penggunaan (FEFO).',
                v_batch.batch_number, v_batch.remaining_qty, v_batch.unit_code, v_days_left, v_batch.expiration_date);
        ELSE
            v_bucket := 'EXPIRING_30D';
            v_type := 'EXPIRATION_WARNING';
            v_severity := 'INFO';
            v_title := format('Peringatan Kedaluwarsa <= 30 Hari: %s', v_batch.product_name);
            v_msg := format('Batch %s (%s %s) akan kedaluwarsa dalam %s hari (%s).',
                v_batch.batch_number, v_batch.remaining_qty, v_batch.unit_code, v_days_left, v_batch.expiration_date);
        END IF;

        v_dedup_key := 'EXP:' || v_batch.batch_id::text || ':' || v_bucket;

        INSERT INTO public.notifications (
            notification_type,
            severity,
            title,
            message,
            product_id,
            batch_id,
            dedup_key
        ) VALUES (
            v_type,
            v_severity,
            v_title,
            v_msg,
            v_batch.product_id,
            v_batch.batch_id,
            v_dedup_key
        )
        ON CONFLICT (dedup_key) DO NOTHING;

        IF FOUND THEN
            v_alerts_created := v_alerts_created + 1;
            PERFORM public.enqueue_webhook_event(
                'inventory.expiration_warning',
                jsonb_build_object(
                    'batch_id', v_batch.batch_id,
                    'batch_number', v_batch.batch_number,
                    'product_id', v_batch.product_id,
                    'product_name', v_batch.product_name,
                    'remaining_qty', v_batch.remaining_qty,
                    'unit', v_batch.unit_code,
                    'expiration_date', v_batch.expiration_date,
                    'days_left', v_days_left,
                    'bucket', v_bucket,
                    'timestamp', NOW()
                )
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object('alerts_created', v_alerts_created);
END;
$$;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_authenticated" ON public.roles;
CREATE POLICY "roles_select_authenticated"
    ON public.roles FOR SELECT
    USING (public.is_authenticated_active_user());

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_self_or_admin"
    ON public.profiles FOR SELECT
    USING (id = auth.uid() OR public.get_current_user_role() IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS "profiles_update_owner_only" ON public.profiles;
CREATE POLICY "profiles_update_owner_only"
    ON public.profiles FOR UPDATE
    USING (public.get_current_user_role() = 'OWNER')
    WITH CHECK (public.get_current_user_role() = 'OWNER');

DROP POLICY IF EXISTS "profiles_insert_owner_only" ON public.profiles;
CREATE POLICY "profiles_insert_owner_only"
    ON public.profiles FOR INSERT
    WITH CHECK (public.get_current_user_role() = 'OWNER');

DROP POLICY IF EXISTS "categories_select_all_active" ON public.categories;
CREATE POLICY "categories_select_all_active"
    ON public.categories FOR SELECT
    USING (public.is_authenticated_active_user());

DROP POLICY IF EXISTS "categories_manage_owner_admin" ON public.categories;
CREATE POLICY "categories_manage_owner_admin"
    ON public.categories FOR ALL
    USING (public.get_current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (public.get_current_user_role() IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS "units_select_all_active" ON public.units;
CREATE POLICY "units_select_all_active"
    ON public.units FOR SELECT
    USING (public.is_authenticated_active_user());

DROP POLICY IF EXISTS "units_manage_owner_admin" ON public.units;
CREATE POLICY "units_manage_owner_admin"
    ON public.units FOR ALL
    USING (public.get_current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (public.get_current_user_role() IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS "unit_conversions_select_all_active" ON public.unit_conversions;
CREATE POLICY "unit_conversions_select_all_active"
    ON public.unit_conversions FOR SELECT
    USING (public.is_authenticated_active_user());

DROP POLICY IF EXISTS "unit_conversions_manage_owner_admin" ON public.unit_conversions;
CREATE POLICY "unit_conversions_manage_owner_admin"
    ON public.unit_conversions FOR ALL
    USING (public.get_current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (public.get_current_user_role() IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS "products_select_all_active" ON public.products;
CREATE POLICY "products_select_all_active"
    ON public.products FOR SELECT
    USING (public.is_authenticated_active_user());

DROP POLICY IF EXISTS "products_manage_owner_admin" ON public.products;
CREATE POLICY "products_manage_owner_admin"
    ON public.products FOR ALL
    USING (public.get_current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (public.get_current_user_role() IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS "batches_select_all_active" ON public.batches;
CREATE POLICY "batches_select_all_active"
    ON public.batches FOR SELECT
    USING (public.is_authenticated_active_user());

DROP POLICY IF EXISTS "suppliers_select_owner_admin" ON public.suppliers;
CREATE POLICY "suppliers_select_owner_admin"
    ON public.suppliers FOR SELECT
    USING (public.get_current_user_role() IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS "suppliers_manage_owner_admin" ON public.suppliers;
CREATE POLICY "suppliers_manage_owner_admin"
    ON public.suppliers FOR ALL
    USING (public.get_current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (public.get_current_user_role() IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS "restocks_select_owner_admin" ON public.restocks;
CREATE POLICY "restocks_select_owner_admin"
    ON public.restocks FOR SELECT
    USING (public.get_current_user_role() IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS "restock_items_select_owner_admin" ON public.restock_items;
CREATE POLICY "restock_items_select_owner_admin"
    ON public.restock_items FOR SELECT
    USING (public.get_current_user_role() IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS "transactions_select_by_role" ON public.transactions;
CREATE POLICY "transactions_select_by_role"
    ON public.transactions FOR SELECT
    USING (
        public.get_current_user_role() IN ('OWNER', 'ADMIN')
        OR (public.get_current_user_role() = 'STAFF' AND created_by = auth.uid())
    );

DROP POLICY IF EXISTS "transaction_items_select_by_role" ON public.transaction_items;
CREATE POLICY "transaction_items_select_by_role"
    ON public.transaction_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.transactions t
            WHERE t.id = transaction_items.transaction_id
              AND (
                  public.get_current_user_role() IN ('OWNER', 'ADMIN')
                  OR t.created_by = auth.uid()
              )
        )
    );

DROP POLICY IF EXISTS "stock_movements_select_by_role" ON public.stock_movements;
CREATE POLICY "stock_movements_select_by_role"
    ON public.stock_movements FOR SELECT
    USING (
        public.get_current_user_role() IN ('OWNER', 'ADMIN')
        OR (public.get_current_user_role() = 'STAFF' AND created_by = auth.uid())
    );

DROP POLICY IF EXISTS "notifications_select_all_active" ON public.notifications;
CREATE POLICY "notifications_select_all_active"
    ON public.notifications FOR SELECT
    USING (public.is_authenticated_active_user());

DROP POLICY IF EXISTS "notifications_update_read_status" ON public.notifications;
CREATE POLICY "notifications_update_read_status"
    ON public.notifications FOR UPDATE
    USING (public.is_authenticated_active_user())
    WITH CHECK (public.is_authenticated_active_user());

DROP POLICY IF EXISTS "audit_logs_select_owner_only" ON public.audit_logs;
CREATE POLICY "audit_logs_select_owner_only"
    ON public.audit_logs FOR SELECT
    USING (public.get_current_user_role() = 'OWNER');

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated"
    ON public.audit_logs FOR INSERT
    WITH CHECK (public.is_authenticated_active_user());

DROP POLICY IF EXISTS "webhook_events_owner_only" ON public.webhook_events;
CREATE POLICY "webhook_events_owner_only"
    ON public.webhook_events FOR ALL
    USING (public.get_current_user_role() = 'OWNER')
    WITH CHECK (public.get_current_user_role() = 'OWNER');

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

-- ============================================================================
-- MIGRATION: 20261118000003_auth_profile_sync_trigger.sql
-- PURPOSE  : Automatically synchronize Supabase auth.users into public.profiles
--            First user in the system is automatically granted OWNER role.
--            Also backfills any existing auth.users rows missing from profiles.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_count INTEGER;
    v_assigned_role user_role_code;
    v_full_name VARCHAR(150);
BEGIN
    SELECT COUNT(*) INTO v_existing_count FROM public.profiles;

    -- Check if role was explicitly passed in raw_user_meta_data, otherwise:
    -- First user becomes OWNER, subsequent users default to STAFF
    IF NEW.raw_user_meta_data->>'role_code' IN ('OWNER', 'ADMIN', 'STAFF') THEN
        v_assigned_role := (NEW.raw_user_meta_data->>'role_code')::user_role_code;
    ELSIF v_existing_count = 0 THEN
        v_assigned_role := 'OWNER';
    ELSE
        v_assigned_role := 'STAFF';
    END IF;

    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        role_code,
        is_active
    ) VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        NEW.phone,
        v_assigned_role,
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO public.audit_logs (
        actor_id,
        actor_email,
        actor_role,
        action,
        entity_type,
        entity_id,
        description,
        new_values
    ) VALUES (
        NEW.id,
        NEW.email,
        v_assigned_role,
        'USER_PROVISIONED',
        'profiles',
        NEW.id::text,
        format('Profil pengguna %s (%s) otomatis dibuat dengan peran %s.', v_full_name, NEW.email, v_assigned_role),
        jsonb_build_object('email', NEW.email, 'role_code', v_assigned_role)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill any existing users in auth.users that do not yet have a row in public.profiles
DO $$
DECLARE
    r_user RECORD;
    v_count INTEGER;
    v_role user_role_code;
BEGIN
    FOR r_user IN
        SELECT u.*
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE p.id IS NULL
        ORDER BY u.created_at ASC
    LOOP
        SELECT COUNT(*) INTO v_count FROM public.profiles;
        IF v_count = 0 THEN
            v_role := 'OWNER';
        ELSE
            v_role := 'STAFF';
        END IF;

        INSERT INTO public.profiles (
            id,
            email,
            full_name,
            role_code,
            is_active
        ) VALUES (
            r_user.id,
            COALESCE(r_user.email, 'user-' || r_user.id::text || '@umkm.id'),
            COALESCE(
                NULLIF(trim(r_user.raw_user_meta_data->>'full_name'), ''),
                split_part(COALESCE(r_user.email, 'Owner'), '@', 1)
            ),
            v_role,
            TRUE
        )
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;

-- ============================================================================
-- MIGRATION: 20261118000004_create_initial_admin_users.sql
-- PURPOSE  : Membuat user pertama di Supabase (auth.users + auth.identities)
--            dan menetapkan perannya di public.profiles (ADMIN & OWNER).
--            Dapat dijalankan langsung di Supabase Dashboard -> SQL Editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    v_admin_id UUID := '11111111-1111-1111-1111-111111111111';
    v_owner_id UUID := '22222222-2222-2222-2222-222222222222';
    v_admin_email TEXT := 'admin@umkm.id';
    v_owner_email TEXT := 'owner@umkm.id';
    v_default_password TEXT := 'AdminUMKM123!';
BEGIN
    -- ========================================================================
    -- 1. BUAT AKUN ADMIN PERTAMA (admin@umkm.id / AdminUMKM123!)
    -- ========================================================================
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_admin_email) THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_admin_id,
            'authenticated',
            'authenticated',
            v_admin_email,
            crypt(v_default_password, gen_salt('bf')),
            NOW(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Administrator Utama", "role_code": "ADMIN"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );

        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_admin_id,
            jsonb_build_object(
                'sub', v_admin_id::text,
                'email', v_admin_email,
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            v_admin_id::text,
            NOW(),
            NOW(),
            NOW()
        );
    ELSE
        SELECT id INTO v_admin_id FROM auth.users WHERE email = v_admin_email LIMIT 1;
        -- Pastikan password & konfirmasi email aktif
        UPDATE auth.users
        SET encrypted_password = crypt(v_default_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = v_admin_id;
    END IF;

    -- Pastikan profil Admin terdaftar dan berstatus ADMIN aktif
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role_code,
        is_active
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'Administrator Utama',
        'ADMIN',
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET role_code = 'ADMIN',
        full_name = 'Administrator Utama',
        is_active = TRUE,
        updated_at = NOW();

    -- ========================================================================
    -- 2. BUAT AKUN OWNER (owner@umkm.id / AdminUMKM123!) UNTUK AKSES PENUH
    -- ========================================================================
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_owner_email) THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_owner_id,
            'authenticated',
            'authenticated',
            v_owner_email,
            crypt(v_default_password, gen_salt('bf')),
            NOW(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Pemilik Usaha (Super Admin)", "role_code": "OWNER"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );

        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_owner_id,
            jsonb_build_object(
                'sub', v_owner_id::text,
                'email', v_owner_email,
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            v_owner_id::text,
            NOW(),
            NOW(),
            NOW()
        );
    ELSE
        SELECT id INTO v_owner_id FROM auth.users WHERE email = v_owner_email LIMIT 1;
        UPDATE auth.users
        SET encrypted_password = crypt(v_default_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = v_owner_id;
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role_code,
        is_active
    ) VALUES (
        v_owner_id,
        v_owner_email,
        'Pemilik Usaha (Super Admin)',
        'OWNER',
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET role_code = 'OWNER',
        full_name = 'Pemilik Usaha (Super Admin)',
        is_active = TRUE,
        updated_at = NOW();
END $$;

-- Confirm existing users created via Auth API
UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()) WHERE email IN ('admin@umkm.id', 'owner@umkm.id');
UPDATE public.profiles SET role_code = 'ADMIN', is_active = TRUE WHERE email = 'admin@umkm.id';
UPDATE public.profiles SET role_code = 'OWNER', is_active = TRUE WHERE email = 'owner@umkm.id';

-- ============================================================================
-- MIGRATION: 20261118000005_grant_table_permissions.sql
-- PURPOSE  : Memberikan izin (GRANT) skema public, tabel, dan fungsi RPC
--            kepada role Supabase `authenticated` dan `service_role`.
--            Tanpa ini, query dari aplikasi akan ditolak dengan kode 42501.
-- ============================================================================

-- 1. Berikan hak akses penggunaan skema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Berikan hak akses tabel di skema public (tetap dilindungi oleh RLS Policies!)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- 3. Pastikan tabel dan fungsi yang dibuat di masa mendatang otomatis mendapat GRANT
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- 4. Pastikan akun admin@umkm.id dan owner@umkm.id berstatus aktif di public.profiles
UPDATE public.profiles
SET role_code = 'OWNER',
    is_active = TRUE
WHERE email = 'owner@umkm.id';

UPDATE public.profiles
SET role_code = 'ADMIN',
    is_active = TRUE
WHERE email = 'admin@umkm.id';

