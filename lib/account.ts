import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AccountRole = "owner" | "admin" | "member";
export type AccountStatus = "pending" | "active";

/**
 * The account being acted on for the current request.
 *
 * `accountId` is the user.id of the account owner. The backend tenant_id
 * follows the same value, so existing tenant data is preserved when team
 * members join.
 *
 * `role` is the calling user's role within that account.
 */
export interface AccountContext {
  user: User;
  accountId: string;
  role: AccountRole;
  admin: SupabaseClient;
}

const ACCOUNT_HEADER = "x-sama-account-id";

/**
 * Resolve the calling user, the active account they're acting on, and a
 * service-role client. The active account is taken from the
 * `x-sama-account-id` header (set by the dashboard) and falls back to the
 * user's own account when missing.
 *
 * Returns a NextResponse on failure that route handlers should return as-is.
 */
export async function requireAccount(
  req: Request,
  options: { minRole?: AccountRole } = {},
): Promise<
  | { ok: true; ctx: AccountContext }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
        { status: 503 },
      ),
    };
  }

  const requested = req.headers.get(ACCOUNT_HEADER) || user.id;

  const { data: membership, error } = await admin
    .from("account_members")
    .select("role, status")
    .eq("account_id", requested)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }

  // Self-heal: if the user is requesting their own account but no membership
  // row exists yet (legacy account that pre-dates the trigger), create one
  // on the fly. Avoids locking pre-existing users out of their own data.
  let role = membership?.role as AccountRole | undefined;
  if (!role && requested === user.id) {
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
    role = "owner";
  }

  if (!role) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (options.minRole && !roleAtLeast(role, options.minRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Insufficient role" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    ctx: { user, accountId: requested, role, admin },
  };
}

const ROLE_RANK: Record<AccountRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

export function roleAtLeast(role: AccountRole, min: AccountRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
