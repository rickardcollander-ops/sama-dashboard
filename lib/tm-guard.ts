import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isTmEmail } from "@/lib/tm";

/**
 * Resolves the calling user from cookies and returns the service-role
 * client when they're allowed into the TM portal (admin email or one of
 * the addresses in TM_USER_EMAILS). Returns a NextResponse on failure
 * that the route handler should return as-is.
 */
export async function requireTmAccess(): Promise<
  | { ok: true; admin: SupabaseClient; userId: string; email: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!isTmEmail(user.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
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

  return { ok: true, admin, userId: user.id, email: user.email };
}
