import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-guard";
import { runAndSaveAudit } from "@/lib/site-audit-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Pro = 300s. Each audit ~30-60s, so we'll knock out ~4-8 leads per
// invocation, then the client re-fires this endpoint until the queue is empty.
export const maxDuration = 300;

const BATCH_SIZE = Number(process.env.APOLLO_BATCH_SIZE || "8");

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/campaigns/[id]/run
 *
 * Picks up to BATCH_SIZE pending leads in the campaign, runs the site-audit
 * for each one sequentially, and updates the row with the result. Returns
 * the new campaign counters so the UI can decide whether to re-fire.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id: campaignId } = await ctx.params;

  // Mark campaign as running (idempotent).
  await auth.admin
    .from("apollo_campaigns")
    .update({ status: "running" })
    .eq("id", campaignId);

  // Grab a batch of pending leads (with a domain — skipped rows stay skipped).
  const { data: pendingLeads, error: pErr } = await auth.admin
    .from("apollo_leads")
    .select("id, domain, company_name")
    .eq("campaign_id", campaignId)
    .eq("audit_status", "pending")
    .not("domain", "is", null)
    .limit(BATCH_SIZE);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!pendingLeads || pendingLeads.length === 0) {
    // No work left — finalize status.
    const counters = await refreshCounters(auth.admin, campaignId);
    return NextResponse.json({ ran: 0, ...counters });
  }

  // Mark them as running so a concurrent re-fire doesn't pick them up again.
  const ids = pendingLeads.map((l) => l.id);
  await auth.admin
    .from("apollo_leads")
    .update({ audit_status: "running", audit_error: null })
    .in("id", ids);

  let ran = 0;
  let failed = 0;

  for (const lead of pendingLeads) {
    if (!lead.domain) continue;
    try {
      const out = await runAndSaveAudit(lead.domain);
      if ("error" in out) {
        failed++;
        await auth.admin
          .from("apollo_leads")
          .update({
            audit_status: "failed",
            audit_error: out.error.slice(0, 500),
            audited_at: new Date().toISOString(),
          })
          .eq("id", lead.id);
      } else {
        ran++;
        await auth.admin
          .from("apollo_leads")
          .update({
            audit_status: "completed",
            audit_id: out.id,
            audit_score: out.audit?.scores?.overall ?? null,
            audit_error: null,
            audited_at: new Date().toISOString(),
          })
          .eq("id", lead.id);
      }
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : "unknown error";
      await auth.admin
        .from("apollo_leads")
        .update({
          audit_status: "failed",
          audit_error: msg.slice(0, 500),
          audited_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
    }
  }

  const counters = await refreshCounters(auth.admin, campaignId);
  // Spread counters first so the per-batch counts (`ran` / `failed_in_batch`)
  // win when keys collide. The client uses the per-batch counts to decide
  // whether to fire another batch immediately.
  return NextResponse.json({ ...counters, ran, failed_in_batch: failed, batch_size: pendingLeads.length });
}

async function refreshCounters(admin: SupabaseClient, campaignId: string) {
  const [{ count: total }, { count: completed }, { count: failed }, { count: running }] = await Promise.all([
    admin.from("apollo_leads").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    admin.from("apollo_leads").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("audit_status", "completed"),
    admin.from("apollo_leads").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("audit_status", "failed"),
    admin.from("apollo_leads").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).in("audit_status", ["pending", "running"]),
  ]);

  const totalCount = total ?? 0;
  const completedCount = completed ?? 0;
  const failedCount = failed ?? 0;
  const stillRunning = (running ?? 0) > 0;

  await admin
    .from("apollo_campaigns")
    .update({
      audited_leads: completedCount,
      failed_leads: failedCount,
      status: stillRunning ? "running" : (failedCount > 0 && completedCount === 0 ? "failed" : "completed"),
    })
    .eq("id", campaignId);

  return {
    total: totalCount,
    completed: completedCount,
    failed: failedCount,
    pending: Math.max(totalCount - completedCount - failedCount, 0),
  };
}

