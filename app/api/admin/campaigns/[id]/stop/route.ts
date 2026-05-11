import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/campaigns/[id]/stop
 *
 * Stops a campaign that's currently being audited. Any leads in "running"
 * status are reset to "pending" so they can be picked up again later. The
 * client should also stop its runBatch() loop so no new /run calls fire.
 *
 * Note: a Vercel function that's already mid-flight cannot be killed from
 * the outside — it will finish (or hit its maxDuration) and update its
 * single lead normally. With BATCH_SIZE=1 that's at most one lead.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id: campaignId } = await ctx.params;

  const { error: lErr } = await auth.admin
    .from("apollo_leads")
    .update({ audit_status: "pending", audit_error: null })
    .eq("campaign_id", campaignId)
    .eq("audit_status", "running");
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  const { error: cErr } = await auth.admin
    .from("apollo_campaigns")
    .update({ status: "pending" })
    .eq("id", campaignId);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
