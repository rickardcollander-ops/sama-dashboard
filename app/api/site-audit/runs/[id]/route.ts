import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings } from "@/lib/integrations/store";
import type { SiteAuditRun } from "@/app/c/analysis/audit-types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

async function loadSavedAudit(id: string, tenantId: string): Promise<SiteAuditRun | null> {
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
    return match || null;
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
  const tenantId = req.headers.get("X-Tenant-ID") || "";

  if (SAMA_API_URL) {
    try {
      const upstream = await fetch(`${SAMA_API_URL}/api/site-audit/runs/${id}`, {
        headers: { "X-Tenant-ID": tenantId },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await upstream.json().catch(() => ({}));
      if (upstream.ok && body && typeof body === "object") {
        return NextResponse.json(body, { status: upstream.status });
      }
      const saved = await loadSavedAudit(id, tenantId);
      if (saved) return NextResponse.json(saved);
      return NextResponse.json(body, { status: upstream.status });
    } catch {
      const saved = await loadSavedAudit(id, tenantId);
      if (saved) return NextResponse.json(saved);
      return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
    }
  }

  const saved = await loadSavedAudit(id, tenantId);
  if (saved) return NextResponse.json(saved);
  return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
}
