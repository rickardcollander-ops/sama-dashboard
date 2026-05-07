import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/integrations/store";
import {
  getSiteSettingsAccess,
  resolveSiteId,
  type SiteSettingsAccess,
} from "@/lib/integrations/site-context";

export const runtime = "nodejs";

const SAMA_API_URL =
  process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

function extractKeywordStrings(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  const out: string[] = [];
  for (const item of payload) {
    if (typeof item === "string") {
      const v = item.trim();
      if (v) out.push(v);
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const v = (obj.keyword ?? obj.query ?? obj.text) as unknown;
      if (typeof v === "string" && v.trim()) out.push(v.trim());
    }
  }
  return out;
}

async function persistTrackedKeywords(
  access: SiteSettingsAccess,
  keywords: string[],
): Promise<number> {
  if (keywords.length === 0) return 0;
  const settings = access.settings;
  const existing: string[] = Array.isArray(settings.tracked_keywords)
    ? (settings.tracked_keywords as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const lower = new Set(existing.map((k) => k.toLowerCase()));
  const merged = [...existing];
  let added = 0;
  for (const kw of keywords) {
    if (!lower.has(kw.toLowerCase())) {
      merged.push(kw);
      lower.add(kw.toLowerCase());
      added += 1;
    }
  }
  if (added > 0) {
    await access.save({ ...settings, tracked_keywords: merged });
  }
  return added;
}

async function fetchBackendKeywords(siteId: string): Promise<string[]> {
  // Pass an explicit high limit to defeat any default pagination on the
  // backend (some builds cap at 10 by default).
  const paths = ["/api/seo/keywords?limit=1000", "/api/seo/keywords"];
  for (const path of paths) {
    try {
      const res = await fetch(`${SAMA_API_URL}${path}`, {
        method: "GET",
        headers: { "X-Tenant-ID": siteId },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const data = await res.json().catch(() => ({}));
      const list = extractKeywordStrings(data?.keywords);
      if (list.length > 0) return list;
    } catch {
      // try next path
    }
  }
  return [];
}

interface QueryProbe {
  path: string;
  status: number | "error";
  count: number;
  sample?: string;
}

// sync-gsc only returns counts, and `/api/seo/keywords` only returns the
// tenant's tracked list — neither exposes the raw GSC query strings. Try
// known GSC-query endpoints so we can pull every query the property has
// ranked for and add them to the tracked list ourselves.
async function fetchBackendGscQueries(
  siteId: string,
  limit: number | null,
): Promise<{ keywords: string[]; probes: QueryProbe[] }> {
  const headers = { "X-Tenant-ID": siteId };
  const qs = limit == null ? "?limit=1000" : `?limit=${limit}`;
  const candidates = [
    `/api/seo/gsc/queries${qs}`,
    `/api/seo/search-console/queries${qs}`,
    `/api/seo/gsc/top-queries${qs}`,
    `/api/integrations/gsc/queries${qs}`,
    `/api/seo/keywords/gsc${qs}`,
    `/api/seo/keywords/all${qs}`,
    `/api/seo/rankings${qs}`,
    `/api/seo/metrics${qs}`,
  ];
  const probes: QueryProbe[] = [];
  let firstHit: string[] = [];
  for (const path of candidates) {
    try {
      const res = await fetch(`${SAMA_API_URL}${path}`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        probes.push({ path, status: res.status, count: 0 });
        continue;
      }
      const data = await res.json().catch(() => ({}));
      const list = extractKeywordStrings(
        data?.queries ?? data?.keywords ?? data?.items ?? data,
      );
      probes.push({ path, status: res.status, count: list.length, sample: list[0] });
      if (list.length > 0 && firstHit.length === 0) firstHit = list;
    } catch {
      probes.push({ path, status: "error", count: 0 });
    }
  }
  return { keywords: firstHit, probes };
}

async function syncKeywordsToBackend(siteId: string, keywords: string[]): Promise<number> {
  let synced = 0;
  for (const kw of keywords) {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/keywords/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": siteId },
        body: JSON.stringify({ keyword: kw }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) synced += 1;
    } catch {
      // backend unreachable for this keyword — local persistence still wins
    }
  }
  return synced;
}

/**
 * Imports the user's top GSC search queries as tracked keywords.
 *
 * The SAMA backend exposes one of several plausible endpoints for this. We
 * try them in order and return the first success. If all fail with 404 we
 * fall back to triggering the SEO agent — which on a fresh tenant will
 * typically pull GSC top queries as part of its first run.
 *
 * `limit` is optional. When omitted (or set to "all"/0) we call the backend
 * with no body — that's the legacy contract for sync-gsc which imports
 * every GSC query the property has ranked for.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rawLimit = body?.limit;
  const wantAll =
    rawLimit === undefined || rawLimit === null || rawLimit === "all" || Number(rawLimit) <= 0;
  const limit = wantAll ? null : Math.min(Math.max(Number(rawLimit) || 25, 1), 1000);

  const siteId = resolveSiteId(req, user.id);
  let access: SiteSettingsAccess;
  try {
    access = await getSiteSettingsAccess(user, siteId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load tenant settings" },
      { status: 500 },
    );
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Tenant-ID": siteId,
  };

  // sync-gsc is the canonical endpoint for refreshing GSC stats; the
  // other paths cover older / alternative backend builds. Note: current
  // sync-gsc only updates metrics — it does NOT insert new tracked
  // keywords. We pull the actual query strings via fetchBackendGscQueries
  // below and persist them ourselves.
  const candidates: { path: string; body: Record<string, unknown> }[] = [
    { path: "/api/seo/keywords/sync-gsc", body: limit == null ? {} : { limit } },
    { path: "/api/seo/keywords/import-gsc", body: limit == null ? {} : { limit } },
    { path: "/api/seo/import-from-gsc", body: limit == null ? {} : { limit } },
    {
      path: "/api/seo/keywords/import",
      body: limit == null ? { source: "gsc" } : { source: "gsc", limit },
    },
    {
      path: "/api/seo/sync",
      body: limit == null ? { source: "gsc" } : { source: "gsc", import_top: limit },
    },
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
      // sync-gsc reports counts but not the actual query strings, and the
      // backend's tracked-keywords list only contains keywords the tenant
      // has explicitly added. To surface every GSC query the property
      // ranks for in "all keywords", pull the strings from the response
      // (best case), the backend tracked list, and a dedicated GSC-query
      // endpoint, then persist the union locally and push any new ones
      // back to the backend tracked list so future GETs return them too.
      const returnedFromResp = extractKeywordStrings(
        data?.keywords ?? data?.queries ?? data?.items,
      );
      const [fromBackend, fromGsc] = await Promise.all([
        fetchBackendKeywords(siteId),
        fetchBackendGscQueries(siteId, limit),
      ]);
      const allKeywords = Array.from(
        new Set(
          [...returnedFromResp, ...fromBackend, ...fromGsc.keywords]
            .map((k) => k.trim())
            .filter(Boolean),
        ),
      );
      const persisted = await persistTrackedKeywords(access, allKeywords);
      // If we discovered queries the backend didn't already have in its
      // tracked list, register them there too so its `/api/seo/keywords`
      // GET starts returning them.
      const missingOnBackend = allKeywords.filter(
        (k) => !fromBackend.some((b) => b.toLowerCase() === k.toLowerCase()),
      );
      const backendSynced = missingOnBackend.length
        ? await syncKeywordsToBackend(siteId, missingOnBackend)
        : 0;
      // Prefer the count of keywords we actually added to the user's
      // tracked list — `data.inserted` reflects backend-internal state
      // and is often 0 even when 80+ queries are newly visible to the user.
      const backendInserted = data.inserted ?? data.imported ?? data.count ?? data.added ?? 0;
      const imported = Math.max(Number(backendInserted) || 0, persisted);
      const updated = data.updated ?? null;
      return NextResponse.json({
        imported,
        persisted,
        backend_synced: backendSynced,
        updated,
        total_gsc: data.total_gsc ?? null,
        total_tracked: allKeywords.length,
        keywords: allKeywords,
        source_endpoint: c.path,
        diagnostics: {
          sync_response_keys: Object.keys(data || {}),
          backend_keywords_count: fromBackend.length,
          gsc_query_probes: fromGsc.probes,
        },
      });
    } catch (e) {
      errors.push(`${c.path}: ${e instanceof Error ? e.message : "fetch failed"}`);
    }
  }

  // Fallback: trigger the SEO agent — it should pull GSC data on first run
  try {
    const triggerBody: Record<string, unknown> = { reason: "gsc_initial_import" };
    if (limit != null) triggerBody.limit = limit;
    const res = await fetch(`${SAMA_API_URL}/api/tenant/agents/seo/trigger`, {
      method: "POST",
      headers,
      body: JSON.stringify(triggerBody),
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
