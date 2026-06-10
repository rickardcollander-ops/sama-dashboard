import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { mapPool } from "@/lib/integrations/concurrency";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Each site fires up to four backend triggers; bounded parallelism across sites
// keeps the whole run to a few seconds. Set an explicit ceiling so it can't be
// truncated at the platform default as the tenant list grows.
export const maxDuration = 60;

const SITE_CONCURRENCY = 8;

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

/** ISO week number (1–53) for a given date. */
function isoWeekNumber(d: Date): number {
  const jan4 = new Date(d.getUTCFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek1.getTime();
  return 1 + Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}

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

  // user_sites is the single source of truth for tenant config. Each site has
  // its own settings.brand_name and settings.content_autopilot — a user with
  // multiple sites fires weekly agents once per site.
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
    failures: { site_id: string; user_id: string; agent: string; error: string }[];
  } = {
    sites_processed: 0,
    sites_skipped: 0,
    triggers_attempted: 0,
    triggers_succeeded: 0,
    failures: [],
  };

  // Filter to onboarded sites synchronously, then fan out with bounded
  // concurrency. The per-site trigger sequence stays sequential within a site
  // (cheap, and keeps the summary ordering intact); sites run in parallel.
  const eligible: { siteId: string; userId: string; settings: Record<string, unknown> }[] = [];
  for (const row of rows || []) {
    const siteId = (row as { id: string }).id;
    const userId = (row as { user_id: string }).user_id;
    const settings = ((row as { settings?: Record<string, unknown> }).settings || {}) as Record<string, unknown>;
    // Skip sites that haven't completed onboarding (no brand_name)
    if (typeof settings.brand_name !== "string" || !settings.brand_name) {
      summary.sites_skipped += 1;
      continue;
    }
    eligible.push({ siteId, userId, settings });
  }
  summary.sites_processed = eligible.length;

  await mapPool(eligible, SITE_CONCURRENCY, async ({ siteId, userId, settings }) => {
    const baseHeaders = {
      "Content-Type": "application/json",
      "X-Tenant-ID": userId,
      "X-Sama-Site-Id": siteId,
      "X-Sama-Intent": "user-action",
    };

    for (const trigger of WEEKLY_TRIGGERS) {
      summary.triggers_attempted += 1;
      try {
        const target = `${SAMA_API_URL.replace(/\/$/, "")}${trigger.endpoint}`;
        const res = await fetch(target, {
          method: "POST",
          headers: baseHeaders,
          body: JSON.stringify({ source: "weekly_cron" }),
        });
        if (res.ok) {
          summary.triggers_succeeded += 1;
        } else {
          const detail = await res.text().catch(() => "");
          summary.failures.push({
            site_id: siteId,
            user_id: userId,
            agent: trigger.agent,
            error: `${res.status} ${detail.slice(0, 120)}`,
          });
        }
      } catch (e) {
        summary.failures.push({
          site_id: siteId,
          user_id: userId,
          agent: trigger.agent,
          error: e instanceof Error ? e.message : "fetch failed",
        });
      }
    }

    // Content autopilot — only for sites that have explicitly enabled it.
    const ap = (settings.content_autopilot ?? {}) as Record<string, unknown>;
    if (ap.enabled === true) {
      const cadence = typeof ap.cadence === "string" ? ap.cadence : "weekly";
      const thisWeek = isoWeekNumber(new Date());
      const shouldRunThisWeek = cadence !== "biweekly" || thisWeek % 2 === 1;

      if (shouldRunThisWeek) {
        summary.triggers_attempted += 1;
        try {
          const target = `${SAMA_API_URL.replace(/\/$/, "")}/api/tenant/agents/content/trigger`;
          const res = await fetch(target, {
            method: "POST",
            headers: baseHeaders,
            body: JSON.stringify({
              source: "weekly_cron",
              ideas_per_run: ap.ideas_per_run ?? 6,
              auto_draft_top_n: ap.auto_draft_top_n ?? 3,
              auto_publish: ap.auto_publish ?? false,
              min_score_for_publish: ap.min_score_for_publish ?? 70,
            }),
          });
          if (res.ok) {
            summary.triggers_succeeded += 1;
          } else {
            const detail = await res.text().catch(() => "");
            summary.failures.push({
              site_id: siteId,
              user_id: userId,
              agent: "content",
              error: `${res.status} ${detail.slice(0, 120)}`,
            });
          }
        } catch (e) {
          summary.failures.push({
            site_id: siteId,
            user_id: userId,
            agent: "content",
            error: e instanceof Error ? e.message : "fetch failed",
          });
        }
      }
    }
  });

  return NextResponse.json({ ok: true, ...summary });
}
