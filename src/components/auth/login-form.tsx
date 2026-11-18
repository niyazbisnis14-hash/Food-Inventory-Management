'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { loginSchema, LoginInput } from '@/lib/validations/auth';
import { loginAction } from '@/services/auth.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const errorParam = searchParams.get('error');
  const resetParam = searchParams.get('reset');
  const redirectToParam = searchParams.get('redirectTo');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: LoginInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(values);
      if (!result.success) {
        setServerError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      const safeRedirect =
        redirectToParam && redirectToParam.startsWith('/')
          ? redirectToParam
          : (result.data?.redirectTo ?? '/dashboard');
      router.push(safeRedirect);
      router.refresh();
    });
  };

  return (
    <Card className="w-full max-w-md border-slate-200 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Masuk ke Akun Anda</CardTitle>
        <CardDescription>
          Gunakan email dan kata sandi resmi yang terdaftar (Owner, Admin, atau Staf).
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {resetParam === 'requested' && !serverError && (
            <div className="flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Permintaan pemulihan kata sandi telah diproses. Silakan masuk setelah mengatur ulang kata sandi Anda.
              </span>
            </div>
          )}

          {(serverError || errorParam === 'akun_nonaktif') && (
            <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>
                {serverError ??
                  'Akun Anda telah dinonaktifkan. Silakan hubungi Pemilik (Owner).'}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Alamat Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="nama@bisniskuliner.id"
                autoComplete="email"
                className="pl-9"
                disabled={isPending}
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-xs font-medium text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Kata Sandi</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Lupa kata sandi?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="pl-9"
                disabled={isPending}
                {...register('password')}
              />
            </div>
            {errors.password && (
              <p className="text-xs font-medium text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Memverifikasi Sesi...
              </>
            ) : (
              'Masuk ke Sistem'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function LoginFormSkeleton() {
  return (
    <Card className="w-full max-w-md border-slate-200 shadow-sm">
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      </CardContent>
      <CardFooter>
        <Skeleton className="h-9 w-full" />
      </CardFooter>
    </Card>
  );
}
