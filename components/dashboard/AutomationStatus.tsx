"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plane, Lightbulb, CalendarDays, Send, CheckCircle2,
  AlertTriangle, Clock, ChevronDown, ChevronUp, ArrowRight, Sparkles,
} from "lucide-react";
import { tenantApi } from "@/lib/api";
import { useLanguage } from "@/lib/hooks/useLanguage";
import type { Language } from "@/lib/locales";

interface PieceRow {
  id: string;
  title: string;
  status: string;
  scheduled_for?: string | null;
  created_at?: string;
}

interface ScheduledRow {
  id: string;
  scheduled_at: string;
  status: "scheduled" | "publishing" | "published" | "failed";
  published_url?: string;
  error?: string;
  payload?: Record<string, unknown>;
}

interface AutopilotConfig {
  enabled?: boolean;
  cadence?: "weekly" | "biweekly" | "off";
  auto_publish?: boolean;
  min_score_for_publish?: number;
}

interface Props {
  tenantId: string;
  userId: string;
  pieces: PieceRow[] | null;
  /** True once the site has a brand + domain — the crons require this. */
  active: boolean;
  onboardingCompletedAt?: string | null;
}

const LOCALE_MAP: Record<Language, string> = {
  sv: "sv-SE",
  no: "nb-NO",
  da: "da-DK",
  en: "en-GB",
};

// ── Schedule maths ────────────────────────────────────────────────────────
// The crons fire on Europe/Stockholm wall-clock (daily 06:00, weekly Monday
// 07:30). Weekday and ISO-week only depend on the calendar date, so we read
// "today" in Stockholm and step forward in calendar days — no DST offset
// conversion needed for the day-word and parity checks the UI shows.

function stockholmClock(): { hour: number; minute: number } {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return {
    hour: Number(p.find((x) => x.type === "hour")?.value ?? "0"),
    minute: Number(p.find((x) => x.type === "minute")?.value ?? "0"),
  };
}

/** Today's date in the Stockholm calendar, as a UTC-midnight Date for arithmetic. */
function stockholmToday(): Date {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? "0");
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** ISO weekday 1 (Mon) – 7 (Sun). */
function isoWeekday(d: Date): number {
  return ((d.getUTCDay() + 6) % 7) + 1;
}

/** ISO week number (1–53). Mirrors the parity check in the weekly cron. */
function isoWeek(d: Date): number {
  const date = new Date(d);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

function dayWord(offset: number, target: Date, locale: string): string {
  if (offset <= 0) return "idag";
  if (offset === 1) return "imorgon";
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(target);
}

/** Day-word for the next daily 06:00 fill. */
function nextDailyLabel(locale: string): string {
  const { hour } = stockholmClock();
  const today = stockholmToday();
  const offset = hour < 6 ? 0 : 1;
  return `${dayWord(offset, addDays(today, offset), locale)} kl 06:00`;
}

/** Day-word for the next eligible weekly autopilot run (Mon 07:30, odd weeks if biweekly). */
function nextWeeklyLabel(biweekly: boolean, locale: string): string {
  const { hour, minute } = stockholmClock();
  const today = stockholmToday();
  const pastToday = hour > 7 || (hour === 7 && minute >= 30);
  for (let offset = 0; offset <= 21; offset++) {
    const cand = addDays(today, offset);
    if (isoWeekday(cand) !== 1) continue;
    if (offset === 0 && pastToday) continue;
    if (biweekly && isoWeek(cand) % 2 !== 1) continue;
    return `${dayWord(offset, cand, locale)} kl 07:30`;
  }
  return "måndag kl 07:30";
}

function fmtDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function fmtDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AutomationStatus({
  tenantId,
  userId,
  pieces,
  active,
  onboardingCompletedAt,
}: Props) {
  const { language } = useLanguage();
  const locale = LOCALE_MAP[language];
  const [expanded, setExpanded] = useState(false);
  // Capture "now" once at mount — keeps render pure and the relative
  // comparisons below stable across re-renders.
  const [now] = useState(() => Date.now());
  const [ideasCount, setIdeasCount] = useState<number | null>(null);
  const [autopilot, setAutopilot] = useState<AutopilotConfig | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = tenantApi(tenantId);
      const [ideasRes, settingsRes, schedRes] = await Promise.allSettled([
        client.get<{ items?: unknown[] }>("/api/content/plan?status=idea"),
        client.get<{ settings?: { content_autopilot?: AutopilotConfig } }>(
          `/api/settings/${userId}`,
        ),
        // Local Next route (not proxied) — reads scheduled_publishes for the site.
        fetch("/api/integrations/scheduled", {
          headers: { "X-Tenant-ID": tenantId },
        }).then((r) => (r.ok ? r.json() : { scheduled: [] })),
      ]);
      if (cancelled) return;
      setIdeasCount(
        ideasRes.status === "fulfilled" ? ideasRes.value.items?.length ?? 0 : 0,
      );
      setAutopilot(
        settingsRes.status === "fulfilled"
          ? settingsRes.value.settings?.content_autopilot ?? {}
          : {},
      );
      setScheduled(
        schedRes.status === "fulfilled"
          ? ((schedRes.value as { scheduled?: ScheduledRow[] }).scheduled ?? [])
          : [],
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, userId]);

  const within30 = onboardingCompletedAt
    ? (now - new Date(onboardingCompletedAt).getTime()) / 86_400_000 < 30
    : false;

  const upcoming = (pieces ?? [])
    .filter(
      (p) =>
        (p.status === "draft" ||
          p.status === "review" ||
          p.status === "scheduled" ||
          p.status === "approved") &&
        p.scheduled_for,
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime(),
    );
  const nextScheduled = upcoming.find((p) => new Date(p.scheduled_for!).getTime() >= now) ?? upcoming[0];

  const queue = scheduled ?? [];
  const pendingPublish = queue.filter((s) => s.status === "scheduled");
  const failedPublish = queue.filter((s) => s.status === "failed");
  const nextPublish = pendingPublish
    .slice()
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .find((s) => new Date(s.scheduled_at).getTime() > now);
  const duePublish = pendingPublish.filter((s) => new Date(s.scheduled_at).getTime() <= now);
  const latestError = failedPublish[failedPublish.length - 1]?.error;

  const autoPublish = !!autopilot?.auto_publish;
  const weeklyOn = autopilot?.enabled === true;
  const biweekly = autopilot?.cadence === "biweekly";
  const hasIssue = active && failedPublish.length > 0;

  // Collapsed summary line.
  const summary = !active
    ? "Vilande — slutför din profil för att starta"
    : hasIssue
      ? `Behöver åtgärd · ${failedPublish.length} misslyckad publicering`
      : within30
        ? "30-dagarsplan från onboarding är aktiv"
        : `Nästa innehållskörning ${nextDailyLabel(locale)}`;

  const loading = ideasCount === null || scheduled === null;

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
              hasIssue ? "bg-amber-100" : active ? "bg-blue-100" : "bg-slate-100"
            }`}
          >
            {hasIssue ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            ) : (
              <Plane className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-500"}`} />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">Automatisering</h3>
            <p className="truncate text-xs text-slate-500">{summary}</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              hasIssue
                ? "bg-amber-100 text-amber-700"
                : active
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {hasIssue ? "Åtgärd" : active ? "Aktiv" : "Vilande"}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          {loading ? (
            <div className="h-24 animate-pulse rounded-lg bg-slate-50" />
          ) : (
            <>
              {/* Innehållsgenerering */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Innehåll
                </h4>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2 text-slate-600">
                    <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                    <span className="flex-1">Daglig idé &amp; utkast</span>
                    <span className="text-xs text-slate-500">
                      {!active
                        ? "startar efter profil"
                        : within30
                          ? "vilar (onboarding-plan)"
                          : `${nextDailyLabel(locale)}`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-600">
                    <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                    <span className="flex-1">Veckovis autopilot</span>
                    <span className="text-xs text-slate-500">
                      {weeklyOn
                        ? `${nextWeeklyLabel(biweekly, locale)}${biweekly ? " (varannan)" : ""}`
                        : "av"}
                    </span>
                  </li>
                </ul>
              </section>

              {/* Planen */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Plan
                </h4>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2 text-slate-600">
                    <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                    <Link href="/c/content?tab=ideas" className="flex-1 hover:text-amber-700">
                      {ideasCount && ideasCount > 0
                        ? `${ideasCount} idé${ideasCount === 1 ? "" : "er"} i kön`
                        : "Inga idéer i kön ännu"}
                    </Link>
                  </li>
                  <li className="flex items-center gap-2 text-slate-600">
                    <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                    <Link href="/c/content/plan" className="flex-1 truncate hover:text-blue-700">
                      {upcoming.length > 0
                        ? `${upcoming.length} schemalagda${
                            nextScheduled
                              ? ` · nästa ${fmtDate(nextScheduled.scheduled_for, locale)}`
                              : ""
                          }`
                        : "Inga schemalagda artiklar"}
                    </Link>
                  </li>
                </ul>
              </section>

              {/* Publicering */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Publicering
                </h4>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2 text-slate-600">
                    {autoPublish ? (
                      <Send className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    )}
                    <span className="flex-1">
                      {autoPublish
                        ? `Publiceras automatiskt (poäng ≥ ${autopilot?.min_score_for_publish ?? 70})`
                        : "Publiceras efter ditt godkännande"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-600">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                    <span className="flex-1">
                      {pendingPublish.length > 0
                        ? `${pendingPublish.length} i publiceringskö`
                        : "Inget i publiceringskön"}
                    </span>
                    {pendingPublish.length > 0 && (
                      <span className="text-xs text-slate-500">
                        {duePublish.length > 0
                          ? "publiceras inom kort"
                          : nextPublish
                            ? fmtDateTime(nextPublish.scheduled_at, locale)
                            : ""}
                      </span>
                    )}
                  </li>
                  {failedPublish.length > 0 && (
                    <li className="flex items-start gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      <span className="flex-1 text-xs">
                        <span className="font-medium">
                          {failedPublish.length} misslyckad publicering
                        </span>
                        {latestError && (
                          <span className="block truncate text-amber-700">{latestError}</span>
                        )}
                      </span>
                    </li>
                  )}
                  <li className="pl-5 text-[11px] text-slate-400">
                    Publiceringskontroll körs var 5:e minut
                  </li>
                </ul>
              </section>

              <Link
                href="/c/content"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Hantera innehåll &amp; autopilot <ArrowRight className="h-3 w-3" />
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
