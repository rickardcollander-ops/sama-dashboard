import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings } from "@/lib/integrations/store";
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
  const tenantId = req.headers.get("X-Tenant-ID") || "";

  if (SAMA_API_URL) {
    try {
      const listRes = await fetch(`${SAMA_API_URL}/api/site-audit/runs?limit=1`, {
        headers: { "X-Tenant-ID": tenantId },
        signal: AbortSignal.timeout(10_000),
      });
      if (listRes.ok) {
        const list = (await listRes.json().catch(() => ({}))) as {
          runs?: Array<{ id?: string }>;
        };
        const latestId = list?.runs?.[0]?.id;
        if (latestId) {
          const detail = await fetch(
            `${SAMA_API_URL}/api/site-audit/runs/${latestId}`,
            {
              headers: { "X-Tenant-ID": tenantId },
              signal: AbortSignal.timeout(15_000),
            },
          );
          if (detail.ok) {
            const run = (await detail.json().catch(() => null)) as
              | SiteAuditRun
              | null;
            if (run) return NextResponse.json({ run });
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
      if (tenantRuns.length > 0) {
        const sorted = [...tenantRuns].sort((a, b) => {
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
