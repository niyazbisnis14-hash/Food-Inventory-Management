import { UserRoleCode } from '@/types/database';

export type PermissionKey =
  | 'dashboard:view'
  | 'products:view'
  | 'products:manage'
  | 'categories:view'
  | 'categories:manage'
  | 'units:view'
  | 'units:manage'
  | 'inventory:view'
  | 'inventory:adjust'
  | 'inventory:movements'
  | 'transactions:view_all'
  | 'transactions:view_own'
  | 'transactions:create'
  | 'transactions:reverse'
  | 'restocks:view'
  | 'restocks:create'
  | 'suppliers:view'
  | 'suppliers:manage'
  | 'reports:view'
  | 'reports:export'
  | 'notifications:view'
  | 'users:manage'
  | 'audit_logs:view'
  | 'settings:manage';

export const ROLE_LABELS: Record<UserRoleCode, string> = {
  OWNER: 'Pemilik (Owner)',
  ADMIN: 'Admin Operasional',
  STAFF: 'Staf / Kasir',
};

export const ROLE_PERMISSIONS: Record<UserRoleCode, PermissionKey[]> = {
  OWNER: [
    'dashboard:view',
    'products:view',
    'products:manage',
    'categories:view',
    'categories:manage',
    'units:view',
    'units:manage',
    'inventory:view',
    'inventory:adjust',
    'inventory:movements',
    'transactions:view_all',
    'transactions:view_own',
    'transactions:create',
    'transactions:reverse',
    'restocks:view',
    'restocks:create',
    'suppliers:view',
    'suppliers:manage',
    'reports:view',
    'reports:export',
    'notifications:view',
    'users:manage',
    'audit_logs:view',
    'settings:manage',
  ],
  ADMIN: [
    'dashboard:view',
    'products:view',
    'products:manage',
    'categories:view',
    'categories:manage',
    'units:view',
    'units:manage',
    'inventory:view',
    'inventory:adjust',
    'inventory:movements',
    'transactions:view_all',
    'transactions:view_own',
    'transactions:create',
    'transactions:reverse',
    'restocks:view',
    'restocks:create',
    'suppliers:view',
    'suppliers:manage',
    'reports:view',
    'reports:export',
    'notifications:view',
  ],
  STAFF: [
    'dashboard:view',
    'products:view',
    'categories:view',
    'units:view',
    'inventory:view',
    'transactions:view_own',
    'transactions:create',
    'notifications:view',
  ],
};

export function hasPermission(
  role: UserRoleCode | null | undefined,
  permission: PermissionKey
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Route-level RBAC matrix enforced by Middleware and Server Layouts.
 */
export const ROUTE_ROLE_REQUIREMENTS: Array<{
  prefix: string;
  allowedRoles: UserRoleCode[];
}> = [
  { prefix: '/users', allowedRoles: ['OWNER'] },
  { prefix: '/audit-logs', allowedRoles: ['OWNER'] },
  { prefix: '/settings', allowedRoles: ['OWNER'] },
  { prefix: '/reports', allowedRoles: ['OWNER', 'ADMIN'] },
  { prefix: '/restocks', allowedRoles: ['OWNER', 'ADMIN'] },
  { prefix: '/suppliers', allowedRoles: ['OWNER', 'ADMIN'] },
  { prefix: '/inventory/adjustments', allowedRoles: ['OWNER', 'ADMIN'] },
  { prefix: '/categories', allowedRoles: ['OWNER', 'ADMIN', 'STAFF'] },
  { prefix: '/products', allowedRoles: ['OWNER', 'ADMIN', 'STAFF'] },
  { prefix: '/inventory', allowedRoles: ['OWNER', 'ADMIN', 'STAFF'] },
  { prefix: '/transactions', allowedRoles: ['OWNER', 'ADMIN', 'STAFF'] },
  { prefix: '/notifications', allowedRoles: ['OWNER', 'ADMIN', 'STAFF'] },
  { prefix: '/dashboard', allowedRoles: ['OWNER', 'ADMIN', 'STAFF'] },
];

export function canAccessPath(role: UserRoleCode, pathname: string): boolean {
  const matchedRule = ROUTE_ROLE_REQUIREMENTS.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)
  );

  if (!matchedRule) return true;
  return matchedRule.allowedRoles.includes(role);
}
