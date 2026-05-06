import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, MAX_GEO_QUERIES } from "@/lib/integrations/store";
import { getSiteSettingsAccess, resolveSiteId } from "@/lib/integrations/site-context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const siteId = resolveSiteId(req, user.id);
  let settings: Record<string, unknown>;
  try {
    settings = (await getSiteSettingsAccess(user, siteId)).settings;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load tenant settings" },
      { status: 500 },
    );
  }

  const geoQueries = (
    Array.isArray(settings.geo_queries)
      ? (settings.geo_queries as unknown[]).filter((v): v is string => typeof v === "string")
      : []
  ).slice(0, MAX_GEO_QUERIES);

  return NextResponse.json({ geo_queries: geoQueries, geo_max: MAX_GEO_QUERIES });
}
