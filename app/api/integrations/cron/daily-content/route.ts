import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { mapPool } from "@/lib/integrations/concurrency";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Fan-out over every eligible site. Bounded concurrency keeps this well under
// a few seconds even with many sites, but set an explicit ceiling so the run
// can't be silently truncated at the platform default as the tenant list grows.
export const maxDuration = 60;

// How many backend triggers to keep in flight at once. Each trigger just kicks
// off async work on the backend and returns quickly, so this is mostly about
// not opening hundreds of sockets simultaneously.
const TRIGGER_CONCURRENCY = 8;

const SAMA_API_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

/**
 * Daily cron — fires every day at 06:00 Europe/Stockholm time.
 *
 * For every site that has content autopilot enabled and is past the
 * onboarding grace period, triggers the content agent to generate 1 idea
 * and immediately draft the article scheduled for the day after tomorrow.
 * This keeps the content calendar continuously filled without manual
 * effort — but only for users who've opted in via the autopilot toggle.
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

  // user_sites is the single source of truth for tenant config — same as
  // the weekly cron. Each site has its own autopilot toggle.
  const { data: rows, error } = await admin
    .from("user_sites")
    .select("id, user_id, settings");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary: {
    sites_processed: number;
    sites_skipped: number;
    triggers_attempted: number;
    triggers_succeeded: number;
    failures: { site_id: string; user_id: string; error: string }[];
  } = {
    sites_processed: 0,
    sites_skipped: 0,
    triggers_attempted: 0,
    triggers_succeeded: 0,
    failures: [],
  };

  // Decide eligibility up front (cheap, synchronous) so the triggers can run
  // as a bounded parallel pool rather than one slow sequential loop.
  const eligible: { siteId: string; userId: string }[] = [];
  for (const row of rows || []) {
    const siteId = (row as { id: string }).id;
    const userId = (row as { user_id: string }).user_id;
    const settings = (
      (row as { settings?: Record<string, unknown> }).settings || {}
    ) as Record<string, unknown>;

    if (typeof settings.brand_name !== "string" || !settings.brand_name) {
      summary.sites_skipped += 1;
      continue;
    }

    // Daily gap-fill only fires for sites that have explicitly enabled
    // autopilot — same opt-in as the weekly cron. Without this, users who
    // never toggled autopilot would still get drafts generated every day
    // and the calendar would fill behind their back.
    const ap = (settings.content_autopilot ?? {}) as Record<string, unknown>;
    if (ap.enabled !== true) {
      summary.sites_skipped += 1;
      continue;
    }

    // Skip sites that onboarded < 30 days ago — onboarding already generates
    // a 30-day content plan, so firing the daily cron on top would duplicate.
    const onboardedAt = typeof settings.onboarding_completed_at === "string"
      ? settings.onboarding_completed_at
      : null;
    if (onboardedAt) {
      const daysSince = (Date.now() - new Date(onboardedAt).getTime()) / 86_400_000;
      if (daysSince < 30) {
        summary.sites_skipped += 1;
        continue;
      }
    }

    eligible.push({ siteId, userId });
  }

  summary.sites_processed = eligible.length;
  summary.triggers_attempted = eligible.length;

  const target = `${SAMA_API_URL.replace(/\/$/, "")}/api/tenant/agents/content/trigger`;
  await mapPool(eligible, TRIGGER_CONCURRENCY, async ({ siteId, userId }) => {
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": userId,
          "X-Sama-Site-Id": siteId,
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
          site_id: siteId,
          user_id: userId,
          error: `${res.status} ${detail.slice(0, 120)}`,
        });
      }
    } catch (e) {
      summary.failures.push({
        site_id: siteId,
        user_id: userId,
        error: e instanceof Error ? e.message : "fetch failed",
      });
    }
  });

  return NextResponse.json({ ok: true, ...summary });
}
