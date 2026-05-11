import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { signPdfToken } from "@/lib/apollo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ leadId: string }> };

/**
 * GET /api/admin/campaigns/leads/[leadId]/pdf
 *
 * Generates a signed token, asks sama-agent's Playwright service to render
 * /c/admin/campaigns/report/{leadId}?t=<token> to PDF, then streams the
 * binary back with a Content-Disposition that names the file after the
 * company. The token is single-use-ish (10 min TTL, HMAC-signed).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { leadId } = await ctx.params;

  const { data: lead, error } = await auth.admin
    .from("apollo_leads")
    .select("id, company_name, domain, audit_id, audit_status")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.audit_status !== "completed" || !lead.audit_id) {
    return NextResponse.json({ error: "Audit is not completed yet for this lead" }, { status: 409 });
  }

  const samaUrl = process.env.NEXT_PUBLIC_SAMA_API_URL || "";
  if (!samaUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SAMA_API_URL not configured" }, { status: 503 });
  }

  let token: string;
  try {
    token = await signPdfToken(leadId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token sign failed";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  // The report URL points back at this dashboard. We prefer the explicit
  // PUBLIC_DASHBOARD_URL, fall back to the request's own origin so this works
  // in both local dev and Vercel preview deploys.
  const dashboardOrigin = (process.env.PUBLIC_DASHBOARD_URL || new URL(req.url).origin).replace(/\/$/, "");
  const reportUrl = `${dashboardOrigin}/c/admin/campaigns/report/${leadId}?t=${encodeURIComponent(token)}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${samaUrl}/api/pdf/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Backend reuses the same SUPABASE_SERVICE_ROLE for trust between
        // dashboard ↔ agent — see SAMA_INTERNAL_TOKEN handling on the agent.
        ...(process.env.SAMA_INTERNAL_TOKEN ? { "X-Sama-Internal-Token": process.env.SAMA_INTERNAL_TOKEN } : {}),
      },
      body: JSON.stringify({
        url: reportUrl,
        format: "A4",
        wait_until: "networkidle",
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: `PDF service unreachable: ${msg}` }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `PDF render failed (HTTP ${upstream.status})`, detail: detail.slice(0, 500) },
      { status: 502 },
    );
  }

  const filename = sanitizeFilename(lead.company_name || lead.domain || leadId) + ".pdf";

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "sama-report";
}
