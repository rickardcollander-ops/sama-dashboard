import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STOCKHOLM_TZ = "Europe/Stockholm";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Stockholm calendar-date key (YYYY-MM-DD). Used for bucketing and the today
// counters — operators are in Sweden, so UTC midnight would mis-slice the day.
function stockholmDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCKHOLM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

interface LeadRow {
  id: string;
  company_name: string;
  call_status: string;
  call_notes: string | null;
  call_status_updated_at: string | null;
  campaign_id: string;
  // PostgREST embeds the linked campaign as either an object (to-one) or null;
  // some clients have seen the array shape so we accept both defensively.
  apollo_campaigns?: { name?: string | null } | { name?: string | null }[] | null;
}

export async function GET(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const daysRaw = parseInt(searchParams.get("days") || "14", 10);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, daysRaw)) : 14;
  const campaignId = searchParams.get("campaign_id") || undefined;
  if (campaignId && !UUID_RE.test(campaignId)) {
    return NextResponse.json({ error: "Invalid campaign_id" }, { status: 400 });
  }

  // Window starts at the Stockholm midnight that begins the oldest day in the
  // requested span. We pad +1 day backwards in UTC so DST shifts can't cut a
  // calendar day off — the JS-side bucketing re-keys by Stockholm date anyway.
  const windowStartUtc = new Date(Date.now() - (days + 1) * 86_400_000);

  let query = admin
    .from("apollo_leads")
    .select(
      "id, company_name, call_status, call_notes, call_status_updated_at, campaign_id, apollo_campaigns(name)",
    )
    .gte("call_status_updated_at", windowStartUtc.toISOString())
    // Same "operator touched" predicate the today-stats endpoint used — leaves
    // out leads whose only change is the audit pipeline writing audit_score.
    .or("call_status.neq.new,call_notes.not.is.null")
    .order("call_status_updated_at", { ascending: false })
    .limit(5000);

  if (campaignId) query = query.eq("campaign_id", campaignId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leads = (data ?? []) as LeadRow[];

  // Build the date keys for the window (oldest → newest) so the chart always
  // renders every day even when nothing happened — gaps in the bars are signal.
  const todayKey = stockholmDateKey(new Date());
  const datesInWindow: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    datesInWindow.push(stockholmDateKey(new Date(Date.now() - i * 86_400_000)));
  }

  const dailyMap = new Map<string, { total: number; by_status: Record<string, number> }>();
  for (const d of datesInWindow) dailyMap.set(d, { total: 0, by_status: {} });

  let changesToday = 0;
  const todayByStatus: Record<string, number> = {};

  for (const lead of leads) {
    if (!lead.call_status_updated_at) continue;
    const key = stockholmDateKey(new Date(lead.call_status_updated_at));
    const bucket = dailyMap.get(key);
    if (bucket) {
      bucket.total += 1;
      bucket.by_status[lead.call_status] = (bucket.by_status[lead.call_status] ?? 0) + 1;
    }
    if (key === todayKey) {
      changesToday += 1;
      todayByStatus[lead.call_status] = (todayByStatus[lead.call_status] ?? 0) + 1;
    }
  }

  const daily = datesInWindow.map((date) => ({
    date,
    total: dailyMap.get(date)!.total,
    by_status: dailyMap.get(date)!.by_status,
  }));

  const timeline = leads
    .filter((l) => l.call_status_updated_at)
    .slice(0, 100)
    .map((l) => {
      const embed = Array.isArray(l.apollo_campaigns) ? l.apollo_campaigns[0] : l.apollo_campaigns;
      return {
        id: l.id,
        company_name: l.company_name,
        campaign_id: l.campaign_id,
        campaign_name: embed?.name ?? null,
        call_status: l.call_status,
        call_notes: l.call_notes,
        // Response key stays `updated_at` so ActivityPanel keeps its current
        // shape; underneath we read from the more accurate status timestamp.
        updated_at: l.call_status_updated_at!,
      };
    });

  // Back-compat: the old /tm page reads changes_today / by_status / recent.
  // Keep them on the response, but recompute against the Stockholm calendar
  // so the count matches what an operator sees on screen.
  const recent = timeline.filter((t) => stockholmDateKey(new Date(t.updated_at)) === todayKey).slice(0, 20);

  return NextResponse.json({
    changes_today: changesToday,
    by_status: todayByStatus,
    recent,
    window_days: days,
    daily,
    timeline,
  });
}
