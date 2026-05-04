import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings, saveSettings } from "@/lib/integrations/store";

export const runtime = "nodejs";

const SAMA_API_URL =
  process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

function extractKeywordStrings(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  const out: string[] = [];
  for (const item of payload) {
    if (typeof item === "string") {
      const v = item.trim();
      if (v) out.push(v);
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const v = (obj.keyword ?? obj.query ?? obj.text) as unknown;
      if (typeof v === "string" && v.trim()) out.push(v.trim());
    }
  }
  return out;
}

async function persistTrackedKeywords(userId: string, keywords: string[]): Promise<number> {
  if (keywords.length === 0) return 0;
  const settings = await loadSettings(userId);
  const existing: string[] = Array.isArray(settings.tracked_keywords)
    ? (settings.tracked_keywords as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const lower = new Set(existing.map((k) => k.toLowerCase()));
  const merged = [...existing];
  let added = 0;
  for (const kw of keywords) {
    if (!lower.has(kw.toLowerCase())) {
      merged.push(kw);
      lower.add(kw.toLowerCase());
      added += 1;
    }
  }
  if (added > 0) {
    await saveSettings(userId, { ...settings, tracked_keywords: merged });
  }
  return added;
}

/**
 * Imports the user's top GSC search queries as tracked keywords.
 *
 * The SAMA backend exposes one of several plausible endpoints for this. We
 * try them in order and return the first success. If all fail with 404 we
 * fall back to triggering the SEO agent — which on a fresh tenant will
 * typically pull GSC top queries as part of its first run.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);

  const headers = {
    "Content-Type": "application/json",
    "X-Tenant-ID": user.id,
  };

  const candidates = [
    { path: "/api/seo/keywords/import-gsc", body: { limit } },
    { path: "/api/seo/import-from-gsc", body: { limit } },
    { path: "/api/seo/keywords/import", body: { source: "gsc", limit } },
    { path: "/api/seo/sync", body: { source: "gsc", import_top: limit } },
  ];

  const errors: string[] = [];
  for (const c of candidates) {
    try {
      const res = await fetch(`${SAMA_API_URL}${c.path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(c.body),
      });
      if (res.status === 404) {
        errors.push(`${c.path}: 404`);
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        errors.push(`${c.path}: ${res.status} ${text.slice(0, 120)}`);
        continue;
      }
      const data = await res.json().catch(() => ({}));
      const returned = extractKeywordStrings(data?.keywords ?? data?.queries ?? data?.items);
      const persisted = await persistTrackedKeywords(user.id, returned);
      const importedCount = data.imported ?? data.count ?? data.added ?? persisted;
      return NextResponse.json({
        imported: importedCount,
        persisted,
        keywords: returned,
        source_endpoint: c.path,
      });
    } catch (e) {
      errors.push(`${c.path}: ${e instanceof Error ? e.message : "fetch failed"}`);
    }
  }

  // Fallback: trigger the SEO agent — it should pull GSC data on first run
  try {
    const res = await fetch(`${SAMA_API_URL}/api/tenant/agents/seo/trigger`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reason: "gsc_initial_import", limit }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({
        imported: null,
        triggered_agent: true,
        run_id: data.run_id,
        note: "No direct import endpoint found — triggered SEO agent instead. It will pull GSC data in the background.",
      });
    }
  } catch {
    // ignore
  }

  return NextResponse.json(
    {
      error:
        "Could not import from GSC. The backend doesn't expose a direct import endpoint and triggering the SEO agent failed. Try clicking 'Sync now' or check the agent runs.",
      attempted: errors,
    },
    { status: 502 },
  );
}
