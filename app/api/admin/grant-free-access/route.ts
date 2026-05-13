import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/**
 * Admin override: grant or revoke free access for a customer.
 *
 * Writes the subscription state straight onto user_settings.settings (same
 * JSONB the signup trigger and Stripe webhook touch — see sama-agent
 * migration 045) and appends an audit row to subscription_admin_grants.
 *
 * Goes through the dashboard's requireAdmin() gate rather than the
 * backend's /api/subscriptions/admin/* endpoint so the call works
 * regardless of whether the admin is currently in "view-as" mode (which
 * would have rewritten the X-Sama-Account-Id header to the viewed
 * customer's id and locked the backend admin check out).
 */

interface GrantBody {
  user_id: string;
  action: "grant" | "revoke";
  granted_until?: string | null; // ISO; null/omitted = unlimited
  note?: string;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin, email: adminEmail } = guard;

  const body = (await req.json().catch(() => null)) as GrantBody | null;
  if (!body || typeof body.user_id !== "string" || !body.user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  if (body.action !== "grant" && body.action !== "revoke") {
    return NextResponse.json({ error: "action must be 'grant' or 'revoke'" }, { status: 400 });
  }

  // Pull existing settings so we don't clobber unrelated keys.
  const { data: existingRow, error: readErr } = await admin
    .from("user_settings")
    .select("settings")
    .eq("user_id", body.user_id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  const existing = (existingRow?.settings ?? {}) as Record<string, unknown>;

  let patch: Record<string, unknown>;
  let auditAction: string;
  let auditUntil: string | null;

  if (body.action === "grant") {
    let untilIso: string | null = null;
    if (body.granted_until) {
      const d = new Date(body.granted_until);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "granted_until must be ISO 8601 or null" }, { status: 400 });
      }
      untilIso = d.toISOString();
    }
    patch = {
      plan: "site",
      plan_status: "admin_granted",
      admin_granted_until: untilIso,
      admin_granted_by: adminEmail,
      admin_granted_at: new Date().toISOString(),
    };
    auditAction = "grant";
    auditUntil = untilIso;
  } else {
    if (existing.plan_status !== "admin_granted") {
      // Don't trample a real Stripe subscription that landed in between.
      return NextResponse.json({
        ok: true,
        note: "not_admin_granted",
        plan_status: existing.plan_status ?? null,
      });
    }
    patch = {
      plan_status: "expired",
      admin_granted_until: null,
      admin_granted_by: null,
    };
    auditAction = "revoke";
    auditUntil = null;
  }

  const merged = { ...existing, ...patch };
  const { error: writeErr } = await admin
    .from("user_settings")
    .upsert(
      {
        user_id: body.user_id,
        settings: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  // Audit log — best-effort. Schema lives in sama-agent migration 045.
  await admin
    .from("subscription_admin_grants")
    .insert({
      user_id: body.user_id,
      action: auditAction,
      granted_until: auditUntil,
      admin_email: adminEmail,
      note: body.note ?? null,
    });

  return NextResponse.json({ ok: true, settings: merged });
}

/**
 * GET — fetch current plan_status for a list of user_ids so the admin
 * page can render the badge column without a per-row request.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const url = new URL(req.url);
  const idsParam = url.searchParams.get("user_ids") || "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ statuses: {} });
  }

  const { data, error } = await admin
    .from("user_settings")
    .select("user_id, settings")
    .in("user_id", ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const statuses: Record<string, {
    plan: string | null;
    plan_status: string | null;
    trial_ends_at: string | null;
    admin_granted_until: string | null;
  }> = {};
  for (const row of data ?? []) {
    const s = ((row as { settings: Record<string, unknown> }).settings) || {};
    statuses[(row as { user_id: string }).user_id] = {
      plan: typeof s.plan === "string" ? s.plan : null,
      plan_status: typeof s.plan_status === "string" ? s.plan_status : null,
      trial_ends_at: typeof s.trial_ends_at === "string" ? s.trial_ends_at : null,
      admin_granted_until: typeof s.admin_granted_until === "string" ? s.admin_granted_until : null,
    };
  }
  return NextResponse.json({ statuses });
}
