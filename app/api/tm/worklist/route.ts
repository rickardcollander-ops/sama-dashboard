import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayStockholmIso } from "@/lib/tm/format";
import { requireTmAccess } from "@/lib/tm/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT =
  "id, company_name, domain, contact_first_name, contact_last_name, contact_phone, contact_email, audit_score, audit_id, call_status, callback_at, meeting_at, campaign_id, apollo_campaigns(name)";

// Flatten the embedded campaign (PostgREST returns it as object or array).
function shape(rows: unknown[]): unknown[] {
  return (rows as Record<string, unknown>[]).map((r) => {
    const embed = r.apollo_campaigns as { name?: string | null } | { name?: string | null }[] | null;
    const campaign_name = Array.isArray(embed) ? embed[0]?.name ?? null : embed?.name ?? null;
    const { apollo_campaigns: _omit, ...rest } = r;
    void _omit;
    return { ...rest, campaign_name };
  });
}

/**
 * GET /api/tm/worklist — the operator's "att ringa idag" queue, across all
 * campaigns (optionally scoped with ?campaign_id=). Three independently sorted
 * buckets so each is ordered by its own urgency. Requires TM operator token or admin session (see lib/tm/auth.ts).
 */
export async function GET(req: NextRequest) {
  const denied = await requireTmAccess(req);
  if (denied) return denied;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaign_id") || undefined;
  if (campaignId && !UUID_RE.test(campaignId)) {
    return NextResponse.json({ error: "Invalid campaign_id" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const todayStartIso = startOfTodayStockholmIso();

  // Overdue callbacks: a callback time that has already passed. Most overdue first.
  let dueCallbacksQ = admin
    .from("apollo_leads")
    .select(SELECT)
    .not("callback_at", "is", null)
    .lte("callback_at", nowIso);
  if (campaignId) dueCallbacksQ = dueCallbacksQ.eq("campaign_id", campaignId);

  // Today + upcoming booked meetings.
  let meetingsQ = admin
    .from("apollo_leads")
    .select(SELECT)
    .not("meeting_at", "is", null)
    .gte("meeting_at", todayStartIso);
  if (campaignId) meetingsQ = meetingsQ.eq("campaign_id", campaignId);

  // Fresh leads to call, highest audit score first.
  let newLeadsQ = admin.from("apollo_leads").select(SELECT).eq("call_status", "new");
  if (campaignId) newLeadsQ = newLeadsQ.eq("campaign_id", campaignId);

  const [dueCallbacks, meetings, newLeads] = await Promise.all([
    dueCallbacksQ.order("callback_at", { ascending: true }).limit(500),
    meetingsQ.order("meeting_at", { ascending: true }).limit(500),
    newLeadsQ.order("audit_score", { ascending: false, nullsFirst: false }).limit(200),
  ]);

  const firstErr = dueCallbacks.error || meetings.error || newLeads.error;
  if (firstErr) {
    return NextResponse.json({ error: firstErr.message }, { status: 500 });
  }

  return NextResponse.json({
    due_callbacks: shape(dueCallbacks.data ?? []),
    meetings: shape(meetings.data ?? []),
    new_leads: shape(newLeads.data ?? []),
  });
}
