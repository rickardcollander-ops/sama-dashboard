import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings } from "@/lib/integrations/store";
import { getSiteSettingsAccess, resolveSiteId } from "@/lib/integrations/site-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMA_API_URL =
  process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

interface BackendKeyword {
  keyword: string;
  position?: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position_history?: { date: string; position: number }[];
}

/**
 * The customer SEO page renders CTR as `(ctr * 100).toFixed()` — i.e. it
 * expects a fraction in `[0, 1]`. The Sama backend has historically been
 * inconsistent (sometimes returning a percentage in `[0, 100]`, which then
 * shows up as four-digit "CTR" on the dashboard, e.g. 4111.0%).
 *
 * We always recompute from clicks/impressions when both are present, and
 * otherwise rescale anything > 1 down to a fraction. This makes the
 * frontend immune to whichever convention upstream uses.
 */
function normalizeCtr(k: BackendKeyword): BackendKeyword {
  const clicks = typeof k.clicks === "number" ? k.clicks : 0;
  const impressions = typeof k.impressions === "number" ? k.impressions : 0;
  let ctr: number;
  if (impressions > 0) {
    ctr = clicks / impressions;
  } else if (typeof k.ctr === "number" && Number.isFinite(k.ctr)) {
    ctr = k.ctr > 1 ? k.ctr / 100 : k.ctr;
  } else {
    ctr = 0;
  }
  return { ...k, ctr };
}

function backendHeaders(siteId: string, accountId: string): Record<string, string> {
  return {
    "X-Tenant-ID": siteId,
    "X-Sama-Site-Id": siteId,
    "X-Sama-Account-Id": accountId,
  };
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function extractMetricKeyword(item: unknown): BackendKeyword | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const kw = obj.keyword ?? obj.query ?? obj.text;
  if (typeof kw !== "string" || !kw.trim()) return null;
  const history = Array.isArray(obj.position_history)
    ? (obj.position_history as { date: string; position: number }[])
    : undefined;
  return {
    keyword: kw.trim(),
    position: num(obj.position) ?? num(obj.avg_position) ?? num(obj.average_position),
    clicks: num(obj.clicks),
    impressions: num(obj.impressions),
    ctr: num(obj.ctr),
    position_history: history,
  };
}

/**
 * The backend's `/api/seo/keywords` returns the tenant's tracked list but
 * historically does NOT join GSC metrics onto it — clicks/impressions/CTR/
 * position all come back zero or missing, which is why the dashboard table
 * was showing "--" / 0 for every row even when GSC data existed.
 *
 * The GSC stats live behind a different family of endpoints (sync-gsc
 * populates them, and they're read via /api/seo/gsc/queries or one of its
 * aliases — different backend builds expose different paths). We probe the
 * same set as the GSC import route, take the first one that returns rows,
 * and key the metrics by lowercased keyword so the GET below can layer
 * them on top of the canonical list.
 */
async function fetchBackendGscMetrics(
  siteId: string,
  accountId: string,
): Promise<Map<string, BackendKeyword>> {
  const headers = backendHeaders(siteId, accountId);
  const candidates = [
    "/api/seo/gsc/queries?limit=1000",
    "/api/seo/search-console/queries?limit=1000",
    "/api/seo/gsc/top-queries?limit=1000",
    "/api/integrations/gsc/queries?limit=1000",
    "/api/seo/keywords/gsc?limit=1000",
    "/api/seo/keywords/all?limit=1000",
    "/api/seo/rankings?limit=1000",
    "/api/seo/metrics?limit=1000",
  ];

  const probes = await Promise.all(
    candidates.map(async (path): Promise<BackendKeyword[]> => {
      try {
        const res = await fetch(`${SAMA_API_URL}${path}`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return [];
        const data = await res.json().catch(() => ({}));
        const list = (data?.queries ?? data?.keywords ?? data?.items ?? data) as unknown;
        if (!Array.isArray(list)) return [];
        return list
          .map(extractMetricKeyword)
          .filter((k): k is BackendKeyword => k !== null);
      } catch {
        return [];
      }
    }),
  );

  // Take the first non-empty probe — additional candidates typically alias
  // the same dataset, and merging across them would double-count if any
  // shared keys diverge.
  const first = probes.find((p) => p.length > 0) ?? [];
  const out = new Map<string, BackendKeyword>();
  for (const k of first) {
    out.set(k.keyword.toLowerCase(), normalizeCtr(k));
  }
  return out;
}

function hasMetrics(k: BackendKeyword | undefined): boolean {
  if (!k) return false;
  return (
    (typeof k.position === "number" && k.position > 0) ||
    (typeof k.clicks === "number" && k.clicks > 0) ||
    (typeof k.impressions === "number" && k.impressions > 0)
  );
}

function mergeMetrics(
  base: BackendKeyword | undefined,
  gsc: BackendKeyword | undefined,
  fallbackKeyword: string,
): BackendKeyword {
  // GSC wins when it has real numbers — the canonical /api/seo/keywords
  // often returns the tracked row with no metrics joined. When GSC has
  // nothing either, fall back to whatever the canonical row had so we
  // don't downgrade existing data.
  if (hasMetrics(gsc)) {
    return normalizeCtr({
      keyword: gsc!.keyword || base?.keyword || fallbackKeyword,
      position: gsc!.position ?? base?.position,
      clicks: gsc!.clicks ?? base?.clicks,
      impressions: gsc!.impressions ?? base?.impressions,
      ctr: gsc!.ctr ?? base?.ctr,
      position_history: gsc!.position_history ?? base?.position_history,
    });
  }
  if (base) return base;
  return { keyword: fallbackKeyword, position: 0, clicks: 0, impressions: 0, ctr: 0 };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Honor the X-Sama-Site-Id / X-Tenant-ID headers the dashboard sends
  // (set by samaHeaders() in admin view-as mode). Without this the route
  // would always fetch the calling admin's own keywords and leak them
  // into the customer's view.
  const siteId = resolveSiteId(req, user.id);
  // The backend's TenantMiddleware silently swallows protected GETs that
  // only carry the legacy X-Tenant-ID header (returns 200 {} when no
  // account_id is resolvable). The browser sends X-Sama-Account-Id via
  // samaHeaders(); fall back to user.id so legacy callers keep working.
  const accountId = req.headers.get("X-Sama-Account-Id") || user.id;

  // Read locally tracked keywords from the right scope. For self-view we
  // keep the legacy user_settings store; for view-as on a different tenant
  // we read from the site-scoped user_sites row (admin uses service role
  // inside getSiteSettingsAccess) so we don't bleed the admin's list in.
  // Site row not yet readable (e.g. RLS race during onboarding) is treated
  // as empty rather than leaking another site's keywords.
  let local: string[] = [];
  try {
    if (siteId === user.id) {
      const settings = await loadSettings(user.id);
      local = Array.isArray(settings.tracked_keywords)
        ? (settings.tracked_keywords as unknown[]).filter((v): v is string => typeof v === "string")
        : [];
    } else {
      const access = await getSiteSettingsAccess(user, siteId);
      local = Array.isArray(access.settings.tracked_keywords)
        ? (access.settings.tracked_keywords as unknown[]).filter(
            (v): v is string => typeof v === "string",
          )
        : [];
    }
  } catch {
    local = [];
  }

  // Fetch the canonical tracked list and the GSC metrics in parallel. The
  // canonical list defines what should show up; GSC fills in the numbers
  // the canonical endpoint historically omitted.
  const [backendMap, gscMap] = await Promise.all([
    (async () => {
      const map = new Map<string, BackendKeyword>();
      try {
        const res = await fetch(`${SAMA_API_URL}/api/seo/keywords?limit=1000`, {
          method: "GET",
          headers: backendHeaders(siteId, accountId),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const list: BackendKeyword[] = Array.isArray(data?.keywords) ? data.keywords : [];
          for (const k of list) {
            if (k && typeof k.keyword === "string") {
              map.set(k.keyword.toLowerCase(), normalizeCtr(k));
            }
          }
        }
      } catch {
        // Backend unreachable — fall back to local-only list
      }
      return map;
    })(),
    fetchBackendGscMetrics(siteId, accountId).catch(
      () => new Map<string, BackendKeyword>(),
    ),
  ]);

  const seen = new Set<string>();
  const out: BackendKeyword[] = [];
  for (const kw of local) {
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mergeMetrics(backendMap.get(key), gscMap.get(key), kw));
  }
  for (const [key, kw] of backendMap) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mergeMetrics(kw, gscMap.get(key), kw.keyword));
  }
  // Keywords that exist only in GSC (the user ranks for them but hasn't
  // added them to the tracked list) — surface them too so the dashboard
  // doesn't hide real traffic the moment we found a metrics source.
  for (const [key, kw] of gscMap) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
  }

  return NextResponse.json({ keywords: out });
}
