import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings } from "@/lib/integrations/store";
import type { AnalysisRun } from "@/app/c/analysis/types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

async function loadSavedRun(id: string): Promise<AnalysisRun | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const settings = await loadSettings(user.id);
    const saved = Array.isArray(settings.saved_analyses)
      ? (settings.saved_analyses as AnalysisRun[])
      : [];
    return saved.find((r) => r && r.id === id) || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/analysis/runs/{id}
 *
 * Single run with full payload. Used for status polling (status === "running")
 * and for replay (status === "completed" returns the AnalysisRun shape).
 *
 * Falls back to user_settings.saved_analyses when the backend cannot serve
 * the run (404, network error, or not configured) so a previously completed
 * analysis is still openable from history.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tenantId = req.headers.get("X-Tenant-ID") || "";

  if (SAMA_API_URL) {
    try {
      const upstream = await fetch(`${SAMA_API_URL}/api/analysis/runs/${id}`, {
        headers: { "X-Tenant-ID": tenantId },
        signal: AbortSignal.timeout(15_000),
      });
      const text = await upstream.text();
      let body: unknown = {};
      try { body = JSON.parse(text); } catch { body = { error: "non-JSON response", upstream_body: text.slice(0, 500) }; }
      if (upstream.ok && body && typeof body === "object") {
        (body as Record<string, unknown>)._source = "live";
        return NextResponse.json(body, { status: upstream.status });
      }
      const saved = await loadSavedRun(id);
      if (saved) return NextResponse.json({ ...saved, _source: "saved" });
      return NextResponse.json(body, { status: upstream.status });
    } catch (e) {
      const saved = await loadSavedRun(id);
      if (saved) return NextResponse.json({ ...saved, _source: "saved" });
      const msg = e instanceof Error ? e.message : "Upstream unavailable";
      return NextResponse.json({ error: `Upstream unavailable: ${msg}` }, { status: 502 });
    }
  }

  const saved = await loadSavedRun(id);
  if (saved) return NextResponse.json({ ...saved, _source: "saved" });
  return NextResponse.json(
    { error: "Backend not configured (NEXT_PUBLIC_SAMA_API_URL)" },
    { status: 503 },
  );
}
