import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Heartbeat is purely cosmetic (admin online-dot). Never surface a 500 to the
// client — the hook fires every 30s from every signed-in tab, so a hard error
// would spam the browser console and mask real issues. We return 200 and let
// the admin endpoint treat a missing/stale presence row as "offline".
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" });
  }

  const { error } = await supabase
    .from("user_presence")
    .upsert(
      { user_id: user.id, last_seen_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) {
    // 42P01 = relation does not exist (migration not applied yet).
    // Log once for ops; report back as ok:false so client stays quiet.
    console.warn("[presence/heartbeat] upsert failed", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ ok: false, reason: error.code || "db_error" });
  }

  return NextResponse.json({ ok: true });
}
