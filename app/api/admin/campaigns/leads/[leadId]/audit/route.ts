import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { runAndSaveAudit } from "@/lib/site-audit-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ leadId: string }> };

/**
 * POST /api/admin/campaigns/leads/[leadId]/audit
 * Re-run the audit for a single lead. Used when an audit failed or the data
 * is stale and you want fresh numbers right before a call.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { leadId } = await ctx.params;

  const { data: lead, error: lErr } = await auth.admin
    .from("apollo_leads")
    .select("id, domain, campaign_id")
    .eq("id", leadId)
    .maybeSingle();
  if (lErr || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.domain) return NextResponse.json({ error: "Lead has no domain" }, { status: 400 });

  await auth.admin
    .from("apollo_leads")
    .update({ audit_status: "running", audit_error: null })
    .eq("id", leadId);

  try {
    const out = await runAndSaveAudit(lead.domain);
    if ("error" in out) {
      await auth.admin
        .from("apollo_leads")
        .update({
          audit_status: "failed",
          audit_error: out.error.slice(0, 500),
          audited_at: new Date().toISOString(),
        })
        .eq("id", leadId);
      return NextResponse.json({ error: out.error }, { status: 502 });
    }

    await auth.admin
      .from("apollo_leads")
      .update({
        audit_status: "completed",
        audit_id: out.id,
        audit_score: out.audit?.scores?.overall ?? null,
        audit_error: null,
        audited_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return NextResponse.json({
      audit_id: out.id,
      score: out.audit?.scores?.overall ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    await auth.admin
      .from("apollo_leads")
      .update({ audit_status: "failed", audit_error: msg.slice(0, 500), audited_at: new Date().toISOString() })
      .eq("id", leadId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
