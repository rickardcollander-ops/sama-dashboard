import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

interface SiteSummary {
  id: string;
  site_name: string;
  brand_name: string | null;
  domain: string | null;
}

interface AccountRow {
  id: string;
  email: string | undefined;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  brand_name: string | null;
  domain: string | null;
  has_settings: boolean;
  last_seen_at: string | null;
  sites: SiteSummary[];
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  // Page through users (Supabase admin caps at 1000 per page)
  const accounts: AccountRow[] = [];
  let page = 1;
  const perPage = 200;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const u of data.users) {
      accounts.push({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        brand_name: null,
        domain: null,
        has_settings: false,
        last_seen_at: null,
        sites: [],
      });
    }
    if (data.users.length < perPage) break;
    page += 1;
    if (page > 50) break; // hard ceiling
  }

  // Enrich with brand info from user_settings
  if (accounts.length > 0) {
    const ids = accounts.map((a) => a.id);
    const { data: settings } = await admin
      .from("user_settings")
      .select("user_id, settings")
      .in("user_id", ids);
    const byId = new Map<string, { brand_name?: string; domain?: string }>();
    for (const row of settings ?? []) {
      const s = (row as { user_id: string; settings: Record<string, unknown> }).settings || {};
      byId.set((row as { user_id: string }).user_id, {
        brand_name: typeof s.brand_name === "string" ? s.brand_name : undefined,
        domain: typeof s.domain === "string" ? s.domain : undefined,
      });
    }
    for (const a of accounts) {
      const match = byId.get(a.id);
      if (match) {
        a.brand_name = match.brand_name ?? null;
        a.domain = match.domain ?? null;
        a.has_settings = true;
      }
    }

    // Enrich with all connected sites from user_sites. By convention the
    // primary site uses id === user_id; any additional rows are extra
    // brands/domains the user has added.
    const { data: sitesData } = await admin
      .from("user_sites")
      .select("id, user_id, site_name, settings")
      .in("user_id", ids);
    if (sitesData) {
      const sitesByUser = new Map<string, SiteSummary[]>();
      for (const row of sitesData as Array<{
        id: string;
        user_id: string;
        site_name: string;
        settings: Record<string, unknown> | null;
      }>) {
        const s = row.settings || {};
        const summary: SiteSummary = {
          id: row.id,
          site_name: row.site_name || "",
          brand_name: typeof s.brand_name === "string" ? s.brand_name : null,
          domain: typeof s.domain === "string" ? s.domain : null,
        };
        const list = sitesByUser.get(row.user_id) ?? [];
        list.push(summary);
        sitesByUser.set(row.user_id, list);
      }
      for (const a of accounts) {
        const list = sitesByUser.get(a.id) ?? [];
        // Sort so the primary (id === user_id) comes first, then by name.
        list.sort((x, y) => {
          if (x.id === a.id) return -1;
          if (y.id === a.id) return 1;
          return (x.site_name || "").localeCompare(y.site_name || "");
        });
        a.sites = list;
        // Fall back to the primary site when user_settings has no brand
        // (admin-created accounts only write to user_sites).
        const primary = list[0];
        if (primary) {
          if (!a.brand_name) a.brand_name = primary.brand_name ?? primary.site_name ?? null;
          if (!a.domain) a.domain = primary.domain ?? null;
          a.has_settings = true;
        }
      }
    }

    // Enrich with presence (last_seen_at)
    const { data: presence } = await admin
      .from("user_presence")
      .select("user_id, last_seen_at")
      .in("user_id", ids);
    if (presence) {
      const presenceById = new Map<string, string>();
      for (const row of presence as Array<{ user_id: string; last_seen_at: string }>) {
        presenceById.set(row.user_id, row.last_seen_at);
      }
      for (const a of accounts) {
        a.last_seen_at = presenceById.get(a.id) ?? null;
      }
    }
  }

  accounts.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return NextResponse.json({ accounts, total: accounts.length });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";

  let userId: string;
  let invited = false;

  if (email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || new URL(req.url).origin;
    const redirectTo = `${appUrl}/c/auth/reset-password`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    userId = data.user.id;
    invited = true;
  } else {
    // No email supplied — generate an internal placeholder so the auth row exists
    // but no invite is sent. Admin can add real credentials later.
    const domain =
      typeof body.settings?.domain === "string"
        ? body.settings.domain.replace(/[^a-z0-9.-]/gi, "").toLowerCase()
        : "unknown";
    const placeholder = `${domain}-${Date.now()}@accounts.internal`;
    const { data, error } = await admin.auth.admin.createUser({
      email: placeholder,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    userId = data.user.id;
  }

  let settings_created = false;

  if (body.settings && typeof body.settings === "object") {
    const settings = body.settings as Record<string, unknown>;
    const siteName = typeof settings.brand_name === "string" ? settings.brand_name : email;
    const { error: siteError } = await admin
      .from("user_sites")
      .insert({ id: userId, user_id: userId, site_name: siteName, settings });
    if (!siteError) settings_created = true;
  }

  return NextResponse.json({ userId, invited, settings_created });
}
