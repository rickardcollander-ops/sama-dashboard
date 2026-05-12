import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ leadId: string }> };

const ALLOWED_CALL_STATUSES = new Set([
  "new", "called", "callback", "phone_missing", "not_interested", "meeting_booked", "converted",
]);

/** PATCH /api/admin/campaigns/leads/[leadId] — update call status / notes. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
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
  if (body.pdf_sent === true) {
    update.pdf_sent_at = new Date().toISOString();
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("apollo_leads")
    .update(update)
    .eq("id", leadId)
    .select("id, call_status, call_notes, pdf_sent_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
