"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { useActiveRuns, estimateProgress, type ActiveRun } from "@/lib/hooks/useActiveRuns";

export default function ActiveRunsBanner() {
  const { runs, dismissRun, clearCompleted } = useActiveRuns();
  const [expanded, setExpanded] = useState(true);
  // Re-render every second so the progress bars advance smoothly
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === "running" || r.status === "pending");
    if (!hasRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [runs]);

  const visible = runs.filter((r) => !r.dismissed);
  if (visible.length === 0) return null;

  const runningCount = visible.filter((r) => r.status === "running" || r.status === "pending").length;
  const failedCount = visible.filter((r) => r.status === "failed").length;
  const completedCount = visible.filter((r) => r.status === "completed").length;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {runningCount > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
        ) : failedCount > 0 ? (
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {runningCount > 0
              ? `${runningCount} ${runningCount === 1 ? "agent kör" : "agenter kör"}`
              : failedCount > 0
              ? `${failedCount} ${failedCount === 1 ? "agent misslyckades" : "agenter misslyckades"}`
              : `${completedCount} ${completedCount === 1 ? "agent klar" : "agenter klara"}`}
          </p>
          <p className="text-xs text-slate-500">
            {runningCount > 0 ? "Du kan lämna sidan — bevakningen fortsätter." : "Klicka för att se resultat."}
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-slate-100 max-h-96 overflow-y-auto">
          {visible.map((run) => (
            <RunRow key={run.id} run={run} onDismiss={() => dismissRun(run.id)} />
          ))}
          {(completedCount > 0 || failedCount > 0) && runningCount === 0 && (
            <button
              onClick={clearCompleted}
              className="w-full border-t border-slate-100 px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Stäng alla
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RunRow({ run, onDismiss }: { run: ActiveRun; onDismiss: () => void }) {
  const pct = estimateProgress(run);
  const isRunning = run.status === "running" || run.status === "pending";
  const isFailed = run.status === "failed";
  const isCompleted = run.status === "completed";
  const hasPageProgress =
    typeof run.pages_total === "number" && run.pages_total > 0;

  return (
    <div className="px-4 py-3 border-t border-slate-50 first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{run.label}</p>
          {isRunning && (
            <p className="text-xs text-slate-500 mt-0.5">
              {run.status === "pending"
                ? "Startar…"
                : hasPageProgress
                ? `Analyserar ${run.pages_done ?? 0} av ${run.pages_total} sidor`
                : `Kör… ~${Math.max(1, Math.round((run.expected_seconds * (1 - pct / 100)) / 60))} min kvar`}
            </p>
          )}
          {isCompleted && (
            <p className="text-xs text-emerald-600 mt-0.5 truncate" title={run.summary || ""}>
              {run.summary || "Klar"}
            </p>
          )}
          {isFailed && (
            <p className="text-xs text-red-600 mt-0.5 truncate" title={run.error || ""}>
              {run.error || "Misslyckades"}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 flex-shrink-0"
          aria-label={`Stäng ${run.label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFailed ? "bg-red-500" : isCompleted ? "bg-emerald-500" : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
