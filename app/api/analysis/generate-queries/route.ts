import { NextRequest, NextResponse } from "next/server";
import { suggestQueries } from "../_mock";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * POST /api/analysis/generate-queries
 *
 * Real backend asks the LLM with the tenant's brand context and returns
 * 10 buyer-intent queries. Falls back to deterministic templates so the UI
 * never blocks on backend availability.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (SAMA_API_URL) {
    try {
      const tenantId = req.headers.get("X-Tenant-ID") || "";
      const upstream = await fetch(`${SAMA_API_URL}/api/analysis/generate-queries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": tenantId,
        },
        body: JSON.stringify({ count: body.count ?? 10 }),
        signal: AbortSignal.timeout(30_000),
      });
      if (upstream.ok) return NextResponse.json(await upstream.json());
    } catch {
      // fall through to mock
    }
  }

  const queries = suggestQueries({
    brand_name: body.brand_name || "Your Brand",
    domain: body.domain || "example.com",
    brand_description: body.brand_description,
    unique_selling_points: body.unique_selling_points,
    target_audience: body.target_audience,
  });

  return NextResponse.json({ queries });
}
