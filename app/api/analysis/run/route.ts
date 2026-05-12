import { NextRequest, NextResponse } from "next/server";
import { buildMockRun } from "../_mock";
import { buildBackendAuth } from "@/lib/integrations/backend-auth";
import type { AIPlatform } from "@/app/c/analysis/types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * POST /api/analysis/run
 *
 * Body: { queries, platforms?, brand_name?, domain?, competitors? }
 *
 * - If NEXT_PUBLIC_SAMA_API_URL is set, we forward the full body to
 *   sama-agent /api/analysis/run. The backend returns {id, status: "running"}
 *   and the frontend polls /runs/{id}. Backend errors are surfaced verbatim
 *   (no silent mock fallback) so users can see what's wrong.
 * - If NEXT_PUBLIC_SAMA_API_URL is NOT set, or the caller passes ?mock=1,
 *   we return a deterministic mock so the UI works in local dev. The mock
 *   is tagged with _source: "mock" so the UI can display a banner.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const forceMock = req.nextUrl.searchParams.get("mock") === "1";

  const platforms: AIPlatform[] = Array.isArray(body.platforms) && body.platforms.length
    ? body.platforms
    : ["chatgpt", "claude", "perplexity", "google_aio"];

  const queries: string[] = Array.isArray(body.queries) ? body.queries.filter(Boolean) : [];
  if (queries.length === 0) {
    return NextResponse.json({ error: "queries required" }, { status: 400 });
  }

  if (SAMA_API_URL && !forceMock) {
    const auth = await buildBackendAuth(req, "application/json");
    let upstreamStatus = 0;
    let upstreamBodyText = "";
    try {
      const upstream = await fetch(`${SAMA_API_URL}/api/analysis/run`, {
        method: "POST",
        headers: auth.headers,
        // Forward the full body so the backend can override the tenant's
        // stored brand context with whatever the user just typed in.
        body: JSON.stringify({
          queries,
          platforms,
          brand_name: body.brand_name,
          domain: body.domain,
          competitors: body.competitors,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      upstreamStatus = upstream.status;
      upstreamBodyText = await upstream.text();
      if (upstream.ok) {
        try {
          const data = JSON.parse(upstreamBodyText);
          if ((data?.id && data?.status) || Array.isArray(data?.query_results)) {
            return NextResponse.json({ ...data, _source: "live" });
          }
          return NextResponse.json(
            {
              error: "Backend returned an unexpected response shape",
              upstream_status: upstreamStatus,
              upstream_body: upstreamBodyText.slice(0, 500),
            },
            { status: 502 },
          );
        } catch {
          return NextResponse.json(
            {
              error: "Backend returned non-JSON",
              upstream_status: upstreamStatus,
              upstream_body: upstreamBodyText.slice(0, 500),
            },
            { status: 502 },
          );
        }
      }
      // Surface non-2xx upstream errors directly — no silent mock fallback.
      return NextResponse.json(
        {
          error: "Backend returned an error",
          upstream_status: upstreamStatus,
          upstream_body: upstreamBodyText.slice(0, 500),
        },
        { status: 502 },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not reach backend";
      return NextResponse.json(
        { error: `Backend unreachable: ${msg}`, sama_api_url: SAMA_API_URL },
        { status: 502 },
      );
    }
  }

  // Mock path — only when no backend is configured (local dev) or explicitly
  // requested via ?mock=1. Tag the payload so the UI shows a banner.
  const run = buildMockRun({
    brand_name: body.brand_name || "Your Brand",
    domain: body.domain || "example.com",
    competitors: Array.isArray(body.competitors) ? body.competitors : [],
    queries,
    platforms,
  });
  return NextResponse.json({
    ...run,
    _source: "mock",
    _mock_reason: forceMock
      ? "Mock requested via ?mock=1"
      : "NEXT_PUBLIC_SAMA_API_URL is not set — connect the backend to run a real analysis.",
  });
}
