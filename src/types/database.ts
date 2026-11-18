export type UserRoleCode = 'OWNER' | 'ADMIN' | 'STAFF';

export type ProductType =
  | 'RAW_MATERIAL'
  | 'FINISHED_PRODUCT'
  | 'PACKAGING'
  | 'OTHER';

export type UnitDimension = 'MASS' | 'VOLUME' | 'COUNT' | 'PACK';

export type StockMovementType =
  | 'INITIAL_STOCK'
  | 'RESTOCK'
  | 'SALE'
  | 'INTERNAL_USAGE'
  | 'DAMAGE'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT';

export type MovementDirection = 'IN' | 'OUT';

export type BatchStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'QUARANTINED';

export type TransactionType =
  | 'SALE'
  | 'INTERNAL_USAGE'
  | 'DAMAGE'
  | 'OTHER_OUTBOUND';

export type TransactionStatus = 'POSTED' | 'REVERSED';

export type RestockStatus = 'COMPLETED' | 'CANCELLED';

export type NotificationType =
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'EXPIRATION_WARNING'
  | 'EXPIRED_PRODUCT'
  | 'RESTOCK_COMPLETED'
  | 'STOCK_ADJUSTMENT'
  | 'TRANSACTION_COMPLETED';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type WebhookStatus = 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'FAILED';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role_code: UserRoleCode;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnitRecord {
  id: string;
  code: string;
  name: string;
  dimension: UnitDimension;
  allow_decimal: boolean;
  is_active: boolean;
}

export interface UnitConversionRecord {
  id: string;
  from_unit_id: string;
  to_unit_id: string;
  multiplier: number;
  from_unit?: UnitRecord;
  to_unit?: UnitRecord;
}

export interface BatchRecord {
  id: string;
  batch_number: string;
  product_id: string;
  supplier_id: string | null;
  received_qty: number;
  remaining_qty: number;
  unit_cost: number;
  received_date: string;
  expiration_date: string | null;
  status: BatchStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product?: ProductRecord;
}

export interface StockMovementRecord {
  id: string;
  movement_number: string;
  product_id: string;
  batch_id: string | null;
  movement_type: StockMovementType;
  direction: MovementDirection;
  quantity: number;
  unit_id: string;
  before_stock: number;
  after_stock: number;
  unit_cost: number;
  reference_type: string;
  reference_id: string | null;
  reference_code: string;
  reason: string | null;
  created_by: string;
  created_at: string;
  product?: {
    id: string;
    sku: string;
    name: string;
  };
  unit?: {
    id: string;
    code: string;
    name: string;
  };
  batch?: {
    id: string;
    batch_number: string;
    expiration_date: string | null;
  } | null;
  creator?: {
    id: string;
    full_name: string;
    role_code: UserRoleCode;
  };
}

export interface ProductRecord {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category_id: string;
  product_type: ProductType;
  base_unit_id: string;
  purchase_price: number;
  selling_price: number;
  min_stock: number;
  current_stock: number;
  track_expiration: boolean;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  category?: CategoryRecord;
  base_unit?: UnitRecord;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}
