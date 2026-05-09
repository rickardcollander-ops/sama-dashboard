import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMA_API_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

interface SendNowBody {
  recipient_override?: string | null;
  // When true, the agent prefixes the subject with [TEST] and bypasses the
  // weekly dedupe window. Default true so this never blasts the user with a
  // duplicate of their real Monday email.
  test?: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { userId } = await params;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as SendNowBody;
  const overrideRaw =
    typeof body.recipient_override === "string" ? body.recipient_override.trim() : "";
  const recipient_override = overrideRaw || null;

  // The agent's existing /api/email/weekly/test always sends as test, which
  // is what we want here: no dedupe collision, [TEST] prefix in subject.
  const upstream = await fetch(`${SAMA_API_URL}/api/email/weekly/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, recipient_override }),
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: data?.detail || data?.error || "send_failed", upstream: data },
      { status: upstream.status },
    );
  }
  return NextResponse.json(data);
}
