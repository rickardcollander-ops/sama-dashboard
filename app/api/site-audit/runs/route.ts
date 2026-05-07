import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings } from "@/lib/integrations/store";
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
  const tenantId = req.headers.get("X-Tenant-ID") || "";

  let backendRuns: SiteAuditRunSummary[] = [];
  if (SAMA_API_URL) {
    try {
      const upstream = await fetch(`${SAMA_API_URL}/api/site-audit/runs?limit=${limit}`, {
        headers: { "X-Tenant-ID": tenantId },
        signal: AbortSignal.timeout(10_000),
      });
      if (upstream.ok) {
        const data = await upstream.json();
        if (Array.isArray(data?.runs)) backendRuns = data.runs as SiteAuditRunSummary[];
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
      savedRuns = saved.map(summarizeSavedRun);
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
