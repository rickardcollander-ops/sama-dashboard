"use client";

import { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { ANALYSES, type Cadence } from "@/lib/analyses";
import { useLanguage } from "@/lib/hooks/useLanguage";

const STORAGE_KEY = "sama_rhythm_dismissed";

const CADENCE_ORDER: Record<Cadence, number> = {
  daily: 0,
  weekly: 1,
  autopilot: 2,
  "on-demand": 3,
};

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Replaces the OnboardingChecklist once setup is complete. Surfaces the
 * scheduled / autopilot work that runs without the user clicking anything,
 * so they don't wonder whether the dashboard has gone quiet.
 */
export default function WeeklyRhythm() {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);

  if (dismissed) return null;

  const items = ANALYSES.filter(
    (a) => a.cadence !== "on-demand" && a.cronDescription,
  ).sort((a, b) => CADENCE_ORDER[a.cadence] - CADENCE_ORDER[b.cadence]);

  if (items.length === 0) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch { /* private mode */ }
    setDismissed(true);
  };

  return (
    <section className="mb-8 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
            <CalendarClock className="h-4 w-4 text-emerald-700" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-emerald-900">{t.analyses.rhythmTitle}</h3>
            <p className="text-xs text-emerald-800/80">{t.analyses.rhythmDescription}</p>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="rounded-lg p-1.5 text-emerald-700/60 hover:bg-emerald-100 hover:text-emerald-900 transition-colors"
          title={t.analyses.rhythmDismiss}
          aria-label={t.analyses.rhythmDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="border-t border-emerald-100 divide-y divide-emerald-100">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            <span className="font-medium text-emerald-900">{a.label}</span>
            <span className="text-emerald-700/80">·</span>
            <span className="text-emerald-700/80">{a.cronDescription}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
