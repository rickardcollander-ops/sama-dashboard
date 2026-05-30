import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMA_API_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

interface AutopilotConfig {
  enabled?: boolean;
  ideas_per_run?: number;
  auto_draft_top_n?: number;
  min_score_for_publish?: number;
  auto_publish?: boolean;
}

/**
 * Manual "Kör autopilot nu" trigger from /c/content. Mirrors the weekly
 * cron's content trigger but is gated on the user's Supabase session
 * rather than CRON_SECRET, and reads settings via RLS so a user can only
 * trigger their own site.
 *
 * The site's saved autopilot config drives the payload. If autopilot is
 * disabled on the site, we still allow the manual trigger and fall back
 * to sensible defaults — the button explicitly says "kör nu", so the
 * user is choosing to run a one-off regardless of cadence settings.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const siteId = typeof body?.site_id === "string" ? body.site_id : null;
  if (!siteId) {
    return NextResponse.json({ error: "site_id required" }, { status: 400 });
  }

  // RLS scopes to auth.uid() so this fails for sites the user doesn't own.
  const { data: site, error: siteErr } = await supabase
    .from("user_sites")
    .select("id, user_id, settings")
    .eq("id", siteId)
    .maybeSingle();
  if (siteErr) {
    return NextResponse.json({ error: siteErr.message }, { status: 500 });
  }
  if (!site) {
    return NextResponse.json({ error: "site not found" }, { status: 404 });
  }

  const settings = (site.settings ?? {}) as Record<string, unknown>;
  const ap = (settings.content_autopilot ?? {}) as AutopilotConfig;

  const target = `${SAMA_API_URL.replace(/\/$/, "")}/api/tenant/agents/content/trigger`;
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": site.user_id,
        "X-Sama-Site-Id": site.id,
        "X-Sama-Intent": "user-action",
      },
      body: JSON.stringify({
        source: "manual",
        ideas_per_run: ap.ideas_per_run ?? 6,
        auto_draft_top_n: ap.auto_draft_top_n ?? 3,
        auto_publish: ap.auto_publish ?? false,
        min_score_for_publish: ap.min_score_for_publish ?? 70,
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }

  const upstreamBody = await upstream.text();
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${upstreamBody.slice(0, 200)}` },
      { status: 502 },
    );
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(upstreamBody);
  } catch {
    /* upstream returned non-JSON — treat as opaque success */
  }
  return NextResponse.json({ ok: true, upstream: parsed });
}
