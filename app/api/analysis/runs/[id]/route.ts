import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings, loadSiteSettings } from "@/lib/integrations/store";
import { buildBackendAuth } from "@/lib/integrations/backend-auth";
import { sameDomain } from "@/lib/domain";
import type { AnalysisRun } from "@/app/c/analysis/types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

async function loadSavedRun(id: string, tenantId: string, expectedDomain: string): Promise<AnalysisRun | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const settings = await loadSettings(user.id);
    const effectiveTenantId = tenantId || user.id;
    const byTenant = (settings.saved_analyses_by_tenant && typeof settings.saved_analyses_by_tenant === "object"
      ? settings.saved_analyses_by_tenant
      : {}) as Record<string, AnalysisRun[]>;
    const tenantRuns = Array.isArray(byTenant[effectiveTenantId]) ? byTenant[effectiveTenantId] : [];
    const match = tenantRuns.find((r) => r && r.id === id);
    if (match) {
      // Drop entries whose domain doesn't match the workspace.
      if (!sameDomain(match.domain, expectedDomain)) return null;
      return match;
    }

    // Legacy compat: pre-migration saves lived in a flat user_settings.saved_analyses
    // list. Only surface them on the user's own primary site so other customers/workspaces
    // don't see another tenant's analyses leak through the fallback.
    if (effectiveTenantId === user.id && Array.isArray(settings.saved_analyses)) {
      const legacy = (settings.saved_analyses as AnalysisRun[]).find((r) => r && r.id === id);
      if (legacy && sameDomain(legacy.domain, expectedDomain)) return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/analysis/runs/{id}
 *
 * Single run with full payload. Used for status polling (status === "running")
 * and for replay (status === "completed" returns the AnalysisRun shape).
 *
 * Falls back to user_settings.saved_analyses_by_tenant[tenantId] when the
 * backend cannot serve the run (404, network error, or not configured) so a
 * previously completed analysis is still openable from history — but only
 * within the requesting tenant, never across the user's other workspaces.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await buildBackendAuth(req);
  const tenantId = auth.tenantId;

  // Workspace's configured domain — used to refuse a run that doesn't belong
  // to this tenant, regardless of what the upstream backend returns.
  const siteSettings = tenantId
    ? await loadSiteSettings(tenantId).catch(() => ({} as Record<string, unknown>))
    : ({} as Record<string, unknown>);
  const expectedDomain = (siteSettings.domain as string) || "";

  if (SAMA_API_URL) {
    try {
      const upstream = await fetch(`${SAMA_API_URL}/api/analysis/runs/${id}`, {
        headers: auth.headers,
        signal: AbortSignal.timeout(15_000),
      });
      const text = await upstream.text();
      let body: unknown = {};
      try { body = JSON.parse(text); } catch { body = { error: "non-JSON response", upstream_body: text.slice(0, 500) }; }
      if (upstream.ok && body && typeof body === "object") {
        const upstreamDomain = (body as { domain?: string }).domain;
        // Completed runs carry a `domain`; "running" payloads may not — only
        // enforce on payloads that actually have one AND when we know what
        // domain the workspace expects. An empty expectedDomain means the
        // route was called before the workspace had a domain stored — fall
        // back to saved-run lookup instead of hard 404ing valid data.
        if (upstreamDomain && expectedDomain && !sameDomain(upstreamDomain, expectedDomain)) {
          const saved = await loadSavedRun(id, tenantId, expectedDomain);
          if (saved) return NextResponse.json({ ...saved, _source: "saved" });
          return NextResponse.json({ error: "not found" }, { status: 404 });
        }
        (body as Record<string, unknown>)._source = "live";
        return NextResponse.json(body, { status: upstream.status });
      }
      const saved = await loadSavedRun(id, tenantId, expectedDomain);
      if (saved) return NextResponse.json({ ...saved, _source: "saved" });
      return NextResponse.json(body, { status: upstream.status });
    } catch (e) {
      const saved = await loadSavedRun(id, tenantId, expectedDomain);
      if (saved) return NextResponse.json({ ...saved, _source: "saved" });
      const msg = e instanceof Error ? e.message : "Upstream unavailable";
      return NextResponse.json({ error: `Upstream unavailable: ${msg}` }, { status: 502 });
    }
  }

  const saved = await loadSavedRun(id, tenantId, expectedDomain);
  if (saved) return NextResponse.json({ ...saved, _source: "saved" });
  return NextResponse.json(
    { error: "Backend not configured (NEXT_PUBLIC_SAMA_API_URL)" },
    { status: 503 },
  );
}
