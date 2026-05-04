import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings, saveSettings } from "@/lib/integrations/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const settings = await loadSettings(user.id);
  const existing = Array.isArray(settings.geo_queries)
    ? (settings.geo_queries as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  const target = query.toLowerCase();
  const next = existing.filter((q) => q.toLowerCase() !== target);
  const removed = existing.length - next.length;

  if (removed > 0) {
    await saveSettings(user.id, { ...settings, geo_queries: next });
  }

  return NextResponse.json({ removed, geo_queries: next });
}
