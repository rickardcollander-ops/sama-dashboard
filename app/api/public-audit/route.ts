import { NextRequest, NextResponse } from "next/server";
import { savePublicAudit } from "@/lib/public-audit-store";
import { rateLimit, clientIp } from "@/lib/auth/rateLimit";
import type { SiteAuditRun } from "@/app/c/analysis/audit-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";
const PUBLIC_TENANT_ID = process.env.PUBLIC_AUDIT_TENANT_ID || "public";
const PUBLIC_MAX_PAGES = Number(process.env.PUBLIC_AUDIT_MAX_PAGES || "5");

// Public audit fires LLM + scraper jobs and is unauthenticated, so it's the
// most attractive cost-burning vector on the platform. Two layers of defence:
//   1. Cloudflare Turnstile token verification (when CAPTCHA enforcement is on).
//   2. Per-IP rate limit (3 audits / hour by default).
const REQUIRE_CAPTCHA = process.env.PUBLIC_AUDIT_REQUIRE_CAPTCHA === "1";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || "";

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!REQUIRE_CAPTCHA) return true;
  if (!TURNSTILE_SECRET) {
    console.warn("[public-audit] PUBLIC_AUDIT_REQUIRE_CAPTCHA=1 but TURNSTILE_SECRET_KEY missing");
    return false;
  }
  if (!token) return false;
  try {
    const form = new URLSearchParams({
      secret: TURNSTILE_SECRET,
      response: token,
      remoteip: ip,
    });
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 50_000;

function normalizeDomain(input: string): { url: string; host: string } | null {
  if (!input) return null;
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return null; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return null;
    if (a === 169 && b === 254) return null;
    if (a === 172 && b >= 16 && b <= 31) return null;
    if (a === 192 && b === 168) return null;
  }
  return { url: parsed.toString(), host };
}

async function startBackendAudit(domain: string): Promise<{ id: string } | { error: string; status: number }> {
  try {
    const upstream = await fetch(`${SAMA_API_URL}/api/site-audit/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": PUBLIC_TENANT_ID,
      },
      body: JSON.stringify({ domain, max_pages: PUBLIC_MAX_PAGES }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = (data as { detail?: string; error?: string }).detail
        || (data as { error?: string }).error;
      return { error: detail || `Backend HTTP ${upstream.status}`, status: upstream.status };
    }
    if (!data?.id) return { error: "Backend returnerade inget audit-id", status: 502 };
    return { id: data.id as string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "okänt fel";
    return { error: `Kunde inte starta audit: ${msg}`, status: 502 };
  }
}

async function pollBackendAudit(runId: string): Promise<SiteAuditRun | { error: string }> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/site-audit/runs/${runId}`, {
        headers: { "X-Tenant-ID": PUBLIC_TENANT_ID },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const data = (await res.json()) as SiteAuditRun;
        if (data?.status && data.status !== "running") {
          if (data.status === "failed") return { error: data.error || "Audit misslyckades" };
          return data;
        }
      }
    } catch {
      // transient — keep polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { error: "Audit tog för lång tid (timeout)" };
}

function suggestQueries(audit: SiteAuditRun, host: string): string[] {
  const brand = host.replace(/^www\./, "").split(".")[0].replace(/-/g, " ");
  const home = audit.pages.find((p) => {
    try { return new URL(p.url).pathname === "/"; } catch { return false; }
  }) || audit.pages[0];
  const titleHint = (home?.title || "").split(/[|\-–—]/)[0].trim().toLowerCase();
  const topic = titleHint && titleHint.length > 4 && titleHint.length < 60 ? titleHint : brand;

  return [
    `Vilket är det bästa alternativet till ${brand}?`,
    `${brand} recensioner och omdömen 2026`,
    `${brand} vs konkurrenter – vad ska jag välja?`,
    `Bästa verktygen för ${topic}`,
    `Är ${brand} värt pengarna?`,
  ];
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // Per-IP rate limit. 3 audits / hour by default; override with
  // PUBLIC_AUDIT_RATE_LIMIT (count) and PUBLIC_AUDIT_RATE_WINDOW_MS.
  const rl = await rateLimit({
    key: `public-audit:${ip}`,
    limit: Number(process.env.PUBLIC_AUDIT_RATE_LIMIT || "3"),
    windowMs: Number(process.env.PUBLIC_AUDIT_RATE_WINDOW_MS || `${60 * 60 * 1000}`),
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "För många försök. Försök igen senare." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const target = normalizeDomain((body?.domain || "").toString());
  if (!target) {
    return NextResponse.json({ error: "Ogiltig domän. Ange t.ex. exempel.se" }, { status: 400 });
  }

  // Captcha gating. Off by default so existing UI keeps working until the
  // Turnstile widget is wired up; flip PUBLIC_AUDIT_REQUIRE_CAPTCHA=1 to enforce.
  const captchaToken = (body?.captcha_token ?? body?.["cf-turnstile-response"] ?? "").toString();
  const captchaOk = await verifyTurnstile(captchaToken, ip);
  if (!captchaOk) {
    return NextResponse.json(
      { error: "Captcha krävs. Ladda om sidan och försök igen." },
      { status: 403 },
    );
  }

  if (!SAMA_API_URL) {
    return NextResponse.json(
      { error: "Audit-backend är inte konfigurerad (NEXT_PUBLIC_SAMA_API_URL saknas)." },
      { status: 503 },
    );
  }

  // Start the backend audit
  const started = await startBackendAudit(target.host);
  if ("error" in started) {
    return NextResponse.json({ error: started.error }, { status: started.status });
  }

  // Poll until completion (or timeout)
  const audit = await pollBackendAudit(started.id);
  if ("error" in audit) {
    return NextResponse.json({ error: audit.error }, { status: 504 });
  }

  const result = {
    domain: target.host,
    fetched_at: new Date().toISOString(),
    audit,
    suggested_queries: suggestQueries(audit, target.host),
  };

  // Persist for shareable URL — fail open if Supabase isn't configured.
  const id = await savePublicAudit(result).catch(() => null);

  return NextResponse.json({ ...result, id: id ?? undefined });
}
