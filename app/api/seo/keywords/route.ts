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

  const backendMap = new Map<string, BackendKeyword>();
  try {
    const res = await fetch(`${SAMA_API_URL}/api/seo/keywords?limit=1000`, {
      method: "GET",
      headers: {
        "X-Tenant-ID": siteId,
        "X-Sama-Site-Id": siteId,
        "X-Sama-Account-Id": accountId,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const list: BackendKeyword[] = Array.isArray(data?.keywords) ? data.keywords : [];
      for (const k of list) {
        if (k && typeof k.keyword === "string") {
          backendMap.set(k.keyword.toLowerCase(), normalizeCtr(k));
        }
      }
    }
  } catch {
    // Backend unreachable — fall back to local-only list
  }

  const seen = new Set<string>();
  const out: BackendKeyword[] = [];
  for (const kw of local) {
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const fromBackend = backendMap.get(key);
    out.push(
      fromBackend ?? { keyword: kw, position: 0, clicks: 0, impressions: 0, ctr: 0 },
    );
  }
  for (const [key, kw] of backendMap) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
  }

  return NextResponse.json({ keywords: out });
}
