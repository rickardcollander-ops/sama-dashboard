/**
 * Server-side check that a session user may act on a given site id.
 *
 * Grants access when the user owns the site, is an active member of the
 * owning account, or is a platform admin. Used by routes that write with the
 * service-role client (which bypasses RLS) and therefore must enforce
 * ownership themselves — e.g. the Google OAuth token binding.
 */
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isAdminEmail } from "@/lib/admin";

export async function userCanAccessSite(
  user: { id: string; email?: string | null },
  siteId: string,
): Promise<boolean> {
  if (!siteId) return false;
  if (siteId === user.id) return true;
  if (isAdminEmail(user.email ?? null)) return true;

  const admin = getSupabaseAdmin();
  if (!admin) return false; // fail closed — no way to verify

  const { data: siteRow } = await admin
    .from("user_sites")
    .select("user_id")
    .eq("id", siteId)
    .maybeSingle();
  const owner = siteRow?.user_id ?? "";
  if (!owner) return false;
  if (owner === user.id) return true;

  const { data: membership } = await admin
    .from("account_members")
    .select("id")
    .eq("account_id", owner)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return !!membership;
}
