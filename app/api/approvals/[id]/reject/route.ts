import { NextRequest, NextResponse } from "next/server";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SAMA_API_URL) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  const tenantId = req.headers.get("X-Tenant-ID") || "";
  const body = await req.text();
  try {
    const upstream = await fetch(`${SAMA_API_URL}/api/approvals/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-ID": tenantId },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
