import { NextRequest, NextResponse } from "next/server";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

const EMPTY = {
  window_days: 30,
  resolved_count: 0,
  avg_time_to_answer_seconds: null,
  median_time_to_answer_seconds: null,
  avg_active_seconds: null,
  median_active_seconds: null,
  active_tracked_count: 0,
  by_kind: {},
};

/** GET /api/approvals/stats?days=30 — handling-time metrics for the review queue. */
export async function GET(req: NextRequest) {
  if (!SAMA_API_URL) return NextResponse.json(EMPTY);
  const days = req.nextUrl.searchParams.get("days") || "30";
  const tenantId = req.headers.get("X-Tenant-ID") || "";
  try {
    const upstream = await fetch(`${SAMA_API_URL}/api/approvals/stats?days=${days}`, {
      headers: { "X-Tenant-ID": tenantId },
      signal: AbortSignal.timeout(10_000),
    });
    if (upstream.ok) return NextResponse.json(await upstream.json());
  } catch {
    // fall through
  }
  return NextResponse.json(EMPTY);
}
