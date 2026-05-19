import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings, loadSiteSettings } from "@/lib/integrations/store";
import { buildBackendAuth } from "@/lib/integrations/backend-auth";
import { sameDomain } from "@/lib/domain";
import type { SiteAuditRun } from "@/app/c/analysis/audit-types";

const SAMA_API_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "";

async function loadSavedAudit(id: string, tenantId: string, expectedDomain: string): Promise<SiteAuditRun | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const settings = await loadSettings(user.id);
    const effectiveTenantId = tenantId || user.id;
    const byTenant = (settings.saved_site_audits_by_tenant && typeof settings.saved_site_audits_by_tenant === "object"
      ? settings.saved_site_audits_by_tenant
      : {}) as Record<string, SiteAuditRun[]>;
    const tenantRuns = Array.isArray(byTenant[effectiveTenantId]) ? byTenant[effectiveTenantId] : [];
    const match = tenantRuns.find((r) => r && r.id === id);
    if (!match) return null;
    // Drop any entry whose domain doesn't match the workspace's configured
    // domain — older entries from before the domain-match guard could
    // otherwise still surface here.
    if (!sameDomain(match.domain, expectedDomain)) return null;
    return match;
  } catch {
    return null;
  }
}

/**
 * GET /api/site-audit/runs/{id}
 *
 * One audit with full payload. Used for status polling (status === "running")
 * and for replay (status === "completed" returns the SiteAuditRun shape).
 *
 * Falls back to user_settings.saved_site_audits_by_tenant[tenantId] when the
 * backend cannot serve the run (404, network error, or not configured) so a
 * previously completed audit is still openable from history — but only within
 * the requesting tenant, never across the user's other workspaces.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await buildBackendAuth(req);
  const tenantId = auth.tenantId;

  // Workspace's configured domain — used to refuse audits that don't belong
  // to this tenant, even if the upstream backend returns one.
  const siteSettings = tenantId
    ? await loadSiteSettings(tenantId).catch(() => ({} as Record<string, unknown>))
    : ({} as Record<string, unknown>);
  const expectedDomain = (siteSettings.domain as string) || "";

  if (SAMA_API_URL) {
    try {
      const upstream = await fetch(`${SAMA_API_URL}/api/site-audit/runs/${id}`, {
        headers: auth.headers,
        signal: AbortSignal.timeout(15_000),
      });
      const body = await upstream.json().catch(() => ({}));
      if (upstream.ok && body && typeof body === "object") {
        // Completed runs carry a `domain`; "running" status payloads may not
        // yet — only enforce the check on terminal payloads with a domain
        // AND when we know what domain the workspace expects. An empty
        // expectedDomain means we don't know the workspace's domain yet (no
        // X-Tenant-ID forwarded, or settings.domain not stored) — fall back
        // to saved-run lookup rather than hard-404ing valid data.
        const upstreamDomain = (body as { domain?: string }).domain;
        if (upstreamDomain && expectedDomain && !sameDomain(upstreamDomain, expectedDomain)) {
          const saved = await loadSavedAudit(id, tenantId, expectedDomain);
          if (saved) return NextResponse.json(saved);
          return NextResponse.json({ error: "not found" }, { status: 404 });
        }
        return NextResponse.json(body, { status: upstream.status });
      }
      const saved = await loadSavedAudit(id, tenantId, expectedDomain);
      if (saved) return NextResponse.json(saved);
      return NextResponse.json(body, { status: upstream.status });
    } catch {
      const saved = await loadSavedAudit(id, tenantId, expectedDomain);
      if (saved) return NextResponse.json(saved);
      return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
    }
  }

  const saved = await loadSavedAudit(id, tenantId, expectedDomain);
  if (saved) return NextResponse.json(saved);
  return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
}
