import { NextResponse } from "next/server";
import { getCurrentUser, loadSettings } from "@/lib/integrations/store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const settings = await loadSettings(user.id);
  const geoQueries = Array.isArray(settings.geo_queries)
    ? (settings.geo_queries as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  return NextResponse.json({ geo_queries: geoQueries });
}
