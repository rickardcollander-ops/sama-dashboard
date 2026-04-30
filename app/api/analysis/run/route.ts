import { NextRequest, NextResponse } from "next/server";
import { buildMockRun } from "../_mock";
import type { AIPlatform } from "@/app/c/analysis/types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * POST /api/analysis/run
 *
 * Body: { queries, platforms?, brand_name?, domain?, competitors? }
 *
 * Real backend (sama-agent /api/analysis/run) returns {id, status: "running"}
 * immediately while orchestration runs in the background. The frontend then
 * polls /api/analysis/runs/{id}. If the backend is unavailable we fall back
 * to a deterministic mock so the UI keeps working.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const platforms: AIPlatform[] = Array.isArray(body.platforms) && body.platforms.length
    ? body.platforms
    : ["chatgpt", "claude", "perplexity", "google_aio"];

  const queries: string[] = Array.isArray(body.queries) ? body.queries.filter(Boolean) : [];
  if (queries.length === 0) {
    return NextResponse.json({ error: "queries required" }, { status: 400 });
  }

  if (SAMA_API_URL) {
    try {
      const tenantId = req.headers.get("X-Tenant-ID") || "";
      const upstream = await fetch(`${SAMA_API_URL}/api/analysis/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": tenantId,
        },
        body: JSON.stringify({ queries, platforms }),
        signal: AbortSignal.timeout(15_000),
      });
      if (upstream.ok) return NextResponse.json(await upstream.json());
    } catch {
      // fall through to mock
    }
  }

  // Mock fallback — returns a complete AnalysisRun so the UI can render
  // immediately without polling. Caller detects this via presence of
  // `query_results` on the response.
  const run = buildMockRun({
    brand_name: body.brand_name || "Your Brand",
    domain: body.domain || "example.com",
    competitors: Array.isArray(body.competitors) ? body.competitors : [],
    queries,
    platforms,
  });

  return NextResponse.json(run);
}
