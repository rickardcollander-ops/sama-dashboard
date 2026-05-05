import type { ReactNode } from "react";

// Sprint 1a (X5) — shared horizontal "scoreboard" row for top-of-page stats.
//
// Used on Hem, Insikter, Content etc. so headline numbers look the same
// everywhere and reduce per-page card-soup.

export interface ScoreboardStat {
  key?: string;
  label: string;
  value: ReactNode;
  // Optional small node next to the value — typically a TrendBadge.
  trend?: ReactNode;
  // Optional one-liner under the value (e.g. period label or context).
  hint?: ReactNode;
  // Optional short tooltip explaining the metric for non-experts.
  tooltip?: string;
}

interface StatScoreboardProps {
  stats: ScoreboardStat[];
  className?: string;
}

export default function StatScoreboard({ stats, className = "" }: StatScoreboardProps) {
  if (stats.length === 0) return null;

  return (
    <div
      className={`grid gap-px overflow-hidden rounded-xl border bg-slate-200 shadow-sm ${className}`}
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
    >
      {stats.map((s, idx) => (
        <div
          key={s.key ?? s.label ?? idx}
          className="flex flex-col gap-1 bg-white px-4 py-4 sm:px-5"
        >
          <div
            className="text-xs font-medium uppercase tracking-wide text-slate-500"
            title={s.tooltip}
          >
            {s.label}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{s.value}</span>
            {s.trend && <span className="text-sm">{s.trend}</span>}
          </div>
          {s.hint && <div className="text-xs text-slate-400">{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}
