import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

// Keep in sync with sama-agent/shared/usage.py PLANS. "free" is the comp /
// internal-test plan that bypasses billing-style limits without putting the
// account behind a paywall.
const ALLOWED_PLANS = new Set(["free", "starter", "growth", "enterprise"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = typeof body.plan === "string" ? body.plan.toLowerCase() : "";
  if (!ALLOWED_PLANS.has(plan)) {
    return NextResponse.json(
      { error: `plan must be one of ${[...ALLOWED_PLANS].join(", ")}` },
      { status: 400 },
    );
  }

  // Read existing settings so we don't clobber other fields. user_settings
  // may not exist for admin-created accounts; in that case insert a fresh
  // row with the plan set.
  const { data: existing, error: readErr } = await admin
    .from("user_settings")
    .select("settings")
    .eq("user_id", id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const current = (existing?.settings ?? {}) as Record<string, unknown>;
  const next = { ...current, plan };

  const { error: writeErr } = await admin
    .from("user_settings")
    .upsert({ user_id: id, settings: next }, { onConflict: "user_id" });
  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan });
}
