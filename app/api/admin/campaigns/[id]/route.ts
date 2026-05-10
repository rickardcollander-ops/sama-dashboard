import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/campaigns/[id] — campaign detail with all leads. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const { data: campaign, error: cErr } = await auth.admin
    .from("apollo_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: leads, error: lErr } = await auth.admin
    .from("apollo_leads")
    .select("id, company_name, domain, contact_first_name, contact_last_name, contact_title, contact_email, contact_phone, industry, company_size, city, country, linkedin_url, audit_id, audit_status, audit_error, audit_score, audited_at, call_status, call_notes, pdf_sent_at, created_at")
    .eq("campaign_id", id)
    .order("company_name", { ascending: true });
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  return NextResponse.json({ campaign, leads: leads ?? [] });
}

/** DELETE /api/admin/campaigns/[id] — drop campaign and all its leads (CASCADE). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const { error } = await auth.admin.from("apollo_campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
