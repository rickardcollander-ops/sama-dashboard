import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser, loadSettings, saveSettings, MAX_GEO_QUERIES,
} from "@/lib/integrations/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const geoQueries: string[] = Array.isArray(body.geo_queries)
    ? body.geo_queries.filter((q: unknown): q is string => typeof q === "string" && q.trim().length > 0)
    : [];
  const keywords: string[] = Array.isArray(body.keywords)
    ? body.keywords.filter((q: unknown): q is string => typeof q === "string" && q.trim().length > 0)
    : [];

  const settings = await loadSettings(user.id);
  const existingGeo = Array.isArray(settings.geo_queries)
    ? (settings.geo_queries as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  // Defensive: trim any historical overflow back to the cap before merging.
  const trimmedExisting = existingGeo.slice(0, MAX_GEO_QUERIES);
  const existingLower = new Set(trimmedExisting.map((q) => q.toLowerCase()));
  const merged = [...trimmedExisting];
  let geoAdded = 0;
  let geoSkippedFull = 0;
  for (const q of geoQueries) {
    if (existingLower.has(q.toLowerCase())) continue;
    if (merged.length >= MAX_GEO_QUERIES) {
      geoSkippedFull += 1;
      continue;
    }
    merged.push(q);
    existingLower.add(q.toLowerCase());
    geoAdded += 1;
  }
  const geoChanged = geoAdded > 0 || merged.length !== existingGeo.length;
  if (geoChanged) {
    await saveSettings(user.id, { ...settings, geo_queries: merged });
  }

  let keywordsAdded = 0;
  let keywordsSkipped = 0;
  if (keywords.length > 0) {
    // Persist locally to user_settings.tracked_keywords (source of truth so
    // the SEO page sees them even if the backend silently drops them).
    const settingsAfterGeo = geoChanged ? { ...settings, geo_queries: merged } : settings;
    const existingTracked: string[] = Array.isArray(settingsAfterGeo.tracked_keywords)
      ? (settingsAfterGeo.tracked_keywords as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [];
    const trackedLower = new Set(existingTracked.map((k) => k.toLowerCase()));
    const trackedMerged = [...existingTracked];
    for (const kw of keywords) {
      if (!trackedLower.has(kw.toLowerCase())) {
        trackedMerged.push(kw);
        trackedLower.add(kw.toLowerCase());
        keywordsAdded += 1;
      } else {
        keywordsSkipped += 1;
      }
    }
    if (keywordsAdded > 0) {
      await saveSettings(user.id, { ...settingsAfterGeo, tracked_keywords: trackedMerged });
    }

    // Best-effort: forward to backend so the SEO agent picks them up too.
    const backend = process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";
    for (const kw of keywords) {
      try {
        await fetch(`${backend}/api/seo/keywords/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tenant-ID": user.id,
          },
          body: JSON.stringify({ keyword: kw }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        // backend unreachable — local persistence already succeeded
      }
    }
  }

  return NextResponse.json({
    geo_added: geoAdded,
    geo_skipped_full: geoSkippedFull,
    geo_max: MAX_GEO_QUERIES,
    geo_queries: merged,
    keywords_added: keywordsAdded,
    keywords_skipped: keywordsSkipped,
  });
}
