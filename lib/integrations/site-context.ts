import { isAdminEmail } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SettingsJson } from "@/lib/integrations/store";

/**
 * Resolves the active site id for an API request. The dashboard sends
 * `X-Sama-Site-Id` (and a duplicate `X-Tenant-ID`) on every authenticated
 * request via samaHeaders() / tenantApi. Falls back to the caller's own
 * user_id (legacy single-site mode where the primary site id equals the
 * user id).
 */
export function resolveSiteId(
  req: { headers: Headers },
  fallbackUserId: string,
): string {
  return (
    req.headers.get("X-Sama-Site-Id") ||
    req.headers.get("X-Tenant-ID") ||
    fallbackUserId
  );
}

export interface SiteSettingsAccess {
  settings: SettingsJson;
  save: (next: SettingsJson) => Promise<void>;
}

/**
 * Read+write accessor for `user_sites.settings` scoped to a single site.
 *
 * - Non-admin callers go through the regular RLS-enforced server client,
 *   which already exposes only sites they own or are a member of.
 * - The operator admin (rc@successifier.com) uses "view-as" mode to
 *   browse sites owned by other tenants. RLS blocks those rows, so we
 *   reach for the service-role client when the requested site differs
 *   from the admin's own user_id.
 */
export async function getSiteSettingsAccess(
  user: { id: string; email?: string | null },
  siteId: string,
): Promise<SiteSettingsAccess> {
  const useServiceRole = isAdminEmail(user.email) && siteId !== user.id;

  if (useServiceRole) {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY not configured — admin view-as cannot read tenant settings",
      );
    }
    const { data } = await admin
      .from("user_sites")
      .select("settings")
      .eq("id", siteId)
      .single();
    return {
      settings: (data?.settings as SettingsJson) || {},
      async save(next: SettingsJson) {
        const { error } = await admin
          .from("user_sites")
          .update({ settings: next, updated_at: new Date().toISOString() })
          .eq("id", siteId);
        if (error) throw new Error(error.message);
      },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_sites")
    .select("settings")
    .eq("id", siteId)
    .single();
  return {
    settings: (data?.settings as SettingsJson) || {},
    async save(next: SettingsJson) {
      const { error } = await supabase
        .from("user_sites")
        .update({ settings: next, updated_at: new Date().toISOString() })
        .eq("id", siteId);
      if (error) throw new Error(error.message);
    },
  };
}
