import { NextResponse } from "next/server";
import { getCurrentUser, loadSettings } from "@/lib/integrations/store";

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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const settings = await loadSettings(user.id);
  const local: string[] = Array.isArray(settings.tracked_keywords)
    ? (settings.tracked_keywords as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  const backendMap = new Map<string, BackendKeyword>();
  try {
    const res = await fetch(`${SAMA_API_URL}/api/seo/keywords`, {
      method: "GET",
      headers: { "X-Tenant-ID": user.id },
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
