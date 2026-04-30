import { NextRequest, NextResponse } from 'next/server';

const CUSTOMER_HOST =
  process.env.NEXT_PUBLIC_CUSTOMER_HOST || 'sama.successifier.com';

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ── Legacy /c/* URLs — bounce to the customer subdomain ────────────────────
  if (pathname === '/c' || pathname.startsWith('/c/')) {
    const newPath = pathname === '/c' ? '/' : pathname.replace(/^\/c/, '');
    return NextResponse.redirect(`https://${CUSTOMER_HOST}${newPath}${search}`, 308);
  }

  // ── Admin dashboard — MISSION_SECRET ───────────────────────────────────────
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
