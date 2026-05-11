import { NextResponse } from "next/server";
import { requireTmAccess } from "@/lib/tm-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tm/campaigns — campaign index for the TM portal. */
export async function GET() {
  const auth = await requireTmAccess();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("apollo_campaigns")
    .select(
      "id, name, source_filename, status, total_leads, audited_leads, failed_leads, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}
