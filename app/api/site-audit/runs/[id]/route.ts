import { NextRequest, NextResponse } from "next/server";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * GET /api/site-audit/runs/{id}
 *
 * One audit with full payload. Used for status polling (status === "running")
 * and for replay (status === "completed" returns the SiteAuditRun shape).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!SAMA_API_URL) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }
  const tenantId = req.headers.get("X-Tenant-ID") || "";
  try {
    const upstream = await fetch(`${SAMA_API_URL}/api/site-audit/runs/${id}`, {
      headers: { "X-Tenant-ID": tenantId },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await upstream.json().catch(() => ({}));
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
