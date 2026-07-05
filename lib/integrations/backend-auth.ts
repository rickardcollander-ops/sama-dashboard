/**
 * Builds the header set the SAMA backend (Railway) requires for tenant-scoped
 * reads and writes from authenticated dashboard routes.
 *
 * The backend was migrated to require the user's Supabase bearer on top of
 * X-Tenant-ID — without it, /api/site-audit/runs/{id} and
 * /api/analysis/runs/{id} can't scope the lookup and return 404 for runs that
 * actually exist. The onboarding background job already forwards these
 * headers (see lib/onboarding/generate.ts → backendHeaders); the dashboard's
 * dedicated read routes were the missing piece.
 *
 * Resolves the active site/account from the caller's Supabase session and
 * the X-Tenant-ID / X-Sama-Site-Id headers the dashboard sends — and, unlike
 * the original version, VALIDATES those headers against user_sites and
 * account_members before honouring them. A client-supplied site id that the
 * session user doesn't own (directly, via account membership, or as platform
 * admin) falls back to the user's own tenant instead of being forwarded
 * upstream, so these routes can no longer be used to read another tenant's
 * runs by header spoofing.
 */
import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isAdminEmail } from "@/lib/admin";

export interface BackendAuth {
  /** Resolved tenant/site id used for upstream and `loadSiteSettings`. */
  tenantId: string;
  /** Account id forwarded as X-Sama-Account-Id. Equals user.id for solo users. */
  accountId: string;
  /** Whether the caller had a valid Supabase session. */
  authenticated: boolean;
  /** Header bag ready to spread into a fetch() call. */
  headers: Record<string, string>;
}

async function isActiveMember(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  accountId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("account_members")
    .select("id")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Resolves headers + tenant context for an outbound call to the SAMA backend.
 *
 * @param contentType — pass "application/json" for write endpoints. Reads can
 *   omit it.
 */
export async function buildBackendAuth(
  req: NextRequest,
  contentType?: string,
): Promise<BackendAuth> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = user?.id ?? "";
  const accessToken = session?.access_token ?? "";
  const admin = getSupabaseAdmin();
  const adminUser = isAdminEmail(user?.email ?? null);

  const headerSite =
    req.headers.get("X-Sama-Site-Id") || req.headers.get("X-Tenant-ID") || "";
  const headerAccount = req.headers.get("X-Sama-Account-Id") || "";

  // Default to the caller's own identity; only widen after validation.
  let tenantId = userId;
  let accountId = userId;

  if (userId && headerAccount && headerAccount !== userId) {
    if (adminUser || (admin && (await isActiveMember(admin, headerAccount, userId)))) {
      accountId = headerAccount;
    }
  }

  if (userId && headerSite && headerSite !== userId) {
    if (adminUser) {
      tenantId = headerSite;
    } else if (admin) {
      const { data: siteRow } = await admin
        .from("user_sites")
        .select("id, user_id")
        .eq("id", headerSite)
        .maybeSingle();
      const owner = siteRow?.user_id ?? "";
      if (
        owner &&
        (owner === userId ||
          owner === accountId ||
          (await isActiveMember(admin, owner, userId)))
      ) {
        tenantId = headerSite;
        if (accountId === userId && owner !== userId) accountId = owner;
      }
    }
  }

  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (tenantId) {
    headers["X-Tenant-ID"] = tenantId;
    headers["X-Sama-Site-Id"] = tenantId;
  }
  if (accountId) {
    headers["X-Sama-Account-Id"] = accountId;
  }
  // The backend's expensive-path gate looks for this. Reads don't need it,
  // but it's harmless on every call.
  headers["X-Sama-Intent"] = "user-action";
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  // Service secret for the backend's tenant middleware — marks this as a
  // trusted server-to-server call whose tenant headers were validated here.
  if (process.env.SAMA_INTERNAL_TOKEN) {
    headers["X-Sama-Internal-Token"] = process.env.SAMA_INTERNAL_TOKEN;
  }

  return {
    tenantId,
    accountId,
    authenticated: !!user && !!accessToken,
    headers,
  };
}
