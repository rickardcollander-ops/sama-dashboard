import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings, loadSiteSettings } from "@/lib/integrations/store";
import { buildBackendAuth } from "@/lib/integrations/backend-auth";
import { sameDomain } from "@/lib/domain";
import type { SiteAuditRun } from "@/app/c/analysis/audit-types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * GET /api/site-audit/latest
 *
 * Returns the most recent completed audit for the calling tenant. Used by
 * the strategy/tech pages to surface critical/warning findings without
 * forcing the user to open the analysis page first.
 *
 * Resolution order:
 *   1) Backend `/api/site-audit/runs?limit=1`, then `/runs/{id}` for the
 *      full payload (findings live on the detail endpoint).
 *   2) Local `user_settings.saved_site_audits_by_tenant[tenantId]` — survives
 *      a paused/unreachable backend so previously saved audits stay visible.
 *
 * Always responds 200. When nothing is available the body is `{ run: null }`
 * so callers can render an empty state without parsing error responses.
 */
export async function GET(req: NextRequest) {
  const auth = await buildBackendAuth(req);
  const tenantId = auth.tenantId;

  // Workspace's configured domain — used to refuse any audit that doesn't
  // belong to this tenant, regardless of what the upstream backend returns.
  const siteSettings = tenantId
    ? await loadSiteSettings(tenantId).catch(() => ({} as Record<string, unknown>))
    : ({} as Record<string, unknown>);
  const expectedDomain = (siteSettings.domain as string) || "";

  if (SAMA_API_URL) {
    try {
      const listRes = await fetch(`${SAMA_API_URL}/api/site-audit/runs?limit=1`, {
        headers: auth.headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (listRes.ok) {
        const list = (await listRes.json().catch(() => ({}))) as {
          runs?: Array<{ id?: string; domain?: string }>;
        };
        const latest = list?.runs?.[0];
        // When expectedDomain isn't known yet, trust the upstream's tenant
        // scoping instead of hard-skipping.
        const summaryDomainOk =
          !expectedDomain || sameDomain(latest?.domain, expectedDomain);
        if (latest?.id && summaryDomainOk) {
          const detail = await fetch(
            `${SAMA_API_URL}/api/site-audit/runs/${latest.id}`,
            {
              headers: auth.headers,
              signal: AbortSignal.timeout(15_000),
            },
          );
          if (detail.ok) {
            const run = (await detail.json().catch(() => null)) as
              | SiteAuditRun
              | null;
            const runDomainOk =
              !expectedDomain || sameDomain(run?.domain, expectedDomain);
            if (run && runDomainOk) {
              return NextResponse.json({ run });
            }
          }
        }
      }
    } catch {
      // fall through to local saves
    }
  }

  try {
    const user = await getCurrentUser();
    if (user) {
      const settings = await loadSettings(user.id);
      const effectiveTenantId = tenantId || user.id;
      const byTenant =
        settings.saved_site_audits_by_tenant &&
        typeof settings.saved_site_audits_by_tenant === "object"
          ? (settings.saved_site_audits_by_tenant as Record<string, SiteAuditRun[]>)
          : {};
      const tenantRuns = Array.isArray(byTenant[effectiveTenantId])
        ? byTenant[effectiveTenantId]
        : [];
      // Also filter local saves so previously-poisoned cache entries don't
      // sneak back in via this endpoint.
      const safeRuns = tenantRuns.filter((r) => sameDomain(r?.domain, expectedDomain));
      if (safeRuns.length > 0) {
        const sorted = [...safeRuns].sort((a, b) => {
          const ta = Date.parse(a.created_at || "") || 0;
          const tb = Date.parse(b.created_at || "") || 0;
          return tb - ta;
        });
        return NextResponse.json({ run: sorted[0] });
      }
    }
  } catch {
    // unauthenticated or settings unreadable — fall through to empty
  }

  return NextResponse.json({ run: null });
}
