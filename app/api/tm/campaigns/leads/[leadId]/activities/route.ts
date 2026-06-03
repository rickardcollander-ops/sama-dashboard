import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ leadId: string }> };

const ALLOWED_KINDS = new Set([
  "note",
  "status_change",
  "callback_set",
  "meeting_set",
]);

/**
 * POST /api/tm/campaigns/leads/[leadId]/activities — append one entry to a
 * lead's call log. Intentionally unauthenticated, same posture as the PATCH
 * route: only the call-workflow surface is writable.
 *
 * Security: campaign_id is derived server-side from the looked-up lead, never
 * taken from the request body, so a caller can't forge cross-campaign rows.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }
  const { leadId } = await ctx.params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  const kind = typeof body.kind === "string" && ALLOWED_KINDS.has(body.kind) ? body.kind : "note";
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
  const status = typeof body.status === "string" ? body.status.slice(0, 40) : null;
  const operator = typeof body.operator === "string" ? body.operator.trim().slice(0, 40) : null;

  // A plain note must carry text; structured kinds may be text-less.
  if (kind === "note" && !text) {
    return NextResponse.json({ error: "Note body required" }, { status: 400 });
  }

  // Derive campaign_id from the lead (never trust the client for it).
  const { data: lead, error: leadErr } = await admin
    .from("apollo_leads")
    .select("id, campaign_id")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: activity, error: insErr } = await admin
    .from("apollo_lead_activities")
    .insert({
      lead_id: leadId,
      campaign_id: lead.campaign_id,
      kind,
      body: text || null,
      status,
      operator: operator || null,
    })
    .select("id, kind, body, status, operator, created_at")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Mirror the latest note text into apollo_leads.call_notes so the activity
  // timeline preview and the call_notes-based selection predicate in
  // /api/tm/stats keep reflecting the most recent note. We intentionally do NOT
  // touch call_status_updated_at here — the stats chart buckets on status
  // history, and a note alone is not a status change.
  if (kind === "note" && text) {
    await admin.from("apollo_leads").update({ call_notes: text }).eq("id", leadId);
  }

  return NextResponse.json(activity);
}
