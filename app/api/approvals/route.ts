import { NextRequest, NextResponse } from "next/server";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/** GET /api/approvals?status=pending — list pending drafts awaiting review. */
export async function GET(req: NextRequest) {
  if (!SAMA_API_URL) return NextResponse.json({ approvals: [] });
  const status = req.nextUrl.searchParams.get("status") || "pending";
  const tenantId = req.headers.get("X-Tenant-ID") || "";
  try {
    const upstream = await fetch(`${SAMA_API_URL}/api/approvals?status=${status}`, {
      headers: { "X-Tenant-ID": tenantId },
      signal: AbortSignal.timeout(10_000),
    });
    if (upstream.ok) return NextResponse.json(await upstream.json());
  } catch {
    // fall through
  }
  return NextResponse.json({ approvals: [] });
}
