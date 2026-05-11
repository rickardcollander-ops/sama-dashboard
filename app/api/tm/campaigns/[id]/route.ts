import { NextRequest, NextResponse } from "next/server";
import { requireTmAccess } from "@/lib/tm-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/tm/campaigns/[id] — campaign + leads for the TM portal.
 *
 * Returns the subset of lead columns a TM operator actually needs:
 * contact details, score, call status and notes. No audit error or
 * raw row payload — those are admin-only.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireTmAccess();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const { data: campaign, error: cErr } = await auth.admin
    .from("apollo_campaigns")
    .select(
      "id, name, source_filename, status, total_leads, audited_leads, failed_leads, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: leads, error: lErr } = await auth.admin
    .from("apollo_leads")
    .select(
      "id, company_name, domain, contact_first_name, contact_last_name, contact_title, contact_email, contact_phone, industry, company_size, city, country, linkedin_url, audit_score, audited_at, call_status, call_notes",
    )
    .eq("campaign_id", id)
    .order("company_name", { ascending: true });
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  return NextResponse.json({ campaign, leads: leads ?? [] });
}
