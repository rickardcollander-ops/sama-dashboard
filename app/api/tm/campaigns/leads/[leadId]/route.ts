import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ leadId: string }> };

const ALLOWED_CALL_STATUSES = new Set([
  "new",
  "called",
  "callback",
  "phone_missing",
  "answering_machine",
  "not_interested",
  "meeting_booked",
  "converted",
]);

/**
 * PATCH /api/tm/campaigns/leads/[leadId] — TM operators can only update
 * the call workflow fields. Intentionally unauthenticated; everything
 * else (audit state, contact data) stays admin-only by virtue of not
 * being patchable here.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
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
  }
  if (typeof body.call_notes === "string") {
    update.call_notes = body.call_notes.slice(0, 4000);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("apollo_leads")
    .update(update)
    .eq("id", leadId)
    .select("id, call_status, call_notes")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
