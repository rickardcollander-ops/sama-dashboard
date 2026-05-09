import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NotifPrefs {
  weekly_email_enabled?: boolean;
  recipient_override?: string;
}

interface UserRow {
  user_id: string;
  email: string | null;
  brand_name: string | null;
  weekly_email_enabled: boolean;
  recipient_override: string | null;
  last_sent_at: { weekly_status?: string; social_posts?: string };
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  // Page through auth users (admin API caps at 1000 per page).
  const emailById = new Map<string, string>();
  let page = 1;
  const perPage = 200;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const u of data.users) {
      if (u.email) emailById.set(u.id, u.email);
    }
    if (data.users.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }

  // user_settings holds notification_preferences. Anyone without a row
  // is implicitly "weekly off" and shouldn't appear here — we still
  // include them so admin can opt them in.
  const { data: settingsRows, error: settingsErr } = await admin
    .from("user_settings")
    .select("user_id, settings");
  if (settingsErr) {
    return NextResponse.json({ error: settingsErr.message }, { status: 500 });
  }

  const settingsByUser = new Map<string, Record<string, unknown>>();
  for (const row of settingsRows ?? []) {
    settingsByUser.set(
      (row as { user_id: string }).user_id,
      (row as { settings: Record<string, unknown> }).settings || {},
    );
  }

  // Pull the most recent email_send_log row per (user_id, kind) so the
  // table can show "last sent" without a per-row query.
  const { data: lastSentRows } = await admin
    .from("email_send_log")
    .select("user_id, kind, created_at")
    .eq("status", "sent")
    .eq("test", false)
    .order("created_at", { ascending: false })
    .limit(2000);

  const lastSentByUser = new Map<string, { weekly_status?: string; social_posts?: string }>();
  for (const row of (lastSentRows ?? []) as Array<{ user_id: string; kind: string; created_at: string }>) {
    if (!row.user_id) continue;
    const bucket = lastSentByUser.get(row.user_id) ?? {};
    if (row.kind === "weekly_status" && !bucket.weekly_status) bucket.weekly_status = row.created_at;
    if (row.kind === "social_posts" && !bucket.social_posts) bucket.social_posts = row.created_at;
    lastSentByUser.set(row.user_id, bucket);
  }

  // Build the unified list. Anchor on auth users, fall back to settings
  // rows for any user without an auth record (legacy data).
  const userIds = new Set<string>([...emailById.keys(), ...settingsByUser.keys()]);
  const users: UserRow[] = [];
  for (const userId of userIds) {
    const settings = settingsByUser.get(userId) || {};
    const notif = (settings.notification_preferences as NotifPrefs) || {};
    users.push({
      user_id: userId,
      email: emailById.get(userId) ?? null,
      brand_name:
        typeof settings.brand_name === "string" ? (settings.brand_name as string) : null,
      weekly_email_enabled: !!notif.weekly_email_enabled,
      recipient_override:
        typeof notif.recipient_override === "string" && notif.recipient_override.trim()
          ? notif.recipient_override.trim()
          : null,
      last_sent_at: lastSentByUser.get(userId) ?? {},
    });
  }

  users.sort((a, b) => {
    if (a.weekly_email_enabled !== b.weekly_email_enabled) {
      return a.weekly_email_enabled ? -1 : 1;
    }
    return (a.email ?? "").localeCompare(b.email ?? "");
  });

  return NextResponse.json({ users, total: users.length });
}
