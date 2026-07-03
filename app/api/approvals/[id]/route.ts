import { NextRequest } from "next/server";
import { approvalsProxy } from "@/lib/approvals-proxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return approvalsProxy(req, `/api/approvals/${encodeURIComponent(id)}`, {
    timeoutMs: 15_000,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();
  return approvalsProxy(req, `/api/approvals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
    timeoutMs: 15_000,
  });
}
