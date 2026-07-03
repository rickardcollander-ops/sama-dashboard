import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireTmAccess } from "@/lib/tm/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tm/overview — portfolio-wide TM stats for the "Översikt" tab:
 * cross-campaign totals + a per-campaign breakdown. Requires the TM
 * operator token or an admin session, same as the rest of the /tm portal.
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

  const { data, error } = await admin.rpc("get_tm_overview");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? { totals: null, campaigns: [] });
}
