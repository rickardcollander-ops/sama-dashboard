import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/integrations/store";
import {
  getTenantSettingsAccess,
  resolveSiteId,
  type SiteSettingsAccess,
} from "@/lib/integrations/site-context";

export const runtime = "nodejs";
// Cap the function lifetime so the client always sees a response. The
// route enforces its own internal budget below this so it can return a
// useful payload before Vercel kills the function.
export const maxDuration = 60;

const SAMA_API_URL =
  process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

// Per-fetch caps. The primary sync-gsc call gets a longer one because
// it does the heavy GSC lookup; the cheap GETs and per-keyword writes
// get a tighter cap.
const PRIMARY_FETCH_TIMEOUT_MS = 25_000;
const PER_FETCH_TIMEOUT_MS = 8_000;
// Total budget for the whole request. Stays comfortably under
// maxDuration so we have time to serialize the JSON response. If we
// blow this budget mid-sync we abort outstanding fetches and return
// what we have rather than letting the client spin forever.
const TOTAL_BUDGET_MS = 50_000;
// Cap on parallel /api/seo/keywords/add writes. The backend serializes
// these per-tenant anyway; pushing more than this just queues them.
const BACKEND_SYNC_CONCURRENCY = 8;

// The SAMA backend's TenantMiddleware rejects calls that only carry the
// legacy X-Tenant-ID — protected routes require either a Supabase JWT or
// X-Sama-Account-Id. Build the full triplet (account/site + legacy tenant
// for backward compatibility) once and reuse it on every backend fetch.
function backendHeaders(
  siteId: string,
  accountId: string,
  jsonBody = false,
): Record<string, string> {
  const h: Record<string, string> = {
    "X-Tenant-ID": siteId,
    "X-Sama-Site-Id": siteId,
    "X-Sama-Account-Id": accountId,
  };
  if (jsonBody) h["Content-Type"] = "application/json";
  return h;
}

function makeDeadline(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new DOMException("budget exceeded", "TimeoutError")),
    ms,
  );
  return { signal: ctrl.signal, cancel: () => clearTimeout(timer) };
}

function fetchSignal(timeoutMs: number, deadline: AbortSignal): AbortSignal {
  return AbortSignal.any([AbortSignal.timeout(timeoutMs), deadline]);
}

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

async function fetchBackendKeywords(
  siteId: string,
  accountId: string,
  deadline: AbortSignal,
): Promise<string[]> {
  // Pass an explicit high limit to defeat any default pagination on the
  // backend (some builds cap at 10 by default).
  const paths = ["/api/seo/keywords?limit=1000", "/api/seo/keywords"];
  for (const path of paths) {
    if (deadline.aborted) break;
    try {
      const res = await fetch(`${SAMA_API_URL}${path}`, {
        method: "GET",
        headers: backendHeaders(siteId, accountId),
        signal: fetchSignal(PER_FETCH_TIMEOUT_MS, deadline),
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
// ranked for and add them to the tracked list ourselves. Probes run in
// parallel so the total wall time is one timeout, not eight.
async function fetchBackendGscQueries(
  siteId: string,
  accountId: string,
  limit: number | null,
  deadline: AbortSignal,
): Promise<{ keywords: string[]; probes: QueryProbe[] }> {
  const headers = backendHeaders(siteId, accountId);
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

  const results = await Promise.all(
    candidates.map(
      async (path): Promise<QueryProbe & { keywords: string[] }> => {
        try {
          const res = await fetch(`${SAMA_API_URL}${path}`, {
            method: "GET",
            headers,
            signal: fetchSignal(PER_FETCH_TIMEOUT_MS, deadline),
          });
          if (!res.ok) {
            return { path, status: res.status, count: 0, keywords: [] };
          }
          const data = await res.json().catch(() => ({}));
          const list = extractKeywordStrings(
            data?.queries ?? data?.keywords ?? data?.items ?? data,
          );
          return {
            path,
            status: res.status,
            count: list.length,
            sample: list[0],
            keywords: list,
          };
        } catch {
          return { path, status: "error", count: 0, keywords: [] };
        }
      },
    ),
  );

  const probes: QueryProbe[] = results.map(({ path, status, count, sample }) => ({
    path,
    status,
    count,
    sample,
  }));
  const firstHit = results.find((r) => r.keywords.length > 0)?.keywords ?? [];
  return { keywords: firstHit, probes };
}

async function syncKeywordsToBackend(
  siteId: string,
  accountId: string,
  keywords: string[],
  deadline: AbortSignal,
): Promise<number> {
  if (keywords.length === 0) return 0;
  let synced = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < keywords.length && !deadline.aborted) {
      const idx = cursor++;
      const kw = keywords[idx];
      try {
        const res = await fetch(`${SAMA_API_URL}/api/seo/keywords/add`, {
          method: "POST",
          headers: backendHeaders(siteId, accountId, true),
          body: JSON.stringify({ keyword: kw }),
          signal: fetchSignal(PER_FETCH_TIMEOUT_MS, deadline),
        });
        if (res.ok) synced += 1;
      } catch {
        // backend unreachable for this keyword — local persistence still wins
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(BACKEND_SYNC_CONCURRENCY, keywords.length) },
    () => worker(),
  );
  await Promise.all(workers);
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
  // The browser sends X-Sama-Account-Id via samaHeaders(); for admin
  // "view-as" mode that's the customer being viewed, otherwise it equals
  // the authenticated user.id. Either way the backend's TenantMiddleware
  // requires it on protected routes — falling back to user.id keeps
  // legacy callers (curl, integration tests) working.
  const accountId = req.headers.get("X-Sama-Account-Id") || user.id;
  let access: SiteSettingsAccess;
  try {
    access = await getTenantSettingsAccess(user, siteId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load tenant settings" },
      { status: 500 },
    );
  }

  const deadline = makeDeadline(TOTAL_BUDGET_MS);
  try {
    const headers = backendHeaders(siteId, accountId, true);

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

    interface CandidateResult {
      path: string;
      ok: boolean;
      status: number | "error";
      data?: Record<string, unknown>;
      error?: string;
    }

    const candidateResults: CandidateResult[] = [];
    const candidateErrors: string[] = [];
    let firstSuccess: { path: string; data: Record<string, unknown> } | null = null;

    for (const c of candidates) {
      if (deadline.signal.aborted) {
        const msg = "request budget exhausted before attempt";
        candidateResults.push({ path: c.path, ok: false, status: "error", error: msg });
        candidateErrors.push(`${c.path}: ${msg}`);
        break;
      }
      try {
        const res = await fetch(`${SAMA_API_URL}${c.path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(c.body),
          signal: fetchSignal(PRIMARY_FETCH_TIMEOUT_MS, deadline.signal),
        });
        if (res.status === 404) {
          candidateResults.push({ path: c.path, ok: false, status: 404 });
          candidateErrors.push(`${c.path}: 404`);
          continue;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          candidateResults.push({ path: c.path, ok: false, status: res.status, error: text.slice(0, 200) });
          candidateErrors.push(`${c.path}: ${res.status} ${text.slice(0, 120)}`);
          continue;
        }
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (data && data.success === false) {
          candidateResults.push({ path: c.path, ok: false, status: res.status, data, error: "success=false" });
          candidateErrors.push(`${c.path}: backend reported success=false`);
          continue;
        }
        candidateResults.push({ path: c.path, ok: true, status: res.status, data });
        if (!firstSuccess) firstSuccess = { path: c.path, data };
        // The first succeeding candidate is enough — additional candidates
        // would just repeat the same sync work upstream.
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "fetch failed";
        candidateResults.push({ path: c.path, ok: false, status: "error", error: msg });
        candidateErrors.push(`${c.path}: ${msg}`);
      }
    }

    // Always probe for query strings, even when every candidate POST
    // failed. The backend may expose a read-only GSC-query endpoint we
    // can persist from without ever needing the dedicated import path.
    const [fromBackend, fromGsc] = await Promise.all([
      fetchBackendKeywords(siteId, accountId, deadline.signal),
      fetchBackendGscQueries(siteId, accountId, limit, deadline.signal),
    ]);
    const returnedFromResp = firstSuccess
      ? extractKeywordStrings(
          (firstSuccess.data?.keywords ??
            firstSuccess.data?.queries ??
            firstSuccess.data?.items) as unknown,
        )
      : [];
    const allKeywords = Array.from(
      new Set(
        [...returnedFromResp, ...fromBackend, ...fromGsc.keywords]
          .map((k) => k.trim())
          .filter(Boolean),
      ),
    );

    const baseDiagnostics = {
      candidate_attempts: candidateResults.map((r) => ({
        path: r.path,
        ok: r.ok,
        status: r.status,
        error: r.error,
      })),
      sync_response_keys: firstSuccess ? Object.keys(firstSuccess.data || {}) : [],
      backend_keywords_count: fromBackend.length,
      gsc_query_probes: fromGsc.probes,
    };

    if (allKeywords.length > 0) {
      const persisted = await persistTrackedKeywords(access, allKeywords);
      // If we discovered queries the backend didn't already have in its
      // tracked list, register them there too so its `/api/seo/keywords`
      // GET starts returning them. This runs with bounded concurrency
      // and respects the request deadline — a slow backend can't make
      // the route hang anymore.
      const missingOnBackend = allKeywords.filter(
        (k) => !fromBackend.some((b) => b.toLowerCase() === k.toLowerCase()),
      );
      const backendSynced = missingOnBackend.length
        ? await syncKeywordsToBackend(siteId, accountId, missingOnBackend, deadline.signal)
        : 0;
      const backendSyncTruncated =
        missingOnBackend.length > 0 && backendSynced < missingOnBackend.length;
      const data = firstSuccess?.data ?? {};
      const backendInserted =
        (data.inserted as number | undefined) ??
        (data.imported as number | undefined) ??
        (data.count as number | undefined) ??
        (data.added as number | undefined) ??
        0;
      const imported = Math.max(Number(backendInserted) || 0, persisted);
      return NextResponse.json({
        imported,
        persisted,
        backend_synced: backendSynced,
        backend_sync_truncated: backendSyncTruncated,
        updated: (data.updated as number | undefined) ?? null,
        total_gsc: (data.total_gsc as number | undefined) ?? null,
        total_tracked: allKeywords.length,
        keywords: allKeywords,
        source_endpoint: firstSuccess?.path ?? "probe-only",
        attempted: candidateErrors,
        diagnostics: baseDiagnostics,
      });
    }

    // Nothing came back from any read path. As a last resort trigger the
    // SEO agent — on a fresh tenant it typically pulls GSC top queries on
    // its first run, after which a follow-up import call will find data.
    if (!deadline.signal.aborted) {
      try {
        const triggerBody: Record<string, unknown> = { reason: "gsc_initial_import" };
        if (limit != null) triggerBody.limit = limit;
        const res = await fetch(`${SAMA_API_URL}/api/tenant/agents/seo/trigger`, {
          method: "POST",
          headers,
          body: JSON.stringify(triggerBody),
          signal: fetchSignal(PER_FETCH_TIMEOUT_MS, deadline.signal),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return NextResponse.json({
            imported: null,
            triggered_agent: true,
            run_id: data.run_id ?? null,
            note: "No direct import endpoint and probes returned 0 keywords — triggered SEO agent. Click 'Import all GSC keywords' again after it finishes; the agent populates the data the probes read from.",
            attempted: candidateErrors,
            diagnostics: baseDiagnostics,
          });
        }
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      {
        error: deadline.signal.aborted
          ? "Import timed out before the SAMA backend responded. Try again, or click 'Sync now'."
          : "Could not import from GSC. The backend doesn't expose a direct import endpoint, all read probes returned 0 keywords, and triggering the SEO agent failed.",
        attempted: candidateErrors,
        diagnostics: baseDiagnostics,
      },
      { status: deadline.signal.aborted ? 504 : 502 },
    );
  } finally {
    deadline.cancel();
  }
}
