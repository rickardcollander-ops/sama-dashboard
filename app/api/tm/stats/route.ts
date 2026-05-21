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

  // Count leads where call_status or call_notes were changed today.
  // updated_at is bumped by a DB trigger on every UPDATE. Leads that were
  // just imported have call_status = 'new'; operators change that field or
  // add call_notes, which bumps updated_at. We therefore count leads that
  // have been updated today AND have moved beyond the default 'new' state.
  const { count: statusCount, error: e1 } = await admin
    .from("apollo_leads")
    .select("id", { count: "exact", head: true })
    .gte("updated_at", todayStart.toISOString())
    .neq("call_status", "new");

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // Also capture leads that kept 'new' status but had notes added.
  const { count: notesCount, error: e2 } = await admin
    .from("apollo_leads")
    .select("id", { count: "exact", head: true })
    .gte("updated_at", todayStart.toISOString())
    .eq("call_status", "new")
    .not("call_notes", "is", null);

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({
    changes_today: (statusCount ?? 0) + (notesCount ?? 0),
  });
}
