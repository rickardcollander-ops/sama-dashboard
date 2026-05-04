import { NextRequest, NextResponse } from 'next/server';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Customer portal (/c/*) — Supabase Auth ──────────────────────────────────
  if (pathname.startsWith('/c/') || pathname === '/c') {
    // Always allow customer login page, auth callback, password reset, and
    // the public AI-readiness audit landing page.
    if (
      pathname === '/c/login' ||
      pathname === '/c/auth/callback' ||
      pathname === '/c/auth/reset-password' ||
      pathname === '/c/audit' ||
      pathname.startsWith('/c/audit/')
    ) {
      return NextResponse.next();
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL('/c/login', req.url));
    }

    try {
      const { createServerClient } = await import('@supabase/ssr');

      const supabaseResponse = NextResponse.next({ request: req });

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              req.cookies.set(name, value);
              supabaseResponse.cookies.set(name, value, options);
            });
          },
        },
      });

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.redirect(new URL('/c/login', req.url));
      }

      return supabaseResponse;
    } catch {
      return NextResponse.redirect(new URL('/c/login', req.url));
    }
  }

  // ── Public audit API endpoints — no auth ────────────────────────────────────
  if (pathname === '/api/public-audit' || pathname.startsWith('/api/public-audit/')) {
    return NextResponse.next();
  }

  // ── Admin dashboard (everything else) — MISSION_SECRET ───────────────────────
  if (pathname === '/login' || pathname.startsWith('/api/auth') || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get('sama_auth')?.value;
  const secret = process.env.MISSION_SECRET;

  if (!secret || cookie !== secret) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
