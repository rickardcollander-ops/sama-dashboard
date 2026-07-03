import { NextRequest } from "next/server";
import { approvalsProxy } from "@/lib/approvals-proxy";

/** GET /api/approvals?status=pending — list pending drafts awaiting review. */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") || "pending";
  return approvalsProxy(req, `/api/approvals?status=${encodeURIComponent(status)}`, {
    fallback: { approvals: [] },
  });
}
