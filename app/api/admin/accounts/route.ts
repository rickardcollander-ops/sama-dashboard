import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

interface AccountRow {
  id: string;
  email: string | undefined;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  brand_name: string | null;
  domain: string | null;
  has_settings: boolean;
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
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const redirectTo = `${origin}/c/auth/reset-password`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ user: data.user });
}
