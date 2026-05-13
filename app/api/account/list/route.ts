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

function selfOnly(user: {
  id: string;
  email?: string | null;
}): AccessibleAccount[] {
  return [
    {
      account_id: user.id,
      role: "owner",
      brand_name: null,
      domain: null,
      owner_email: user.email ?? null,
    },
  ];
}

/**
 * Lists every account the calling user has active membership in. Used by the
 * dashboard to populate the account switcher in the sidebar.
 *
 * Once we know who the user is, this route never returns 5xx — any downstream
 * failure (Supabase outage, RLS surprise, missing service role key, etc.)
 * collapses to a self-only response so the dashboard always loads. The error
 * is still logged on the server for ops visibility.
 */
export async function GET() {
  // 1) Resolve the calling user. We can't fall back without one.
  let user: { id: string; email?: string | null } | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user
      ? { id: data.user.id, email: data.user.email ?? null }
      : null;
  } catch (e) {
    console.error("[account/list] auth lookup failed:", e);
  }
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Best-effort lookup. From here on, every failure path returns 200 with
  //    the self-only fallback so the UI can still render the switcher.
  const currentUser = user;
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      console.warn("[account/list] SUPABASE_SERVICE_ROLE_KEY not configured");
      return NextResponse.json({ accounts: selfOnly(currentUser) });
    }

    // Self-heal: own row exists. A schema mismatch (e.g. partial unique
    // index incompatible with PostgREST upsert) shouldn't take the whole
    // endpoint down — the trigger-based seed already covers new users.
    try {
      await admin
        .from("account_members")
        .upsert(
          {
            account_id: currentUser.id,
            user_id: currentUser.id,
            role: "owner",
            status: "active",
            accepted_at: new Date().toISOString(),
          },
          { onConflict: "account_id,user_id" },
        );
    } catch (e) {
      console.error("[account/list] self-heal upsert failed:", e);
    }

    let rows: { account_id: string; role: AccessibleAccount["role"] }[] = [];
    try {
      const res = await admin
        .from("account_members")
        .select("account_id, role")
        .eq("user_id", currentUser.id)
        .eq("status", "active");
      if (res.error) {
        console.error("[account/list] account_members query failed:", res.error);
        return NextResponse.json({ accounts: selfOnly(currentUser) });
      }
      rows = (res.data ?? []) as typeof rows;
    } catch (e) {
      console.error("[account/list] account_members threw:", e);
      return NextResponse.json({ accounts: selfOnly(currentUser) });
    }

    const ids = rows.map((r) => r.account_id);
    if (ids.length === 0) {
      return NextResponse.json({ accounts: selfOnly(currentUser) });
    }

    // Primary source: user_sites (current table). Use the first/primary site
    // per account for brand_name and domain displayed in the account switcher.
    const settingsById = new Map<string, { brand_name?: string; domain?: string }>();
    try {
      const res = await admin
        .from("user_sites")
        .select("user_id, site_name, settings")
        .in("user_id", ids)
        .order("created_at", { ascending: true });
      for (const row of res.data ?? []) {
        const r = row as { user_id: string; site_name: string; settings: Record<string, unknown> };
        // Only store the first (primary) site per account.
        if (!settingsById.has(r.user_id)) {
          const s = r.settings || {};
          settingsById.set(r.user_id, {
            brand_name: (s.brand_name as string) || r.site_name || undefined,
            domain: (s.domain as string) || undefined,
          });
        }
      }
    } catch (e) {
      console.error("[account/list] user_sites lookup threw:", e);
    }

    // Fallback: user_settings (legacy) for accounts not found in user_sites.
    const missingIds = ids.filter((id) => !settingsById.has(id));
    if (missingIds.length > 0) {
      try {
        const res = await admin
          .from("user_settings")
          .select("user_id, settings")
          .in("user_id", missingIds);
        for (const row of res.data ?? []) {
          const r = row as { user_id: string; settings: Record<string, unknown> };
          const s = r.settings || {};
          settingsById.set(r.user_id, {
            brand_name: typeof s.brand_name === "string" ? s.brand_name : undefined,
            domain: typeof s.domain === "string" ? s.domain : undefined,
          });
        }
      } catch (e) {
        console.error("[account/list] user_settings fallback threw:", e);
      }
    }

    const ownerEmails = new Map<string, string | null>();
    for (const id of ids) {
      if (id === currentUser.id) {
        ownerEmails.set(id, currentUser.email ?? null);
        continue;
      }
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        ownerEmails.set(id, data?.user?.email ?? null);
      } catch (e) {
        console.error("[account/list] getUserById failed for", id, e);
        ownerEmails.set(id, null);
      }
    }

    const accounts: AccessibleAccount[] = rows.map((r) => ({
      account_id: r.account_id,
      role: r.role,
      brand_name: settingsById.get(r.account_id)?.brand_name ?? null,
      domain: settingsById.get(r.account_id)?.domain ?? null,
      owner_email: ownerEmails.get(r.account_id) ?? null,
    }));

    // Owners first, then alphabetical by brand/domain/email.
    accounts.sort((a, b) => {
      if (a.account_id === currentUser.id) return -1;
      if (b.account_id === currentUser.id) return 1;
      const aLabel = a.brand_name || a.domain || a.owner_email || a.account_id;
      const bLabel = b.brand_name || b.domain || b.owner_email || b.account_id;
      return aLabel.localeCompare(bLabel);
    });

    return NextResponse.json({ accounts });
  } catch (e) {
    console.error("[account/list] unexpected error:", e);
    return NextResponse.json({ accounts: selfOnly(currentUser) });
  }
}
