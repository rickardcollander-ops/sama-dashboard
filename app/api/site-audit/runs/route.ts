import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings, loadSiteSettings } from "@/lib/integrations/store";
import { buildBackendAuth } from "@/lib/integrations/backend-auth";
import { sameDomain } from "@/lib/domain";
import type { SiteAuditRun, SiteAuditRunSummary } from "@/app/c/analysis/audit-types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

function summarizeSavedRun(run: SiteAuditRun): SiteAuditRunSummary {
  return {
    id: run.id,
    domain: run.domain || null,
    pages_analyzed: Array.isArray(run.pages) ? run.pages.length : 0,
    overall_score: run.scores?.overall ?? null,
    status: run.status || "completed",
    started_at: run.created_at || new Date().toISOString(),
    completed_at: run.created_at || null,
    error: run.error || null,
  };
}

/**
 * GET /api/site-audit/runs?limit=20
 *
 * Recent audits for the calling tenant. Merges saved local runs
 * (user_settings.saved_site_audits_by_tenant[tenantId]) with backend runs so
 * history survives even when the upstream agent backend is paused or
 * unreachable. Saves are scoped per tenant to keep customers isolated.
 */
export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
  const auth = await buildBackendAuth(req);
  const tenantId = auth.tenantId;

  // Pull the workspace's configured domain so we can drop any upstream rows
  // whose `domain` doesn't match — belt-and-braces against tenant-isolation
  // bugs in the upstream agent backend.
  const siteSettings = tenantId
    ? await loadSiteSettings(tenantId).catch(() => ({} as Record<string, unknown>))
    : ({} as Record<string, unknown>);
  const expectedDomain = (siteSettings.domain as string) || "";

  let backendRuns: SiteAuditRunSummary[] = [];
  if (SAMA_API_URL) {
    try {
      const upstream = await fetch(`${SAMA_API_URL}/api/site-audit/runs?limit=${limit}`, {
        headers: auth.headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (upstream.ok) {
        const data = await upstream.json();
        if (Array.isArray(data?.runs)) {
          // Filter by domain only when the workspace has one stored. When
          // expectedDomain is empty (no X-Tenant-ID forwarded, or settings
          // not yet saved), trust the upstream's tenant scoping and pass
          // its rows through rather than silently dropping everything.
          backendRuns = expectedDomain
            ? (data.runs as SiteAuditRunSummary[]).filter((r) =>
                sameDomain(r?.domain, expectedDomain),
              )
            : (data.runs as SiteAuditRunSummary[]);
        }
      }
    } catch {
      // fall through — local saves still get returned below
    }
  }

  let savedRuns: SiteAuditRunSummary[] = [];
  try {
    const user = await getCurrentUser();
    if (user) {
      const settings = await loadSettings(user.id);
      const effectiveTenantId = tenantId || user.id;
      const byTenant = (settings.saved_site_audits_by_tenant && typeof settings.saved_site_audits_by_tenant === "object"
        ? settings.saved_site_audits_by_tenant
        : {}) as Record<string, SiteAuditRun[]>;
      const saved = Array.isArray(byTenant[effectiveTenantId]) ? byTenant[effectiveTenantId] : [];
      // Also filter local saves — any poisoned entries from before the
      // domain-match guard was added must not surface here.
      savedRuns = saved.filter((r) => sameDomain(r?.domain, expectedDomain)).map(summarizeSavedRun);
    }
  } catch {
    // unauthenticated or settings unreadable — skip local merge
  }

  const seen = new Set<string>();
  const merged: SiteAuditRunSummary[] = [];
  for (const r of [...backendRuns, ...savedRuns]) {
    if (!r?.id || seen.has(r.id)) continue;
    seen.add(r.id);
    merged.push(r);
  }
  merged.sort((a, b) => {
    const ta = Date.parse(a.started_at || "") || 0;
    const tb = Date.parse(b.started_at || "") || 0;
    return tb - ta;
  });

  return NextResponse.json({ runs: merged.slice(0, limit) });
}
