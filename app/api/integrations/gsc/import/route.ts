import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/integrations/store";

export const runtime = "nodejs";

const SAMA_API_URL =
  process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

/**
 * Imports the user's top GSC search queries as tracked keywords.
 *
 * The SAMA backend exposes one of several plausible endpoints for this. We
 * try them in order and return the first success. If all fail with 404 we
 * fall back to triggering the SEO agent — which on a fresh tenant will
 * typically pull GSC top queries as part of its first run.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);

  const headers = {
    "Content-Type": "application/json",
    "X-Tenant-ID": user.id,
  };

  // Order matters: sync-gsc is the proven endpoint that inserts new
  // keywords into the tenant's tracked list (used by the legacy admin
  // page). The other candidates are speculative fallbacks for older /
  // alternative backend builds.
  const candidates = [
    { path: "/api/seo/keywords/sync-gsc", body: { limit } },
    { path: "/api/seo/keywords/import-gsc", body: { limit } },
    { path: "/api/seo/import-from-gsc", body: { limit } },
    { path: "/api/seo/keywords/import", body: { source: "gsc", limit } },
    { path: "/api/seo/sync", body: { source: "gsc", import_top: limit } },
  ];

  const errors: string[] = [];
  for (const c of candidates) {
    try {
      const res = await fetch(`${SAMA_API_URL}${c.path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(c.body),
      });
      if (res.status === 404) {
        errors.push(`${c.path}: 404`);
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        errors.push(`${c.path}: ${res.status} ${text.slice(0, 120)}`);
        continue;
      }
      const data = await res.json().catch(() => ({}));
      // sync-gsc returns {success, inserted, updated, total_gsc}; treat
      // success=false as a soft failure so we move on to the next candidate.
      if (data && data.success === false) {
        errors.push(`${c.path}: backend reported success=false`);
        continue;
      }
      const inserted = data.inserted ?? data.imported ?? data.count ?? data.added ?? null;
      const updated = data.updated ?? null;
      return NextResponse.json({
        imported: inserted,
        updated,
        total_gsc: data.total_gsc ?? null,
        keywords: data.keywords || [],
        source_endpoint: c.path,
      });
    } catch (e) {
      errors.push(`${c.path}: ${e instanceof Error ? e.message : "fetch failed"}`);
    }
  }

  // Fallback: trigger the SEO agent — it should pull GSC data on first run
  try {
    const res = await fetch(`${SAMA_API_URL}/api/tenant/agents/seo/trigger`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reason: "gsc_initial_import", limit }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({
        imported: null,
        triggered_agent: true,
        run_id: data.run_id,
        note: "No direct import endpoint found — triggered SEO agent instead. It will pull GSC data in the background.",
      });
    }
  } catch {
    // ignore
  }

  return NextResponse.json(
    {
      error:
        "Could not import from GSC. The backend doesn't expose a direct import endpoint and triggering the SEO agent failed. Try clicking 'Sync now' or check the agent runs.",
      attempted: errors,
    },
    { status: 502 },
  );
}
