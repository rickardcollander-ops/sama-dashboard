import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { userCanAccessSite } from "@/lib/site-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenant_id");
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenant_id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reads go through the service-role client (bypasses RLS), so ownership of
  // the requested site must be verified here — otherwise any logged-in user
  // could read which Google account another tenant has connected.
  if (!(await userCanAccessSite(user, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const empty = {
    search_console: { connected: false },
    analytics: { connected: false },
    ads: { connected: false },
  };

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json(empty);

  const { data: rows } = await admin
    .from("google_tokens")
    .select("service, account_email")
    .eq("site_id", tenantId);

  const result: Record<string, { connected: boolean; account_email?: string | null }> = {
    ...empty,
  };

  for (const row of rows ?? []) {
    result[row.service] = { connected: true, account_email: row.account_email };
  }

  return NextResponse.json(result);
}
