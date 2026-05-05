import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

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
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
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

async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
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

  const userId = await getUserId();
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

  const init: RequestInit = {
    method: req.method,
    headers: copyRequestHeaders(req.headers),
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
