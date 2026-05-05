import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings } from "@/lib/integrations/store";
import type { AnalysisRun } from "@/app/c/analysis/types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

interface RunSummary {
  id: string;
  brand_name: string | null;
  domain: string | null;
  query_count: number;
  platform_count: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

function summarizeSavedRun(run: AnalysisRun): RunSummary {
  return {
    id: run.id,
    brand_name: run.brand_name || null,
    domain: run.domain || null,
    query_count: Array.isArray(run.query_results) ? run.query_results.length : 0,
    platform_count: Array.isArray(run.platforms) ? run.platforms.length : 0,
    status: run.status || "completed",
    started_at: run.created_at || new Date().toISOString(),
    completed_at: run.created_at || null,
    error: null,
  };
}

/**
 * GET /api/analysis/runs?limit=20
 *
 * Recent analysis runs for the calling tenant. Merges saved local runs
 * (user_settings.saved_analyses) with backend runs so history survives even
 * when the upstream agent backend is paused or unreachable.
 */
export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
  const tenantId = req.headers.get("X-Tenant-ID") || "";

  let backendRuns: RunSummary[] = [];
  if (SAMA_API_URL) {
    try {
      const upstream = await fetch(`${SAMA_API_URL}/api/analysis/runs?limit=${limit}`, {
        headers: { "X-Tenant-ID": tenantId },
        signal: AbortSignal.timeout(10_000),
      });
      if (upstream.ok) {
        const data = await upstream.json();
        if (Array.isArray(data?.runs)) backendRuns = data.runs as RunSummary[];
      }
    } catch {
      // fall through — local saves still get returned below
    }
  }

  let savedRuns: RunSummary[] = [];
  try {
    const user = await getCurrentUser();
    if (user) {
      const settings = await loadSettings(user.id);
      const saved = Array.isArray(settings.saved_analyses)
        ? (settings.saved_analyses as AnalysisRun[])
        : [];
      savedRuns = saved.map(summarizeSavedRun);
    }
  } catch {
    // unauthenticated or settings unreadable — skip local merge
  }

  const seen = new Set<string>();
  const merged: RunSummary[] = [];
  for (const r of [...backendRuns, ...savedRuns]) {
    if (!r?.id || seen.has(r.id)) continue;
    seen.add(r.id);
    merged.push(r);
  }
  merged.sort((a, b) => {
    const ta = Date.parse(a.started_at || "") || 0;
    const tb = Date.parse(b.started_at || "") || 0;
    return tb - ta;
  });

  return NextResponse.json({ runs: merged.slice(0, limit) });
}
