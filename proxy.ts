import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js 16 ``proxy`` (replaces the deprecated ``middleware`` convention).
 *
 * Authentication for both the customer portal (/c/*) and admin API routes
 * is enforced server-side:
 *   - /c/* pages refresh the Supabase session here and redirect to /c/login
 *     when no user is present.
 *   - /api/admin/* routes go through ``requireAdmin()`` (lib/admin-guard.ts).
 *
 * This proxy also adds baseline security headers on every response. Public
 * endpoints (e.g. /api/public-audit) keep their own rate-limit at the route
 * level.
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

/**
 * Refreshes the Supabase access-token cookie and reports whether a valid user
 * is present. Never throws or redirects — callers decide what to do with an
 * unauthenticated request (pages redirect to /c/login; API routes pass through
 * so the handler can return proper JSON).
 */
async function refreshSupabaseSession(
  req: NextRequest,
): Promise<{ res: NextResponse; authed: boolean }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const res = NextResponse.next({ request: req });

  if (!supabaseUrl || !supabaseAnonKey) {
    return { res, authed: false };
  }

  try {
    const { createServerClient } = await import("@supabase/ssr");

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

    return { res, authed: Boolean(user) };
  } catch {
    return { res, authed: false };
  }
}

export async function proxy(req: NextRequest) {
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
    const { res, authed } = await refreshSupabaseSession(req);
    if (!authed) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/c/login", req.url)));
    }
    return applySecurityHeaders(res);
  }

  // Admin API routes enforce auth via requireAdmin() -> supabase.auth.getUser(),
  // but — unlike /c/* pages and the /api/sama proxy (which refreshes per
  // request) — nothing refreshes their access-token cookie. Once the ~1h token
  // lapses that read returns no user and the route 401s even for a signed-in
  // admin. Refresh here so the handler sees a fresh cookie; never redirect,
  // since the handler already returns proper 401/403 JSON.
  if (pathname.startsWith("/api/admin/")) {
    const { res } = await refreshSupabaseSession(req);
    return applySecurityHeaders(res);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
