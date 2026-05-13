"use client";

import Link from "next/link";
import { ArrowRight, Loader2, CheckCircle2, AlertCircle, Pause, Clock } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import {
  missingRequirements,
  pickStatus,
  type AnalysisDef,
  type AnalysisStatusInputs,
  type Requirement,
  type RequirementChecks,
} from "@/lib/analyses";
import type { ActiveRun, AgentKey } from "@/lib/hooks/useActiveRuns";
import { useLanguage } from "@/lib/hooks/useLanguage";
import type { Translations } from "@/lib/locales";

interface AnalysisRowProps {
  def: AnalysisDef;
  runs: ActiveRun[];
  statusInputs: AnalysisStatusInputs;
  requirementChecks: RequirementChecks;
  onTrigger: (agent: AgentKey, endpoint: string) => void;
  // When true, the row never renders the "Kör nu" button even when the
  // analysis has a triggerEndpoint. The autopilot pill still shows.
  hideRunButton?: boolean;
}

const STATUS_PILL: Record<
  ReturnType<typeof pickStatus>,
  { label: keyof Translations["analyses"]; tone: string; icon: typeof Loader2 }
> = {
  running: { label: "running",  tone: "bg-blue-50 text-blue-700",       icon: Loader2 },
  ok:      { label: "autoOk",   tone: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  error:   { label: "autoError", tone: "bg-red-50 text-red-700",         icon: AlertCircle },
  idle:    { label: "autoIdle", tone: "bg-slate-50 text-slate-500",     icon: Pause },
};

const REQUIREMENT_LABEL: Record<Requirement, keyof Translations["analyses"]> = {
  brand_name:  "missingBrandName",
  domain:      "missingDomain",
  geo_queries: "missingGeoQueries",
  competitors: "missingCompetitors",
  github:      "missingGithub",
};

function fmtRelative(iso: string | null | undefined, t: Translations): string {
  if (!iso) return t.analyses.never;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.time.justNow;
  if (mins < 60) return `${mins}${t.time.minutesSuffix}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${t.time.hoursSuffix}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}${t.time.daysSuffix}`;
  return new Date(iso).toLocaleDateString();
}

export default function AnalysisRow({
  def,
  runs,
  statusInputs,
  requirementChecks,
  onTrigger,
  hideRunButton,
}: AnalysisRowProps) {
  const { t } = useLanguage();
  const agent = AGENTS[def.agentIconId];
  const Icon = agent.icon;
  const status = pickStatus(runs, def);
  const pill = STATUS_PILL[status];
  const PillIcon = pill.icon;

  const missing = missingRequirements(def, requirementChecks);
  const missingTooltip =
    missing.length > 0
      ? `${t.analyses.setupRequired} ${missing.map((r) => t.analyses[REQUIREMENT_LABEL[r]]).join(", ")}`
      : undefined;

  const lastRun = def.lastRunSelector(statusInputs);
  const isManual = !hideRunButton && !!def.triggerEndpoint && !!def.agentKey;
  const isRunning = status === "running";
  const canRun = isManual && missing.length === 0 && !isRunning;

  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${agent.bg}`}>
        <Icon className={`h-4 w-4 ${agent.iconColor}`} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={def.href}
            className="text-sm font-semibold text-slate-900 hover:text-blue-700 transition-colors"
          >
            {def.label}
          </Link>
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${pill.tone}`}>
            <PillIcon className={`h-3 w-3 ${isRunning ? "animate-spin" : ""}`} />
            {t.analyses[pill.label]}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{def.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t.analyses.lastRun}: {fmtRelative(lastRun, t)}
          </span>
          {def.cronDescription && (
            <span>
              {t.analyses.nextRun}: {def.cronDescription}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 self-center">
        {isManual ? (
          <button
            onClick={() => def.agentKey && def.triggerEndpoint && onTrigger(def.agentKey, def.triggerEndpoint)}
            disabled={!canRun}
            title={missingTooltip}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {t.analyses.running}
              </>
            ) : (
              t.analyses.runNow
            )}
          </button>
        ) : def.cadence === "autopilot" ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700">
            {t.analyses.onAutopilot}
          </span>
        ) : null}
        <Link
          href={def.href}
          className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          title={t.analyses.open}
          aria-label={t.analyses.open}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </li>
  );
}
