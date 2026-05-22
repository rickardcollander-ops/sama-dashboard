import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SAMA_API_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

/**
 * Daily cron — fires every day at 06:00 Europe/Stockholm time.
 *
 * Triggers the content agent for every onboarded user, generating 1 idea
 * and immediately drafting the article scheduled for the day after tomorrow.
 * This keeps the content calendar continuously filled without manual effort.
 *
 * Vercel cron only speaks UTC. Two entries (04:00 and 05:00 UTC) cover the
 * DST transitions between CET (UTC+1) and CEST (UTC+2). This handler gates
 * on the actual local time so the off-target invocation is a no-op.
 */
function isStockholm0600Window(): boolean {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "-1");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "-1");
  if (hour !== 6) return false;
  return minute >= 0 && minute <= 20;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isStockholm0600Window()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "not 06:00 Europe/Stockholm",
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
    failures: { user_id: string; error: string }[];
  } = {
    users_processed: 0,
    users_skipped: 0,
    triggers_attempted: 0,
    triggers_succeeded: 0,
    failures: [],
  };

  for (const row of rows || []) {
    const userId = (row as { user_id: string }).user_id;
    const settings = (
      (row as { settings?: Record<string, unknown> }).settings || {}
    ) as Record<string, unknown>;

    if (typeof settings.brand_name !== "string" || !settings.brand_name) {
      summary.users_skipped += 1;
      continue;
    }

    // Skip users who onboarded < 30 days ago — onboarding already generates
    // a 30-day content plan, so firing the daily cron on top would duplicate.
    const onboardedAt = typeof settings.onboarding_completed_at === "string"
      ? settings.onboarding_completed_at
      : null;
    if (onboardedAt) {
      const daysSince = (Date.now() - new Date(onboardedAt).getTime()) / 86_400_000;
      if (daysSince < 30) {
        summary.users_skipped += 1;
        continue;
      }
    }

    summary.users_processed += 1;
    summary.triggers_attempted += 1;

    try {
      const target = `${SAMA_API_URL.replace(/\/$/, "")}/api/tenant/agents/content/trigger`;
      const res = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": userId,
          "X-Sama-Intent": "user-action",
        },
        body: JSON.stringify({
          source: "daily_cron",
          ideas_per_run: 1,
          auto_draft_top_n: 1,
          auto_publish: false,
          scheduled_for_days_ahead: 2,
        }),
      });

      if (res.ok) {
        summary.triggers_succeeded += 1;
      } else {
        const detail = await res.text().catch(() => "");
        summary.failures.push({
          user_id: userId,
          error: `${res.status} ${detail.slice(0, 120)}`,
        });
      }
    } catch (e) {
      summary.failures.push({
        user_id: userId,
        error: e instanceof Error ? e.message : "fetch failed",
      });
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
