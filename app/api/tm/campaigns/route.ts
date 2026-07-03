import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireTmAccess } from "@/lib/tm/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tm/campaigns — campaign index for the public TM portal.
 *
 * Requires the TM operator token or an admin session; it can read the
 * campaign list. Operators don't need accounts.
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

  const { data, error } = await admin
    .from("apollo_campaigns")
    .select(
      "id, name, source_filename, status, total_leads, audited_leads, failed_leads, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}
