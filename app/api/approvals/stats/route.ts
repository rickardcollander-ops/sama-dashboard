import { NextRequest } from "next/server";
import { approvalsProxy } from "@/lib/approvals-proxy";

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
  const days = req.nextUrl.searchParams.get("days") || "30";
  return approvalsProxy(req, `/api/approvals/stats?days=${encodeURIComponent(days)}`, {
    fallback: EMPTY,
  });
}
