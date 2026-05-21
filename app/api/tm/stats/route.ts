import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Fetch all leads touched by a TM operator today.
  // Proxy for "operator touched": call_status moved beyond 'new', or notes were added.
  // updated_at is bumped by a DB trigger on every UPDATE.
  const { data, error } = await admin
    .from("apollo_leads")
    .select(
      "id, company_name, call_status, call_notes, updated_at, campaign_id",
    )
    .gte("updated_at", todayStart.toISOString())
    .or("call_status.neq.new,call_notes.not.is.null")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leads = data ?? [];

  // Aggregate by call_status
  const by_status: Record<string, number> = {};
  for (const lead of leads) {
    by_status[lead.call_status] = (by_status[lead.call_status] ?? 0) + 1;
  }

  return NextResponse.json({
    changes_today: leads.length,
    by_status,
    recent: leads.slice(0, 20),
  });
}
