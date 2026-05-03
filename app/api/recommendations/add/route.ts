import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings, saveSettings } from "@/lib/integrations/store";

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
  const existingLower = new Set(existingGeo.map((q) => q.toLowerCase()));
  const merged = [...existingGeo];
  let geoAdded = 0;
  for (const q of geoQueries) {
    if (!existingLower.has(q.toLowerCase())) {
      merged.push(q);
      existingLower.add(q.toLowerCase());
      geoAdded += 1;
    }
  }
  if (geoAdded > 0) {
    await saveSettings(user.id, { ...settings, geo_queries: merged });
  }

  let keywordsAdded = 0;
  let keywordsSkipped = 0;
  if (keywords.length > 0) {
    const backend = process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";
    for (const kw of keywords) {
      try {
        const res = await fetch(`${backend}/api/seo/keywords/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tenant-ID": user.id,
          },
          body: JSON.stringify({ keyword: kw }),
        });
        if (res.ok) keywordsAdded += 1;
        else keywordsSkipped += 1;
      } catch {
        keywordsSkipped += 1;
      }
    }
  }

  return NextResponse.json({
    geo_added: geoAdded,
    keywords_added: keywordsAdded,
    keywords_skipped: keywordsSkipped,
  });
}
