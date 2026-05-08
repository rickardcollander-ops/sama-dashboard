import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware. Replaces the obsolete `proxy.ts` (never wired into Next.js
 * because the file name was wrong) and the legacy MISSION_SECRET cookie path
 * (a plaintext-secret-as-session anti-pattern). Authentication for both the
 * customer portal (/c/*) and admin API routes is enforced server-side:
 *   - /c/* pages call `createSupabaseServerClient()` and gate on the user.
 *   - /api/admin/* routes go through `requireAdmin()` (lib/admin-guard.ts).
 *
 * This middleware only handles Supabase session refresh for /c/* and adds
 * baseline security headers on every response. Bot-friendly endpoints
 * (e.g. /api/public-audit) keep their own rate-limit at the route level.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

function applySecurityHeaders(res: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(name, value);
  }
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  return res;
}

async function refreshSupabaseSession(req: NextRequest): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/c/login", req.url));
  }

  try {
    const { createServerClient } = await import("@supabase/ssr");
    const res = NextResponse.next({ request: req });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/c/login", req.url));
    }

    return res;
  } catch {
    return NextResponse.redirect(new URL("/c/login", req.url));
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/c/") || pathname === "/c") {
    const PUBLIC_C_ROUTES = new Set([
      "/c/login",
      "/c/auth/callback",
      "/c/auth/reset-password",
      "/c/audit",
    ]);
    if (
      PUBLIC_C_ROUTES.has(pathname) ||
      pathname.startsWith("/c/audit/") ||
      pathname.startsWith("/c/auth/")
    ) {
      return applySecurityHeaders(NextResponse.next());
    }
    const res = await refreshSupabaseSession(req);
    return applySecurityHeaders(res);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
