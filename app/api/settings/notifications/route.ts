import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NotificationPreferences = {
  weekly_email_enabled: boolean;
  recipient_override: string | null;
};

const DEFAULTS: NotificationPreferences = {
  weekly_email_enabled: false,
  recipient_override: null,
};

function parsePrefs(input: unknown): NotificationPreferences {
  const raw = (input ?? {}) as Record<string, unknown>;
  const overrideRaw = raw.recipient_override;
  const override = typeof overrideRaw === "string" && overrideRaw.trim() ? overrideRaw.trim() : null;
  return {
    weekly_email_enabled: raw.weekly_email_enabled === true,
    recipient_override: override,
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const prefs = parsePrefs(settings.notification_preferences);

  return NextResponse.json({
    preferences: prefs,
    user_email: user.email ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const incoming = parsePrefs(body?.preferences);

  // Read current settings JSONB so we don't clobber unrelated keys
  const { data: existing, error: readErr } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const current = (existing?.settings ?? {}) as Record<string, unknown>;
  const next = {
    ...current,
    notification_preferences: { ...DEFAULTS, ...incoming },
  };

  const { error: upsertErr } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        settings: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: incoming });
}
