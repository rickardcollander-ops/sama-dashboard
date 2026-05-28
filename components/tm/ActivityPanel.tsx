"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ChevronDown, Clock, Loader2, Star } from "lucide-react";

const CALL_STATUS_LABELS: Record<string, string> = {
  new: "Ny",
  called: "Uppringd",
  callback: "Ring tillbaka",
  phone_missing: "Telefon saknas",
  answering_machine: "Telesvarare",
  not_interested: "Ej intresserad",
  meeting_booked: "Möte bokat",
  converted: "Konverterad",
};

// Solid tones for bar segments — bright enough to read at 8px height.
const STATUS_BAR_BG: Record<string, string> = {
  new: "bg-slate-400",
  called: "bg-blue-500",
  callback: "bg-amber-500",
  phone_missing: "bg-orange-500",
  answering_machine: "bg-yellow-500",
  not_interested: "bg-rose-500",
  meeting_booked: "bg-violet-500",
  converted: "bg-emerald-500",
};

// Pastel pills matched to the bar colors for the legend and timeline status chip.
const STATUS_PILL: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  called: "bg-blue-100 text-blue-700",
  callback: "bg-amber-100 text-amber-700",
  phone_missing: "bg-orange-100 text-orange-700",
  answering_machine: "bg-yellow-100 text-yellow-700",
  not_interested: "bg-rose-100 text-rose-700",
  meeting_booked: "bg-violet-100 text-violet-700",
  converted: "bg-emerald-100 text-emerald-700",
};

// "Flow" order — fresh leads on the left, closed outcomes on the right. Drives
// both the stacked-bar layering and the legend reading order.
const STATUS_ORDER = [
  "new",
  "called",
  "callback",
  "phone_missing",
  "answering_machine",
  "not_interested",
  "meeting_booked",
  "converted",
];

interface DailyBucket {
  date: string;
  total: number;
  by_status: Record<string, number>;
}

interface TimelineEntry {
  id: string;
  company_name: string;
  campaign_id: string;
  campaign_name: string | null;
  call_status: string;
  call_notes: string | null;
  updated_at: string;
}

interface StatsResponse {
  window_days: number;
  daily: DailyBucket[];
  timeline: TimelineEntry[];
}

function stockholmDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function fmtDayLabel(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  // Build at UTC midnight and read back in UTC so the calendar date doesn't
  // shift by one day in zones west of Stockholm.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function fmtDayShort(yyyymmdd: string): string {
  const [, m, d] = yyyymmdd.split("-");
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  /** When set, scopes the panel to a single campaign. The /tm overview leaves this undefined. */
  campaignId?: string;
  /** Days of history to surface. Backend caps to 1..90. */
  days?: number;
}

export default function TmActivityPanel({ campaignId, days = 14 }: Props) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ days: String(days) });
    if (campaignId) qs.set("campaign_id", campaignId);
    fetch(`/api/tm/stats?${qs.toString()}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `HTTP ${r.status}`);
        }
        return (await r.json()) as StatsResponse;
      })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError("");
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Kunde inte ladda statistik");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, days]);

  if (loading) {
    return (
      <section className="mb-6 rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-center px-4 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="mb-6 rounded-xl border bg-white shadow-sm">
        <div className="px-4 py-6 text-center text-sm text-slate-500">
          {error || "Ingen statistik tillgänglig."}
        </div>
      </section>
    );
  }

  const totalInWindow = data.daily.reduce((s, d) => s + d.total, 0);
  const meetingsInWindow = data.daily.reduce(
    (s, d) => s + (d.by_status.meeting_booked ?? 0),
    0,
  );

  const totalsByStatus: Record<string, number> = {};
  for (const day of data.daily) {
    for (const [s, c] of Object.entries(day.by_status)) {
      totalsByStatus[s] = (totalsByStatus[s] ?? 0) + c;
    }
  }
  const legendOrder = STATUS_ORDER.filter((s) => (totalsByStatus[s] ?? 0) > 0);

  // Cap stacked stars per day so a single big day doesn't blow up the chart;
  // overflow surfaces as "+N" above the stack.
  const MAX_STARS_VISIBLE = 8;

  // Group the (already date-desc) timeline by Stockholm calendar day so the
  // feed reads like a journal: a header per day, entries underneath.
  const timelineByDate = new Map<string, TimelineEntry[]>();
  for (const e of data.timeline) {
    const key = stockholmDateKey(new Date(e.updated_at));
    const bucket = timelineByDate.get(key);
    if (bucket) bucket.push(e);
    else timelineByDate.set(key, [e]);
  }
  const timelineDates = Array.from(timelineByDate.keys());

  return (
    <section className="mb-6 rounded-xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-700">
            Aktivitet senaste {data.window_days} dagarna
          </h2>
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          <span className="font-semibold text-amber-600">{meetingsInWindow}</span> möten ·{" "}
          {totalInWindow} ändringar
        </span>
      </div>

      <div className="px-4 pt-4 pb-2">
        <div className="flex h-40 items-end gap-1">
          {data.daily.map((day) => {
            const booked = day.by_status.meeting_booked ?? 0;
            const visible = Math.min(booked, MAX_STARS_VISIBLE);
            const overflow = booked - visible;
            const tooltip =
              day.total === 0
                ? `${fmtDayLabel(day.date)}: inga ändringar`
                : `${fmtDayLabel(day.date)} · ${day.total}\n${STATUS_ORDER.filter(
                    (s) => (day.by_status[s] ?? 0) > 0,
                  )
                    .map((s) => `${CALL_STATUS_LABELS[s] ?? s}: ${day.by_status[s]}`)
                    .join("\n")}`;
            return (
              <div
                key={day.date}
                className="flex flex-1 flex-col items-center justify-end gap-0.5"
                title={tooltip}
              >
                {overflow > 0 && (
                  <span className="text-[10px] font-bold tabular-nums text-amber-700">
                    +{overflow}
                  </span>
                )}
                {Array.from({ length: visible }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5 fill-amber-400 text-amber-500"
                    aria-hidden
                  />
                ))}
                {booked > 0 ? (
                  <span className="mt-0.5 text-[11px] font-bold tabular-nums text-amber-700">
                    {booked}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-300">·</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1">
          {data.daily.map((day) => (
            <div
              key={day.date}
              className="flex-1 text-center text-[10px] text-slate-400 tabular-nums"
            >
              {fmtDayShort(day.date)}
            </div>
          ))}
        </div>
      </div>

      {legendOrder.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
          {legendOrder.map((s) => (
            <span
              key={s}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_PILL[s] ?? "bg-slate-100 text-slate-700"}`}
            >
              <span className={`inline-block h-2 w-2 rounded-sm ${STATUS_BAR_BG[s] ?? "bg-slate-300"}`} />
              {CALL_STATUS_LABELS[s] ?? s}
              <span className="font-bold tabular-nums">{totalsByStatus[s]}</span>
            </span>
          ))}
        </div>
      )}

      {data.timeline.length > 0 ? (
        <div className="border-t border-slate-100">
          <button
            type="button"
            onClick={() => setTimelineOpen((v) => !v)}
            aria-expanded={timelineOpen}
            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
          >
            <Clock className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Tidslinje</h3>
            <span className="text-xs text-slate-400">
              senaste {data.timeline.length} ändringarna
            </span>
            <ChevronDown
              className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${timelineOpen ? "rotate-180" : ""}`}
            />
          </button>
          {timelineOpen && (
            <ul className="border-t border-slate-100">
              {timelineDates.map((date) => {
                const entries = timelineByDate.get(date)!;
                return (
                  <li key={date}>
                    <div className="bg-slate-50/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {fmtDayLabel(date)} <span className="text-slate-400">· {entries.length}</span>
                    </div>
                    <ul className="divide-y divide-slate-50">
                      {entries.map((e) => (
                        <li
                          key={e.id + e.updated_at}
                          className="flex items-center justify-between gap-3 px-4 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/tm/${e.campaign_id}`}
                              className="block truncate text-sm font-medium text-slate-800 hover:text-violet-700"
                            >
                              {e.company_name}
                            </Link>
                            {(e.call_notes || (e.campaign_name && !campaignId)) && (
                              <p className="truncate text-[11px] text-slate-400">
                                {!campaignId && e.campaign_name ? e.campaign_name : ""}
                                {!campaignId && e.campaign_name && e.call_notes ? " · " : ""}
                                {e.call_notes ?? ""}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[e.call_status] ?? "bg-slate-100 text-slate-700"}`}
                            >
                              {CALL_STATUS_LABELS[e.call_status] ?? e.call_status}
                            </span>
                            <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                              {fmtTime(e.updated_at)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-400">
          Inga ändringar i fönstret.
        </div>
      )}
    </section>
  );
}
