"use client";

import { ArrowRight } from "lucide-react";

// Sprint 5 (S3) — visual horizontal timeline for the 30/60/90 roadmap.
//
// Renders a single sticky-out timeline rail with three milestone columns.
// Falls back gracefully to a vertical layout on narrow screens.

export interface TimelineMilestone {
  horizon: string; // "30d" / "60d" / "90d" / etc
  title?: string;
  description?: string;
  items?: string[];
}

interface RoadmapTimelineProps {
  milestones: TimelineMilestone[];
}

const HORIZON_LABEL: Record<string, string> = {
  "30d": "30 dagar",
  "60d": "60 dagar",
  "90d": "90 dagar",
  "30 days": "30 dagar",
  "60 days": "60 dagar",
  "90 days": "90 dagar",
};

const HORIZON_TONE: Record<string, { bg: string; ring: string; text: string }> = {
  "30d":  { bg: "bg-blue-500",    ring: "ring-blue-200",    text: "text-blue-700" },
  "60d":  { bg: "bg-violet-500",  ring: "ring-violet-200",  text: "text-violet-700" },
  "90d":  { bg: "bg-emerald-500", ring: "ring-emerald-200", text: "text-emerald-700" },
};

function tone(horizon: string) {
  return HORIZON_TONE[horizon] ?? HORIZON_TONE["30d"];
}

function horizonLabel(horizon: string) {
  return HORIZON_LABEL[horizon] ?? horizon;
}

export default function RoadmapTimeline({ milestones }: RoadmapTimelineProps) {
  if (!milestones || milestones.length === 0) return null;

  // Sort by horizon order: 30d < 60d < 90d < anything else (alpha)
  const order = ["30d", "60d", "90d"];
  const sorted = [...milestones].sort((a, b) => {
    const ai = order.indexOf(a.horizon);
    const bi = order.indexOf(b.horizon);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.horizon.localeCompare(b.horizon);
  });

  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Plan ahead
      </h3>

      <div className="relative">
        {/* Horizontal timeline rail (only on sm+) */}
        <div className="hidden sm:block absolute left-0 right-0 top-4 h-0.5 bg-gradient-to-r from-blue-200 via-violet-200 to-emerald-200" />

        <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
          {sorted.map((m, i) => {
            const t = tone(m.horizon);
            return (
              <div key={`${m.horizon}-${i}`} className="relative">
                {/* Dot on the rail */}
                <div className="hidden sm:flex absolute -top-px left-0 h-8 w-8 items-center justify-center">
                  <span
                    className={`block h-3 w-3 rounded-full ${t.bg} ring-4 ring-white`}
                    aria-hidden
                  />
                </div>

                <div className="sm:pt-12">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.text} bg-white ring-1 ${t.ring}`}
                    >
                      <ArrowRight className="h-3 w-3" />
                      {horizonLabel(m.horizon)}
                    </span>
                  </div>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {m.title && (
                      <h4 className="text-sm font-semibold text-slate-900">{m.title}</h4>
                    )}
                    {m.description && (
                      <p className="mt-1 text-sm text-slate-600">{m.description}</p>
                    )}
                    {m.items && m.items.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {m.items.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-slate-700"
                          >
                            <span
                              className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${t.bg}`}
                              aria-hidden
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!m.title && !m.description && (!m.items || m.items.length === 0) && (
                      <p className="text-sm text-slate-400">Nothing planned for this horizon yet.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
