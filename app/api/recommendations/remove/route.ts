import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/integrations/store";
import {
  getSiteSettingsAccess,
  resolveSiteId,
  type SiteSettingsAccess,
} from "@/lib/integrations/site-context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

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

  const existing = Array.isArray(settings.geo_queries)
    ? (settings.geo_queries as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  const target = query.toLowerCase();
  const next = existing.filter((q) => q.toLowerCase() !== target);
  const removed = existing.length - next.length;

  if (removed > 0) {
    await access.save({
      ...settings,
      geo_queries: next,
      geo_queries_updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ removed, geo_queries: next });
}
