import { NextRequest, NextResponse } from "next/server";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * GET /api/analysis/runs/{id}
 *
 * Single run with full payload. Used for status polling (status === "running")
 * and for replay (status === "completed" returns the AnalysisRun shape).
 *
 * Backend status is preserved verbatim so the polling loop can distinguish
 * between transient errors and permanent failures.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!SAMA_API_URL) {
    return NextResponse.json(
      { error: "Backend not configured (NEXT_PUBLIC_SAMA_API_URL)" },
      { status: 503 },
    );
  }
  const tenantId = req.headers.get("X-Tenant-ID") || "";
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
    }
    return NextResponse.json(body, { status: upstream.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upstream unavailable";
    return NextResponse.json({ error: `Upstream unavailable: ${msg}` }, { status: 502 });
  }
}
