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
 * the X-Tenant-ID / X-Sama-Site-Id headers the dashboard sends. Falls back to
 * the user's own id when no header was provided (legacy single-site mode).
 */
import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

  const headerSite =
    req.headers.get("X-Sama-Site-Id") || req.headers.get("X-Tenant-ID") || "";
  const headerAccount = req.headers.get("X-Sama-Account-Id") || "";
  const tenantId = headerSite || userId;
  const accountId = headerAccount || userId;

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

  return {
    tenantId,
    accountId,
    authenticated: !!user && !!accessToken,
    headers,
  };
}
