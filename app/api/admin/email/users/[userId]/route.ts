import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  weekly_email_enabled?: boolean;
  recipient_override?: string | null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { userId } = await params;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;

  // Read current settings so we can merge notification_preferences without
  // clobbering other keys the user (or another admin) set.
  const { data: existing, error: readErr } = await admin
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr && readErr.code !== "PGRST116") {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const settings = (existing?.settings as Record<string, unknown>) || {};
  const notif = ((settings.notification_preferences as Record<string, unknown>) || {}) as {
    weekly_email_enabled?: boolean;
    recipient_override?: string | null;
  };

  if (typeof body.weekly_email_enabled === "boolean") {
    notif.weekly_email_enabled = body.weekly_email_enabled;
  }
  if (body.recipient_override === null) {
    notif.recipient_override = null;
  } else if (typeof body.recipient_override === "string") {
    const v = body.recipient_override.trim();
    notif.recipient_override = v || null;
  }

  settings.notification_preferences = notif;

  const { error: writeErr } = await admin
    .from("user_settings")
    .upsert({ user_id: userId, settings }, { onConflict: "user_id" });
  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({
    user_id: userId,
    weekly_email_enabled: !!notif.weekly_email_enabled,
    recipient_override: notif.recipient_override ?? null,
  });
}
