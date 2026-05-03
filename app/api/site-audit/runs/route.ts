import { NextRequest, NextResponse } from "next/server";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * GET /api/site-audit/runs?limit=20
 *
 * Recent audits for the calling tenant. Returns {runs: []} if the backend is
 * unavailable so the UI can show an empty state instead of erroring.
 */
export async function GET(req: NextRequest) {
  if (!SAMA_API_URL) return NextResponse.json({ runs: [] });
  const tenantId = req.headers.get("X-Tenant-ID") || "";
  const limit = req.nextUrl.searchParams.get("limit") || "20";
  try {
    const upstream = await fetch(`${SAMA_API_URL}/api/site-audit/runs?limit=${limit}`, {
      headers: { "X-Tenant-ID": tenantId },
      signal: AbortSignal.timeout(10_000),
    });
    if (upstream.ok) return NextResponse.json(await upstream.json());
  } catch {
    // fall through
  }
  return NextResponse.json({ runs: [] });
}
