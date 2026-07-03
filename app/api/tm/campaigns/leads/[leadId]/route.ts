import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireTmAccess } from "@/lib/tm/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ leadId: string }> };

const ALLOWED_CALL_STATUSES = new Set([
  "new",
  "called",
  "no_answer_1",
  "no_answer_2",
  "no_answer_3",
  "callback",
  "phone_missing",
  "answering_machine",
  "not_interested",
  "meeting_booked",
  "converted",
]);

// Accepts an ISO timestamp string or explicit null (to clear). Returns ok:false
// for anything else (including bad date strings) so we can 400.
function parseNullableTimestamp(v: unknown): { ok: boolean; value: string | null } {
  if (v === null) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, value: null };
  const t = Date.parse(v);
  return Number.isNaN(t)
    ? { ok: false, value: null }
    : { ok: true, value: new Date(t).toISOString() };
}

/**
 * PATCH /api/tm/campaigns/leads/[leadId] — TM operators can only update
 * the call workflow fields (call_status, call_notes, callback_at, meeting_at).
 * Requires TM operator token or admin session; everything else (audit state, contact data)
 * stays admin-only by virtue of not being patchable here.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = await requireTmAccess(req);
  if (denied) return denied;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }
  const { leadId } = await ctx.params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  const update: Record<string, unknown> = {};
  if (typeof body.call_status === "string") {
    if (!ALLOWED_CALL_STATUSES.has(body.call_status)) {
      return NextResponse.json({ error: "Invalid call_status" }, { status: 400 });
    }
    update.call_status = body.call_status;
    // Stamp when status changed so the stats chart can key on real status
    // history (not the touch-trigger's updated_at, which moves on any write).
    update.call_status_updated_at = new Date().toISOString();
  }
  if (typeof body.call_notes === "string") {
    update.call_notes = body.call_notes.slice(0, 4000);
  }
  // Use "key" in body (not typeof) so clients can send null to clear a schedule.
  if ("callback_at" in body) {
    const parsed = parseNullableTimestamp(body.callback_at);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Invalid callback_at" }, { status: 400 });
    }
    update.callback_at = parsed.value;
  }
  if ("meeting_at" in body) {
    const parsed = parseNullableTimestamp(body.meeting_at);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Invalid meeting_at" }, { status: 400 });
    }
    update.meeting_at = parsed.value;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("apollo_leads")
    .update(update)
    .eq("id", leadId)
    .select("id, call_status, call_notes, call_status_updated_at, callback_at, meeting_at, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
