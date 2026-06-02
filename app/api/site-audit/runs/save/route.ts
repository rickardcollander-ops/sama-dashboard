import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings, loadSiteSettings, saveSettings } from "@/lib/integrations/store";
import { sameDomain } from "@/lib/domain";
import type { SiteAuditRun } from "@/app/c/analysis/audit-types";

export const runtime = "nodejs";

const MAX_SAVED_AUDITS = 50;

/**
 * POST /api/site-audit/runs/save
 *
 * Persists a completed SiteAuditRun to user_settings.saved_site_audits_by_tenant
 * so the audit history survives even when the upstream sama-agent backend is
 * unreachable or rotates run IDs. Mirrors /api/analysis/runs/save and is keyed
 * by tenant so saves never leak across the user's other workspaces.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const run = (await req.json().catch(() => null)) as SiteAuditRun | null;
  if (!run || typeof run !== "object" || !run.id || run.status !== "completed") {
    return NextResponse.json({ error: "completed site audit run required" }, { status: 400 });
  }

  const tenantId = req.headers.get("X-Tenant-ID") || user.id;

  // Refuse to cache a run that doesn't belong to the workspace it's being
  // saved under. The browser sets the X-Tenant-ID header from useSite(), but
  // an upstream-backend mixup could still hand us a foreign run — saving it
  // would persist the leak even after the upstream is fixed.
  //
  // Only enforce when we actually know the workspace's domain. An empty
  // expectedDomain means the server couldn't read settings.domain for this
  // tenant (e.g. an account-member workspace the user can see but whose
  // user_sites row isn't readable under their RLS, or settings.domain not
  // yet stored). In that case we mirror the read routes
  // (/api/site-audit/runs/[id], /api/site-audit/runs) and trust the
  // client-side domain check the page already performs before calling save,
  // rather than hard-403ing a legitimate run and losing the local history.
  const siteSettings = await loadSiteSettings(tenantId).catch(() => ({} as Record<string, unknown>));
  const expectedDomain = (siteSettings.domain as string) || "";
  if (expectedDomain && !sameDomain(run.domain, expectedDomain)) {
    return NextResponse.json(
      { error: "run does not belong to this workspace" },
      { status: 403 },
    );
  }

  const settings = await loadSettings(user.id);
  const byTenant = (settings.saved_site_audits_by_tenant && typeof settings.saved_site_audits_by_tenant === "object"
    ? settings.saved_site_audits_by_tenant
    : {}) as Record<string, SiteAuditRun[]>;

  const existing = Array.isArray(byTenant[tenantId]) ? byTenant[tenantId] : [];
  const without = existing.filter((r) => r && r.id !== run.id);
  const next = [run, ...without].slice(0, MAX_SAVED_AUDITS);

  await saveSettings(user.id, {
    ...settings,
    saved_site_audits_by_tenant: { ...byTenant, [tenantId]: next },
  });

  return NextResponse.json({ saved: true, total: next.length });
}
