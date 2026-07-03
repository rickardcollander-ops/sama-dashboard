import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMA_API_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { userId } = guard;

  const body = await req.json().catch(() => ({}));
  const overrideRaw = typeof body?.recipient_override === "string" ? body.recipient_override.trim() : "";
  if (overrideRaw && !EMAIL_RE.test(overrideRaw)) {
    return NextResponse.json({ error: "Ogiltig e-postadress" }, { status: 400 });
  }
  const recipient_override = overrideRaw || null;

  const upstream = await fetch(`${SAMA_API_URL}/api/email/weekly/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, recipient_override }),
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: data?.detail || data?.error || "send_failed", upstream: data },
      { status: upstream.status }
    );
  }
  return NextResponse.json(data);
}
