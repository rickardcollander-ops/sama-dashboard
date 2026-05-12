import { NextRequest, NextResponse } from "next/server";
import { suggestQueries } from "../_mock";
import { buildBackendAuth } from "@/lib/integrations/backend-auth";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * POST /api/analysis/generate-queries
 *
 * Real backend asks the LLM with the tenant's brand context and returns
 * 10 buyer-intent queries. If the backend is configured but errors, we
 * surface the error rather than silently returning template queries —
 * otherwise users have no way to see that their LLM call failed.
 *
 * Templates are only used when no backend is configured.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (SAMA_API_URL) {
    const auth = await buildBackendAuth(req, "application/json");
    try {
      const upstream = await fetch(`${SAMA_API_URL}/api/analysis/generate-queries`, {
        method: "POST",
        headers: auth.headers,
        body: JSON.stringify({ count: body.count ?? 10 }),
        signal: AbortSignal.timeout(60_000),
      });
      const text = await upstream.text();
      if (upstream.ok) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data?.queries) && data.queries.length > 0) {
            return NextResponse.json({ ...data, _source: "live" });
          }
        } catch {
          // fall through to error branch below
        }
      }
      return NextResponse.json(
        {
          error: "Backend could not generate queries",
          upstream_status: upstream.status,
          upstream_body: text.slice(0, 500),
        },
        { status: 502 },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Backend unreachable";
      return NextResponse.json({ error: `Backend unreachable: ${msg}` }, { status: 502 });
    }
  }

  const queries = suggestQueries({
    brand_name: body.brand_name || "Your Brand",
    domain: body.domain || "example.com",
    brand_description: body.brand_description,
    unique_selling_points: body.unique_selling_points,
    target_audience: body.target_audience,
  });
  return NextResponse.json({
    queries,
    _source: "mock",
    _mock_reason: "NEXT_PUBLIC_SAMA_API_URL is not set",
  });
}
