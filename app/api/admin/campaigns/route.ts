import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { parseApolloCsv, type ApolloLeadRow } from "@/lib/apollo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/campaigns — list all campaigns for the admin index page. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("apollo_campaigns")
    .select("id, name, source_filename, status, total_leads, audited_leads, failed_leads, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}

/**
 * POST /api/admin/campaigns
 * Body: { name: string, csv: string, source_filename?: string }
 * Parses the Apollo CSV server-side, inserts the campaign + leads, and
 * returns the new campaign id along with parse stats so the importer UI
 * can show "200 leads imported, 3 skipped (no domain)".
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(body?.name || "").trim();
  const csv = String(body?.csv || "");
  const sourceFilename = body?.source_filename ? String(body.source_filename) : null;

  if (!name) return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  if (!csv) return NextResponse.json({ error: "CSV body is empty" }, { status: 400 });
  if (csv.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "CSV is larger than 10 MB" }, { status: 413 });
  }

  const parsed = parseApolloCsv(csv);
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { error: "No usable rows in CSV (need a 'Company' or 'Website' column)", detected: parsed.detectedColumns },
      { status: 400 },
    );
  }

  // Insert campaign first so we have the id for FK on leads.
  const { data: campaign, error: campErr } = await auth.admin
    .from("apollo_campaigns")
    .insert({
      name,
      source_filename: sourceFilename,
      created_by: auth.userId,
      total_leads: parsed.rows.length,
      status: "pending",
    })
    .select("id")
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({ error: campErr?.message || "Could not create campaign" }, { status: 500 });
  }

  // Dedupe by domain in-memory: campaign_id is brand new for this request, so
  // the only possible collisions are repeated domains inside this CSV. We can't
  // delegate to a DB upsert because the unique index on (campaign_id, domain)
  // is partial (WHERE domain IS NOT NULL) and PostgREST can't infer partial
  // indexes for ON CONFLICT.
  const seenDomains = new Set<string>();
  const leadRows = parsed.rows
    .map((r: ApolloLeadRow) => ({
      campaign_id: campaign.id,
      company_name: r.company_name,
      domain: r.domain,
      contact_first_name: r.contact_first_name,
      contact_last_name: r.contact_last_name,
      contact_title: r.contact_title,
      contact_email: r.contact_email,
      contact_phone: r.contact_phone,
      industry: r.industry,
      company_size: r.company_size,
      city: r.city,
      country: r.country,
      linkedin_url: r.linkedin_url,
      raw: r.raw,
      audit_status: r.domain ? "pending" : "skipped",
      audit_error: r.domain ? null : "No domain in CSV row",
    }))
    .filter((r) => {
      if (!r.domain) return true;
      if (seenDomains.has(r.domain)) return false;
      seenDomains.add(r.domain);
      return true;
    });

  const { error: leadsErr, count: insertedCount } = await auth.admin
    .from("apollo_leads")
    .insert(leadRows, { count: "exact" });

  if (leadsErr) {
    // Roll back the campaign so the admin can retry without orphaned rows.
    await auth.admin.from("apollo_campaigns").delete().eq("id", campaign.id);
    return NextResponse.json({ error: `Could not insert leads: ${leadsErr.message}` }, { status: 500 });
  }

  // Refresh total to reflect the actual inserted count after dedup.
  const skippedNoDomain = leadRows.filter((r) => r.audit_status === "skipped").length;
  await auth.admin
    .from("apollo_campaigns")
    .update({ total_leads: insertedCount ?? leadRows.length, failed_leads: skippedNoDomain })
    .eq("id", campaign.id);

  return NextResponse.json({
    campaign_id: campaign.id,
    inserted: insertedCount ?? leadRows.length,
    skipped_csv_rows: parsed.skipped,
    skipped_no_domain: skippedNoDomain,
    detected_columns: parsed.detectedColumns,
  });
}
