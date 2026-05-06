import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SAMA_API_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

interface AgentTrigger {
  agent: string;
  endpoint: string;
}

const WEEKLY_TRIGGERS: AgentTrigger[] = [
  { agent: "ai_visibility", endpoint: "/api/ai-visibility/check" },
  { agent: "seo", endpoint: "/api/seo/keywords/track" },
  { agent: "analytics", endpoint: "/api/tenant/agents/analytics/trigger" },
];

/**
 * Weekly cron — fires every Monday 07:30 Europe/Stockholm time, year-round.
 *
 * Vercel cron only speaks UTC and a single fixed expression, but Sweden
 * switches between CET (UTC+1) and CEST (UTC+2). vercel.json registers
 * two cron entries (05:30 and 06:30 UTC) so one of them always lines up
 * with 07:30 local. This handler then gates on the actual local time —
 * the off-target invocation is a no-op.
 */
function isStockholm0730Window(): boolean {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "-1");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "-1");
  // Allow a 20-minute window so brief Vercel scheduling drift still counts
  if (hour !== 7) return false;
  return minute >= 20 && minute <= 40;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Skip the duplicate Vercel cron invocation (we register both 05:30 and
  // 06:30 UTC so DST transitions are covered; only one matches 07:30 local)
  if (!isStockholm0730Window()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "not 07:30 Europe/Stockholm",
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "supabase service role not configured" },
      { status: 500 },
    );
  }

  const admin = createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });

  const { data: rows, error } = await admin
    .from("user_settings")
    .select("user_id, settings");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary: {
    users_processed: number;
    users_skipped: number;
    triggers_attempted: number;
    triggers_succeeded: number;
    failures: { user_id: string; agent: string; error: string }[];
  } = {
    users_processed: 0,
    users_skipped: 0,
    triggers_attempted: 0,
    triggers_succeeded: 0,
    failures: [],
  };

  for (const row of rows || []) {
    const userId = (row as { user_id: string }).user_id;
    const settings = ((row as { settings?: Record<string, unknown> }).settings || {}) as Record<string, unknown>;
    // Skip users that haven't completed onboarding (no brand_name)
    if (typeof settings.brand_name !== "string" || !settings.brand_name) {
      summary.users_skipped += 1;
      continue;
    }
    summary.users_processed += 1;
    for (const trigger of WEEKLY_TRIGGERS) {
      summary.triggers_attempted += 1;
      try {
        const target = `${SAMA_API_URL.replace(/\/$/, "")}${trigger.endpoint}`;
        const res = await fetch(target, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tenant-ID": userId,
            "X-Sama-Intent": "user-action",
          },
          body: JSON.stringify({ source: "weekly_cron" }),
        });
        if (res.ok) {
          summary.triggers_succeeded += 1;
        } else {
          const detail = await res.text().catch(() => "");
          summary.failures.push({
            user_id: userId,
            agent: trigger.agent,
            error: `${res.status} ${detail.slice(0, 120)}`,
          });
        }
      } catch (e) {
        summary.failures.push({
          user_id: userId,
          agent: trigger.agent,
          error: e instanceof Error ? e.message : "fetch failed",
        });
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
