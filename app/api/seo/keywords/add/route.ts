import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings, saveSettings } from "@/lib/integrations/store";

export const runtime = "nodejs";

const SAMA_API_URL =
  process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const single = typeof body.keyword === "string" ? [body.keyword] : [];
  const many = Array.isArray(body.keywords)
    ? body.keywords.filter((k: unknown): k is string => typeof k === "string")
    : [];
  const inputs = [...single, ...many].map((k) => k.trim()).filter(Boolean);
  if (inputs.length === 0) {
    return NextResponse.json({ error: "no keywords provided" }, { status: 400 });
  }

  const settings = await loadSettings(user.id);
  const existing: string[] = Array.isArray(settings.tracked_keywords)
    ? (settings.tracked_keywords as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const lower = new Set(existing.map((k) => k.toLowerCase()));
  const merged = [...existing];
  let added = 0;
  for (const kw of inputs) {
    if (!lower.has(kw.toLowerCase())) {
      merged.push(kw);
      lower.add(kw.toLowerCase());
      added += 1;
    }
  }
  if (added > 0) {
    await saveSettings(user.id, { ...settings, tracked_keywords: merged });
  }

  let backendSynced = 0;
  for (const kw of inputs) {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/keywords/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": user.id },
        body: JSON.stringify({ keyword: kw }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) backendSynced += 1;
    } catch {
      // backend unreachable — local persistence is the source of truth
    }
  }

  return NextResponse.json({
    added,
    backend_synced: backendSynced,
    total: merged.length,
    keywords: merged,
  });
}
