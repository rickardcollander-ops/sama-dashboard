import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tm/overview — portfolio-wide TM stats for the "Översikt" tab:
 * cross-campaign totals + a per-campaign breakdown. Intentionally
 * unauthenticated, same posture as the rest of the /tm portal.
 */
export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  const { data, error } = await admin.rpc("get_tm_overview");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? { totals: null, campaigns: [] });
}
