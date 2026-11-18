'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Tags,
  Boxes,
  ArrowLeftRight,
  SlidersHorizontal,
  ShoppingCart,
  Truck,
  Building2,
  BarChart3,
  Bell,
  Users,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UtensilsCrossed,
  Menu,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/types/database';
import { hasPermission, PermissionKey, ROLE_LABELS } from '@/lib/permissions';
import { logoutAction } from '@/services/auth.actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: PermissionKey;
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const NAVIGATION_GROUPS: NavGroup[] = [
  {
    groupTitle: 'Utama',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permission: 'dashboard:view',
      },
    ],
  },
  {
    groupTitle: 'Inventori & Stok',
    items: [
      {
        label: 'Katalog Produk',
        href: '/products',
        icon: Package,
        permission: 'products:view',
      },
      {
        label: 'Kategori & Satuan',
        href: '/categories',
        icon: Tags,
        permission: 'categories:view',
      },
      {
        label: 'Stok & Batch (FEFO)',
        href: '/inventory',
        icon: Boxes,
        permission: 'inventory:view',
      },
      {
        label: 'Penyesuaian Stok',
        href: '/inventory/adjustments',
        icon: SlidersHorizontal,
        permission: 'inventory:adjust',
      },
      {
        label: 'Riwayat Mutasi (Ledger)',
        href: '/inventory/movements',
        icon: ArrowLeftRight,
        permission: 'inventory:view',
      },
    ],
  },
  {
    groupTitle: 'Operasional',
    items: [
      {
        label: 'Transaksi Keluar',
        href: '/transactions',
        icon: ShoppingCart,
        permission: 'transactions:create',
      },
      {
        label: 'Penerimaan Restock',
        href: '/restocks',
        icon: Truck,
        permission: 'restocks:view',
      },
      {
        label: 'Data Supplier',
        href: '/suppliers',
        icon: Building2,
        permission: 'suppliers:view',
      },
    ],
  },
  {
    groupTitle: 'Analitik & Laporan',
    items: [
      {
        label: 'Pusat Laporan',
        href: '/reports',
        icon: BarChart3,
        permission: 'reports:view',
      },
    ],
  },
  {
    groupTitle: 'Manajemen Sistem',
    items: [
      {
        label: 'Notifikasi & Peringatan',
        href: '/notifications',
        icon: Bell,
        permission: 'notifications:view',
      },
      {
        label: 'Manajemen Pengguna',
        href: '/users',
        icon: Users,
        permission: 'users:manage',
      },
      {
        label: 'Audit Log Sistem',
        href: '/audit-logs',
        icon: ShieldCheck,
        permission: 'audit_logs:view',
      },
      {
        label: 'Pengaturan & Webhook',
        href: '/settings',
        icon: Settings,
        permission: 'settings:manage',
      },
    ],
  },
];

const BREADCRUMB_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Katalog Produk',
  categories: 'Kategori & Satuan',
  inventory: 'Inventori & Batch',
  adjustments: 'Penyesuaian Stok',
  movements: 'Riwayat Mutasi (Ledger)',
  transactions: 'Transaksi Keluar',
  restocks: 'Penerimaan Restock',
  suppliers: 'Data Supplier',
  reports: 'Pusat Laporan',
  stock: 'Laporan Stok',
  expiration: 'Laporan Kedaluwarsa',
  notifications: 'Notifikasi',
  users: 'Manajemen Pengguna',
  'audit-logs': 'Audit Log',
  settings: 'Pengaturan Sistem',
};

interface AppShellProps {
  user: UserProfile;
  unreadNotificationsCount: number;
  supabaseConfigured: boolean;
  children: React.ReactNode;
}

export function AppShell({
  user,
  unreadNotificationsCount,
  supabaseConfigured,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const segments = pathname.split('/').filter(Boolean);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation (Deep Navy Commercial SaaS Theme) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 lg:static',
          collapsed ? 'w-[72px]' : 'w-64',
          mobileMenuOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 overflow-hidden"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="truncate text-sm font-bold tracking-tight text-white">
                  Inventori Pangan
                </span>
                <span className="truncate text-[11px] text-slate-400">
                  F&B Ledger System
                </span>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="hidden rounded-md p-1.5 text-slate-400 hover:bg-sidebar-accent hover:text-white lg:inline-flex"
            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-sidebar-accent hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links Filtered by Role Permissions */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAVIGATION_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) =>
              hasPermission(user.role_code, item.permission)
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.groupTitle} className="space-y-1">
                {!collapsed && (
                  <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                    {group.groupTitle}
                  </p>
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/inventory' &&
                      pathname.startsWith(`${item.href}/`));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-300 hover:bg-sidebar-accent hover:text-white',
                        collapsed && 'justify-center px-2'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {!collapsed &&
                        item.href === '/notifications' &&
                        unreadNotificationsCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-slate-950">
                            {unreadNotificationsCount}
                          </span>
                        )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Profile & Logout Footer */}
        <div className="border-t border-sidebar-border p-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-md bg-sidebar-accent/60 p-2.5',
              collapsed && 'justify-center p-2'
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-300">
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {user.full_name}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {ROLE_LABELS[user.role_code]}
                </p>
              </div>
            )}
            {!collapsed && (
              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Keluar dari Sistem"
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="flex items-center text-sm">
              <ol className="flex items-center gap-2 text-muted-foreground">
                <li>
                  <Link
                    href="/dashboard"
                    className="font-medium hover:text-foreground"
                  >
                    Sistem Inventori
                  </Link>
                </li>
                {segments.map((segment, index) => {
                  const href = '/' + segments.slice(0, index + 1).join('/');
                  const isLast = index === segments.length - 1;
                  const label = BREADCRUMB_MAP[segment] ?? segment;

                  return (
                    <li key={href} className="flex items-center gap-2">
                      <span className="text-slate-300">/</span>
                      {isLast ? (
                        <span className="font-semibold text-foreground">
                          {label}
                        </span>
                      ) : (
                        <Link
                          href={href}
                          className="hover:text-foreground"
                        >
                          {label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:inline-flex">
              WIB (Asia/Jakarta) • IDR
            </Badge>
            <Badge variant="secondary">
              {ROLE_LABELS[user.role_code]}
            </Badge>
            <Link href="/notifications">
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {unreadNotificationsCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </header>

        {/* Setup Warning Banner if .env.local is not yet connected to Supabase */}
        {!supabaseConfigured && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 sm:px-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Mode Pratinjau Konfigurasi Awal:</strong> Kredensial
                Supabase (<code>.env.local</code>) belum diisi. Salin{' '}
                <code>.env.example</code> menjadi <code>.env.local</code> dan
                jalankan migrasi SQL di <code>supabase/migrations/</code> untuk
                mengaktifkan koneksi database langsung.
              </span>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
