import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/env';
import { canAccessPath } from '@/lib/permissions';
import { createClient } from '@/utils/supabase/middleware';
import { UserRoleCode } from '@/types/database';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/api/health'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets & Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // If Supabase is not yet configured in .env.local, allow UI preview with setup banner
  if (!isSupabaseConfigured()) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  const { supabase, supabaseResponse } = createClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!user && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    if (pathname === '/' || pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Check role permissions on protected routes
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_code, is_active')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL('/login?error=akun_nonaktif', request.url)
      );
    }

    const userRole = profile.role_code as UserRoleCode;
    if (!canAccessPath(userRole, pathname)) {
      return NextResponse.redirect(
        new URL('/dashboard?error=akses_ditolak', request.url)
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
