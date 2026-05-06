import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Reconciles pending invitations for the calling user.
 *
 * Called once after sign-in/sign-up. Finds any pending account_members rows
 * matching the user's email (or already linked to their user_id but stuck
 * in pending) and activates them.
 *
 * Returns the list of accounts the user is now a member of.
 */
export async function POST() {
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

  const email = (user.email ?? "").toLowerCase();
  const nowIso = new Date().toISOString();

  // 1. Pending rows already linked to this user_id (rare — POST /members always
  //    sets active when the auth user already exists, but cover the case).
  await admin
    .from("account_members")
    .update({ status: "active", accepted_at: nowIso })
    .eq("user_id", user.id)
    .eq("status", "pending");

  // 2. Pending rows that were created before the auth user existed: link
  //    them by email, then activate.
  if (email) {
    const { data: pendingByEmail } = await admin
      .from("account_members")
      .select("id, account_id")
      .ilike("invited_email", email)
      .eq("status", "pending");

    for (const row of pendingByEmail ?? []) {
      // Skip if a row already exists for this account/user.
      const { data: dupe } = await admin
        .from("account_members")
        .select("id")
        .eq("account_id", row.account_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (dupe) {
        await admin.from("account_members").delete().eq("id", row.id);
        continue;
      }
      await admin
        .from("account_members")
        .update({ user_id: user.id, status: "active", accepted_at: nowIso })
        .eq("id", row.id);
    }
  }

  // 3. Self-heal: ensure the user's own owner row exists (legacy users).
  await admin
    .from("account_members")
    .upsert(
      {
        account_id: user.id,
        user_id: user.id,
        role: "owner",
        status: "active",
        accepted_at: nowIso,
      },
      { onConflict: "account_id,user_id" },
    );

  // Return the accounts they belong to.
  const { data: rows } = await admin
    .from("account_members")
    .select("account_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active");

  return NextResponse.json({ accounts: rows ?? [] });
}
