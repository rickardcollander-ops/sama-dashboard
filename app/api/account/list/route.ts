import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface AccessibleAccount {
  account_id: string;
  role: "owner" | "admin" | "member";
  brand_name: string | null;
  domain: string | null;
  owner_email: string | null;
}

/**
 * Lists every account the calling user has active membership in. Used by the
 * dashboard to populate the account switcher in the sidebar.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  // Self-heal: own row exists.
  await admin
    .from("account_members")
    .upsert(
      {
        account_id: user.id,
        user_id: user.id,
        role: "owner",
        status: "active",
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "account_id,user_id" },
    );

  const { data: rows, error } = await admin
    .from("account_members")
    .select("account_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (rows ?? []).map((r) => r.account_id);
  if (ids.length === 0) {
    return NextResponse.json({ accounts: [] as AccessibleAccount[] });
  }

  const { data: settings } = await admin
    .from("user_settings")
    .select("user_id, settings")
    .in("user_id", ids);

  const settingsById = new Map<string, { brand_name?: string; domain?: string }>();
  for (const row of settings ?? []) {
    const s = (row as { user_id: string; settings: Record<string, unknown> }).settings || {};
    settingsById.set((row as { user_id: string }).user_id, {
      brand_name: typeof s.brand_name === "string" ? s.brand_name : undefined,
      domain: typeof s.domain === "string" ? s.domain : undefined,
    });
  }

  const ownerEmails = new Map<string, string | null>();
  for (const id of ids) {
    if (id === user.id) {
      ownerEmails.set(id, user.email ?? null);
      continue;
    }
    const { data } = await admin.auth.admin.getUserById(id);
    ownerEmails.set(id, data?.user?.email ?? null);
  }

  const accounts: AccessibleAccount[] = (rows ?? []).map((r) => ({
    account_id: r.account_id,
    role: r.role,
    brand_name: settingsById.get(r.account_id)?.brand_name ?? null,
    domain: settingsById.get(r.account_id)?.domain ?? null,
    owner_email: ownerEmails.get(r.account_id) ?? null,
  }));

  // Owners first, then alphabetical by brand/domain/email.
  accounts.sort((a, b) => {
    if (a.account_id === user.id) return -1;
    if (b.account_id === user.id) return 1;
    const aLabel = a.brand_name || a.domain || a.owner_email || a.account_id;
    const bLabel = b.brand_name || b.domain || b.owner_email || b.account_id;
    return aLabel.localeCompare(bLabel);
  });

  return NextResponse.json({ accounts });
}
