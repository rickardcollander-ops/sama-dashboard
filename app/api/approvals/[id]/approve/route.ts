import { NextRequest } from "next/server";
import { approvalsProxy } from "@/lib/approvals-proxy";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();
  return approvalsProxy(req, `/api/approvals/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body,
  });
}
