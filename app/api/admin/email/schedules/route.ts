import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScheduleUpdate {
  kind: string;
  enabled?: boolean;
  cron_day_of_week?: string | null;
  cron_hour?: number | null;
  cron_minute?: number;
  timezone?: string;
}

const DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { data, error } = await admin
    .from("email_schedules")
    .select("kind, enabled, cron_day_of_week, cron_hour, cron_minute, timezone, description, updated_at, updated_by")
    .order("kind", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ schedules: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin, email } = guard;

  const body = (await req.json().catch(() => ({}))) as ScheduleUpdate;
  if (!body || typeof body.kind !== "string" || !body.kind.trim()) {
    return NextResponse.json({ error: "kind required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: email,
  };
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (body.cron_day_of_week === null || body.cron_day_of_week === undefined) {
    if ("cron_day_of_week" in body) update.cron_day_of_week = null;
  } else if (DAYS.has(body.cron_day_of_week)) {
    update.cron_day_of_week = body.cron_day_of_week;
  } else {
    return NextResponse.json({ error: "cron_day_of_week must be mon..sun or null" }, { status: 400 });
  }
  if (body.cron_hour === null) {
    update.cron_hour = null;
  } else if (typeof body.cron_hour === "number") {
    if (body.cron_hour < 0 || body.cron_hour > 23) {
      return NextResponse.json({ error: "cron_hour must be 0..23" }, { status: 400 });
    }
    update.cron_hour = Math.floor(body.cron_hour);
  }
  if (typeof body.cron_minute === "number") {
    if (body.cron_minute < 0 || body.cron_minute > 59) {
      return NextResponse.json({ error: "cron_minute must be 0..59" }, { status: 400 });
    }
    update.cron_minute = Math.floor(body.cron_minute);
  }
  if (typeof body.timezone === "string" && body.timezone.trim()) {
    update.timezone = body.timezone.trim();
  }

  const { data, error } = await admin
    .from("email_schedules")
    .update(update)
    .eq("kind", body.kind)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ schedule: data });
}
