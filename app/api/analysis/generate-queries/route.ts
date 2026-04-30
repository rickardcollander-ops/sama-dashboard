import { NextRequest, NextResponse } from "next/server";
import { suggestQueries } from "../_mock";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * POST /api/analysis/generate-queries
 *
 * Body: { brand_name, domain, brand_description?, unique_selling_points?, target_audience? }
 *
 * Returns 10–25 candidate buyer-intent queries the user can edit/approve before
 * running the full analysis. Real implementation uses an LLM in sama-agent.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (SAMA_API_URL && process.env.ANALYSIS_REAL === "1") {
    try {
      const tenantId = req.headers.get("X-Tenant-ID") || "";
      const upstream = await fetch(`${SAMA_API_URL}/api/analysis/generate-queries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": tenantId,
        },
        body: JSON.stringify(body),
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
