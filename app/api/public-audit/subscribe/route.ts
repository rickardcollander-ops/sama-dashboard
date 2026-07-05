import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { rateLimit, clientIp } from "@/lib/auth/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // Unauthenticated lead-capture endpoint — rate limit per IP to prevent
  // abuse (mirrors public-audit/route.ts's 3/hr pattern; this endpoint is
  // cheaper per-call so a slightly higher ceiling is fine).
  const rl = await rateLimit({
    key: `public-audit-subscribe:${ip}`,
    limit: Number(process.env.PUBLIC_AUDIT_SUBSCRIBE_RATE_LIMIT || "5"),
    windowMs: Number(process.env.PUBLIC_AUDIT_SUBSCRIBE_RATE_WINDOW_MS || `${60 * 60 * 1000}`),
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email: string = (body?.email || "").toString().trim().toLowerCase();
  const domain: string = (body?.domain || "").toString().trim().toLowerCase();
  const auditId: string | null = body?.audit_id ? String(body.audit_id) : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Ogiltig e-postadress" }, { status: 400 });
  }
  if (!domain || domain.length > 255) {
    return NextResponse.json({ error: "Ogiltig domän" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Fail-open in development: pretend it worked so the UI flow can be tested.
    console.warn("[public-audit/subscribe] Supabase not configured — lead not persisted");
    return NextResponse.json({ ok: true, persisted: false });
  }

  const admin = createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { error } = await admin.from("audit_leads").insert({
    email,
    domain,
    audit_id: auditId,
    user_agent: userAgent,
    source: "audit_landing",
  });

  // Treat unique-violation as success — already-subscribed shouldn't be a 500.
  if (error && error.code !== "23505") {
    console.error("[public-audit/subscribe] insert failed:", error);
    return NextResponse.json({ error: "Kunde inte spara — försök igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true });
}
