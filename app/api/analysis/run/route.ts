import { NextRequest, NextResponse } from "next/server";
import { buildMockRun } from "../_mock";
import type { AIPlatform } from "@/app/c/analysis/types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * POST /api/analysis/run
 *
 * Body: { brand_name, domain, competitors, queries, platforms }
 *
 * Once sama-agent has a real /api/analysis/run endpoint that orchestrates
 * SerpAPI + multi-LLM, this route should proxy to it. For now we return
 * deterministic mock data so the UI can be built and demoed end-to-end.
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

  // Future: proxy to sama-agent
  if (SAMA_API_URL && process.env.ANALYSIS_REAL === "1") {
    try {
      const tenantId = req.headers.get("X-Tenant-ID") || "";
      const upstream = await fetch(`${SAMA_API_URL}/api/analysis/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": tenantId,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      if (upstream.ok) return NextResponse.json(await upstream.json());
    } catch {
      // fall through to mock
    }
  }

  const run = buildMockRun({
    brand_name: body.brand_name || "Your Brand",
    domain: body.domain || "example.com",
    competitors: Array.isArray(body.competitors) ? body.competitors : [],
    queries,
    platforms,
  });

  return NextResponse.json(run);
}
