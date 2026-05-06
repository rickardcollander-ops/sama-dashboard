import type { ReactNode } from "react";
import Link from "next/link";

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
  // Plain-language one-liner shown directly under the value (Sprint 1, H-2)
  // to anchor each metric for non-experts. Distinct from `hint` (date / count
  // context that lives below it).
  caption?: string;
  // When set, the whole card becomes a link to the page that owns the metric
  // (Sprint 2, K-11) so a number on Hem leads to its detail view.
  href?: string;
}

interface StatScoreboardProps {
  stats: ScoreboardStat[];
  className?: string;
}

function StatBody({ stat }: { stat: ScoreboardStat }) {
  return (
    <>
      <div
        className="text-xs font-medium uppercase tracking-wide text-slate-500"
        title={stat.tooltip}
      >
        {stat.label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
        {stat.trend && <span className="text-sm">{stat.trend}</span>}
      </div>
      {stat.caption && (
        <div className="text-xs text-slate-500 leading-snug">{stat.caption}</div>
      )}
      {stat.hint && <div className="text-xs text-slate-400">{stat.hint}</div>}
    </>
  );
}

export default function StatScoreboard({ stats, className = "" }: StatScoreboardProps) {
  if (stats.length === 0) return null;

  return (
    <div
      className={`grid gap-px overflow-hidden rounded-xl border bg-slate-200 shadow-sm ${className}`}
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
    >
      {stats.map((s, idx) => {
        const baseClass = "flex flex-col gap-1 bg-white px-4 py-4 sm:px-5";
        const key = s.key ?? s.label ?? idx;
        if (s.href) {
          return (
            <Link
              key={key}
              href={s.href}
              className={`${baseClass} transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200`}
            >
              <StatBody stat={s} />
            </Link>
          );
        }
        return (
          <div key={key} className={baseClass}>
            <StatBody stat={s} />
          </div>
        );
      })}
    </div>
  );
}
