import React, { Suspense } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { LoginForm, LoginFormSkeleton } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <UtensilsCrossed className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sistem Manajemen Inventori Pangan
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Kontrol Stok Bahan Baku, Batch FEFO &amp; Transaksi Operasional
        </p>
      </div>

      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
