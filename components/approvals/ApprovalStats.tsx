"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import StatScoreboard, { type ScoreboardStat } from "@/components/StatScoreboard";

interface ApprovalStatsData {
  window_days: number;
  resolved_count: number;
  avg_time_to_answer_seconds: number | null;
  median_time_to_answer_seconds: number | null;
  avg_active_seconds: number | null;
  median_active_seconds: number | null;
  active_tracked_count: number;
}

const WINDOW_DAYS = 30;

// Compact, non-expert-friendly duration: "42s", "8 min", "2h 14min", "3d 5h".
function humanizeDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = seconds / 60;
  if (mins < 60) return `${Math.round(mins)} min`;
  const hours = mins / 60;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round(mins - h * 60);
    return m ? `${h}h ${m}min` : `${h}h`;
  }
  const d = Math.floor(hours / 24);
  const h = Math.round(hours - d * 24);
  return h ? `${d}d ${h}h` : `${d}d`;
}

export default function ApprovalStats({ tenantId }: { tenantId: string | null }) {
  const [data, setData] = useState<ApprovalStatsData | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/approvals/stats?days=${WINDOW_DAYS}`, {
          headers: { "X-Tenant-ID": tenantId },
        });
        if (!res.ok) return;
        const json = (await res.json()) as ApprovalStatsData;
        if (!cancelled) setData(json);
      } catch {
        // Stats are non-critical — leave the section hidden on failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // Nothing reviewed yet → no proof-of-concept signal to show.
  if (!data || data.resolved_count === 0) return null;

  const untracked = data.resolved_count - data.active_tracked_count;
  const stats: ScoreboardStat[] = [
    {
      key: "time-to-answer",
      label: "Avg. time to answer",
      value: humanizeDuration(data.avg_time_to_answer_seconds),
      caption: "From queued to a decision",
      hint:
        data.median_time_to_answer_seconds != null
          ? `Median ${humanizeDuration(data.median_time_to_answer_seconds)}`
          : undefined,
    },
    {
      key: "active-time",
      label: "Avg. active time per ticket",
      value: humanizeDuration(data.avg_active_seconds),
      caption: "Hands-on review time",
      hint:
        data.active_tracked_count === 0
          ? "Tracked from now on"
          : untracked > 0
            ? `${data.active_tracked_count} of ${data.resolved_count} tracked`
            : undefined,
    },
    {
      key: "resolved",
      label: `Tickets handled (${data.window_days}d)`,
      value: data.resolved_count,
      caption: "Approved or rejected",
    },
  ];

  return (
    <div className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Clock className="h-4 w-4 text-slate-400" />
        Handling time
      </h2>
      <StatScoreboard stats={stats} />
    </div>
  );
}
