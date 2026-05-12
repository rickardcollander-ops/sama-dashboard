import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, MAX_GEO_QUERIES } from "@/lib/integrations/store";
import {
  getSiteSettingsAccess,
  resolveSiteId,
  type SiteSettingsAccess,
} from "@/lib/integrations/site-context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
  const settings = access.settings;

  const geoQueries = (
    Array.isArray(settings.geo_queries)
      ? (settings.geo_queries as unknown[]).filter((v): v is string => typeof v === "string")
      : []
  ).slice(0, MAX_GEO_QUERIES);

  let updatedAt =
    typeof settings.geo_queries_updated_at === "string"
      ? settings.geo_queries_updated_at
      : null;

  // Backfill the timestamp for tenants whose geo_queries were seeded or
  // saved before geo_queries_updated_at started being tracked. Without
  // this the dashboard would either show a misleading "you haven't set
  // up questions yet" banner forever or have to special-case the null.
  if (!updatedAt && geoQueries.length > 0) {
    updatedAt = new Date().toISOString();
    try {
      await access.save({ ...settings, geo_queries_updated_at: updatedAt });
    } catch {
      // Non-fatal: surface the in-memory value to the client anyway so
      // the banner heuristic has something to work with this load.
    }
  }

  return NextResponse.json({
    geo_queries: geoQueries,
    geo_max: MAX_GEO_QUERIES,
    geo_queries_updated_at: updatedAt,
  });
}
