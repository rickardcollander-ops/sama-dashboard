import { NextRequest, NextResponse } from "next/server";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

async function proxy(req: NextRequest, path: string, method: "GET" | "PATCH" | "POST") {
  if (!SAMA_API_URL) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  const tenantId = req.headers.get("X-Tenant-ID") || "";
  const body = method !== "GET" ? await req.text() : undefined;
  try {
    const upstream = await fetch(`${SAMA_API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": tenantId,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxy(req, `/api/approvals/${id}`, "GET");
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxy(req, `/api/approvals/${id}`, "PATCH");
}
