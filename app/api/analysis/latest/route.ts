import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings } from "@/lib/integrations/store";
import type { AnalysisRun } from "@/app/c/analysis/types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

async function loadLatestSavedRun(tenantId: string): Promise<AnalysisRun | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const settings = await loadSettings(user.id);
    const effectiveTenantId = tenantId || user.id;
    const byTenant = (settings.saved_analyses_by_tenant && typeof settings.saved_analyses_by_tenant === "object"
      ? settings.saved_analyses_by_tenant
      : {}) as Record<string, AnalysisRun[]>;
    let tenantRuns = Array.isArray(byTenant[effectiveTenantId]) ? byTenant[effectiveTenantId] : [];
    if (tenantRuns.length === 0 && effectiveTenantId === user.id && Array.isArray(settings.saved_analyses)) {
      tenantRuns = settings.saved_analyses as AnalysisRun[];
    }
    if (tenantRuns.length === 0) return null;
    const sorted = [...tenantRuns].sort((a, b) => {
      const ta = Date.parse(a.created_at || "") || 0;
      const tb = Date.parse(b.created_at || "") || 0;
      return tb - ta;
    });
    return sorted[0] || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/analysis/latest
 *
 * The Insights page calls this on mount to get whatever should be rendered
 * in the matrix. The backend resolves it to either the most recent completed
 * analysis_runs row (augmented with ai_visibility_checks) OR a synthetic
 * payload built purely from ai_visibility_checks when no full analysis run
 * has been triggered yet. This is what surfaces /c/geo monitoring data into
 * /c/analysis without forcing the user to also run a separate analysis.
 *
 * Falls back to user_settings.saved_analyses_by_tenant[tenantId] (newest
 * first) when the backend can't be reached so history still shows up.
 */
export async function GET(req: NextRequest) {
  const tenantId = req.headers.get("X-Tenant-ID") || "";

  if (SAMA_API_URL) {
    try {
      const upstream = await fetch(`${SAMA_API_URL}/api/analysis/latest`, {
        headers: { "X-Tenant-ID": tenantId },
        signal: AbortSignal.timeout(15_000),
      });
      const text = await upstream.text();
      let body: unknown = {};
      try { body = JSON.parse(text); } catch { body = { error: "non-JSON response", upstream_body: text.slice(0, 500) }; }
      if (upstream.ok && body && typeof body === "object") {
        const bodyObj = body as Record<string, unknown>;
        // Backend "empty" sentinel → fall back to the newest local save if any.
        if (bodyObj.status === "empty") {
          const saved = await loadLatestSavedRun(tenantId);
          if (saved) return NextResponse.json({ ...saved, _source: "saved" });
        }
        bodyObj._source = bodyObj.synthetic ? "synthetic" : "live";
        return NextResponse.json(bodyObj, { status: upstream.status });
      }
      const saved = await loadLatestSavedRun(tenantId);
      if (saved) return NextResponse.json({ ...saved, _source: "saved" });
      return NextResponse.json(body, { status: upstream.status });
    } catch (e) {
      const saved = await loadLatestSavedRun(tenantId);
      if (saved) return NextResponse.json({ ...saved, _source: "saved" });
      const msg = e instanceof Error ? e.message : "Upstream unavailable";
      return NextResponse.json({ error: `Upstream unavailable: ${msg}` }, { status: 502 });
    }
  }

  const saved = await loadLatestSavedRun(tenantId);
  if (saved) return NextResponse.json({ ...saved, _source: "saved" });
  return NextResponse.json(
    { error: "Backend not configured (NEXT_PUBLIC_SAMA_API_URL)" },
    { status: 503 },
  );
}
