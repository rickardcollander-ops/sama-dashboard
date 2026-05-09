import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

/**
 * Headers a client could try to spoof. Stripped from the incoming request
 * before we re-inject server-resolved values, so a logged-in user can't
 * pretend to be a different account.
 */
const TENANT_HEADERS_TO_STRIP = [
  "x-sama-account-id",
  "x-sama-site-id",
  "x-sama-site-domain",
  "x-tenant-id",
];

/**
 * Emergency kill switch. Set BACKEND_PAUSED=1 in env to make the proxy
 * return 503 immediately for every request (no upstream traffic, no AI
 * cost). Useful when something runaway is consuming credits.
 */
const BACKEND_PAUSED = process.env.BACKEND_PAUSED === "1";

/**
 * Paths that may be expensive on the backend (AI/SerpAPI calls). Blocked
 * by default unless the request is explicitly user-initiated (sent with
 * the X-Sama-Intent: user-action header set by our own UI handlers) OR the
 * env var SAMA_ALLOW_EXPENSIVE_PATHS=1 is set.
 *
 * The substring patterns intentionally cover the analyze/generate/check
 * variants exposed by the backend agents — these are the ones that run
 * LLM/SerpAPI/etc. on every call.
 */
const EXPENSIVE_PATTERNS: RegExp[] = [
  /\/analyze(\b|\/|\?)/,
  /\/analyze-screenshot(\b|\/|\?)/,
  /\/generate(\b|\/|\?)/,
  /\/suggest-/,
  /\/recommendations(\b|\/|\?)/,
  /\/dashboard\/recommendations(\b|\/|\?)/,
  /\/automation\/(trigger|daily-workflow|run)/,
  /\/ai-visibility\/(check|recommendations)(\b|\/|\?)/,
  /\/seo\/serp\/analyze/,
  /\/agents\/[^/]+\/trigger/,
  /\/run(\b|\/|\?)/,
];
const ALLOW_EXPENSIVE = process.env.SAMA_ALLOW_EXPENSIVE_PATHS === "1";

/**
 * Optional GET endpoints — the dashboard polls these on every render but the
 * backend may not have them yet. When upstream returns 404, translate to a
 * 200 with an empty payload so the browser console isn't flooded with red
 * network errors that the UI already handles silently.
 */
const SOFT_404_PATTERNS: RegExp[] = [
  /^\/api\/activity(\b|\/|\?)/,
  /^\/api\/content\/stats(\b|\/|\?)/,
];

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function copyRequestHeaders(src: Headers): Headers {
  const out = new Headers();
  src.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (TENANT_HEADERS_TO_STRIP.includes(lower)) return;
    out.set(key, value);
  });
  return out;
}

function copyResponseHeaders(src: Headers): Headers {
  const out = new Headers();
  src.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "content-encoding") return;
    if (lower.startsWith("access-control-")) return;
    out.set(key, value);
  });
  return out;
}

/* ── Rate limiter (in-memory, per-process) ─────────────────────────────── */

interface Bucket {
  windowStart: number;
  count: number;
}
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60; // 1 req/sec average per user
const EXPENSIVE_MAX_PER_WINDOW = 5; // expensive paths: 5/min per user

function bucketKey(req: NextRequest, userId: string | null): string {
  const id = userId || req.headers.get("x-tenant-id") || req.headers.get("x-forwarded-for") || "anon";
  return id;
}

function rateLimit(key: string, limit: number): { ok: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { ok: true, remaining: limit - 1, reset: now + WINDOW_MS };
  }
  b.count += 1;
  const ok = b.count <= limit;
  return { ok, remaining: Math.max(0, limit - b.count), reset: b.windowStart + WINDOW_MS };
}

async function getCurrentUser(): Promise<{ id: string; email: string | null } | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

/* ── Tenant context resolution ─────────────────────────────────────────── */

interface TenantContext {
  accountId: string | null;
  siteId: string | null;
  siteDomain: string | null;
}

interface CachedContext extends TenantContext {
  expires: number;
}

const CONTEXT_TTL_MS = 30_000;
const contextCache = new Map<string, CachedContext>();

/**
 * Resolve the active account_id, site_id and site domain for an upstream
 * request. The client may pass `x-sama-account-id` / `x-sama-site-id` to
 * indicate which tenant it wants, but the server validates that against
 * `account_members` and `user_sites` and overwrites the headers with the
 * authoritative values before forwarding upstream.
 *
 * If no Supabase user is present we return all-null. The caller MUST then
 * either reject the request or forward without tenant headers — never trust
 * unauthenticated client-supplied identifiers, otherwise an unauthenticated
 * caller can browse any tenant by guessing the id.
 */
async function resolveTenantContext(
  req: NextRequest,
  user: { id: string; email: string | null } | null,
): Promise<TenantContext> {
  if (!user) {
    return { accountId: null, siteId: null, siteDomain: null };
  }

  const userId = user.id;
  const isAdmin = isAdminEmail(user.email);
  const requestedAccount = req.headers.get("x-sama-account-id") || userId;
  const requestedSite =
    req.headers.get("x-sama-site-id") ||
    req.headers.get("x-tenant-id") ||
    "";

  const cacheKey = `${userId}|${requestedAccount}|${requestedSite}`;
  const now = Date.now();
  const cached = contextCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return {
      accountId: cached.accountId,
      siteId: cached.siteId,
      siteDomain: cached.siteDomain,
    };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { accountId: requestedAccount, siteId: requestedSite || null, siteDomain: null };
  }

  // Admin "view-as" mode: the operator account browses other tenants'
  // data. Membership and ownership checks would otherwise fall back to
  // the admin's own account/site and silently leak admin data into the
  // customer view.
  let accountId: string | null = null;
  if (isAdmin) {
    accountId = requestedAccount;
  } else if (requestedAccount === userId) {
    accountId = userId;
  } else {
    const { data: membership } = await admin
      .from("account_members")
      .select("role")
      .eq("account_id", requestedAccount)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    accountId = membership ? requestedAccount : userId;
  }

  let siteRow: { id: string; settings: Record<string, unknown> | null } | null = null;
  if (requestedSite) {
    // Always require the site to belong to the resolved account, even
    // for admin. Skipping this check let a stale X-Sama-Site-Id from a
    // previous kundvy slip through and return another customer's data
    // when admin opened a freshly added customer.
    const { data } = await admin
      .from("user_sites")
      .select("id, settings, user_id")
      .eq("id", requestedSite)
      .eq("user_id", accountId)
      .maybeSingle();
    if (data) siteRow = { id: data.id, settings: data.settings };
  }
  if (!siteRow) {
    const { data } = await admin
      .from("user_sites")
      .select("id, settings")
      .eq("user_id", accountId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) siteRow = { id: data.id, settings: data.settings };
  }

  const siteId = siteRow?.id ?? null;
  const settings = (siteRow?.settings ?? {}) as Record<string, unknown>;
  const siteDomain =
    typeof settings.domain === "string"
      ? (settings.domain as string)
      : typeof settings.site_url === "string"
        ? (settings.site_url as string)
        : null;

  const ctx: TenantContext = { accountId, siteId, siteDomain };
  contextCache.set(cacheKey, { ...ctx, expires: now + CONTEXT_TTL_MS });
  return ctx;
}

async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (BACKEND_PAUSED) {
    return NextResponse.json(
      {
        error: "Backend paused via BACKEND_PAUSED env var",
        hint: "Unset BACKEND_PAUSED to resume.",
      },
      { status: 503 },
    );
  }

  const { path } = await params;
  if (!path || path.length === 0) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }
  const url = new URL(req.url);
  const fullPath = "/" + path.join("/");
  const target = `${BACKEND.replace(/\/$/, "")}/${path.join("/")}${url.search}`;

  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  const requireAuth = process.env.SAMA_PROXY_REQUIRE_AUTH !== "0";
  if (requireAuth && !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  const intent = req.headers.get("x-sama-intent");
  const isExpensive = EXPENSIVE_PATTERNS.some((re) => re.test(fullPath));

  // Per-user rate limit
  const key = bucketKey(req, userId);
  const limit = isExpensive ? EXPENSIVE_MAX_PER_WINDOW : MAX_PER_WINDOW;
  const rl = rateLimit(`${key}:${isExpensive ? "exp" : "std"}`, limit);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        path: fullPath,
        limit_per_minute: limit,
        retry_after_ms: rl.reset - Date.now(),
        hint: isExpensive
          ? "This path is treated as expensive (analyze/generate/recommendations). Slow down — too many calls in a short window can burn API credits."
          : "Slow down — too many requests in a short window.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(rl.remaining),
        },
      },
    );
  }

  // Block expensive endpoints unless explicitly allowed or user-initiated
  if (isExpensive && !ALLOW_EXPENSIVE && intent !== "user-action") {
    return NextResponse.json(
      {
        error: "Expensive endpoint blocked by default",
        path: fullPath,
        hint:
          "This path runs LLM/SerpAPI calls on the backend. To allow auto-fired hits, set SAMA_ALLOW_EXPENSIVE_PATHS=1. To allow on-click only, send 'X-Sama-Intent: user-action' from the UI handler.",
      },
      { status: 423 },
    );
  }

  const headers = copyRequestHeaders(req.headers);
  const tenant = await resolveTenantContext(req, user);
  if (tenant.accountId) {
    headers.set("X-Sama-Account-Id", tenant.accountId);
  }
  if (tenant.siteId) {
    headers.set("X-Sama-Site-Id", tenant.siteId);
    // Backward-compat: existing backend code reads X-Tenant-ID. Keep it in
    // sync with the resolved site so the new headers are additive, not
    // breaking.
    headers.set("X-Tenant-ID", tenant.siteId);
  }
  if (tenant.siteDomain) {
    headers.set("X-Sama-Site-Domain", tenant.siteDomain);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    return NextResponse.json(
      {
        error: "Upstream unreachable",
        detail: e instanceof Error ? e.message : String(e),
        target,
      },
      { status: 502 },
    );
  }

  const respHeaders = copyResponseHeaders(upstream.headers);
  respHeaders.set("X-RateLimit-Limit", String(limit));
  respHeaders.set("X-RateLimit-Remaining", String(rl.remaining));

  if (
    upstream.status === 404 &&
    req.method === "GET" &&
    SOFT_404_PATTERNS.some((re) => re.test(fullPath))
  ) {
    respHeaders.set("Content-Type", "application/json");
    respHeaders.delete("Content-Length");
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: respHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
