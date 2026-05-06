"use client";

import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2, Pause } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AGENT_LIST } from "@/lib/agents";
import type { ActiveRun, AgentKey } from "@/lib/hooks/useActiveRuns";
import { useLanguage } from "@/lib/hooks/useLanguage";

type ChipStatus = "running" | "ok" | "error" | "idle";

interface AgentChipsProps {
  runs: ActiveRun[];
}

// Agents currently active in the product
const ACTIVE_AGENT_IDS = new Set(["geo", "seo", "content", "analytics", "tech"]);

// AGENTS use display ids (geo, strategy, ...); useActiveRuns uses backend
// AgentKeys (ai_visibility, ...). Map between them.
const AGENT_ID_TO_KEY: Record<string, AgentKey | undefined> = {
  geo: "ai_visibility",
  seo: "seo",
  content: "content",
  analytics: "analytics",
  tech: undefined,
};

const STATUS_TONE: Record<ChipStatus, { tone: string; icon: LucideIcon }> = {
  running: { tone: "bg-blue-50 text-blue-700 border-blue-200",     icon: Loader2 },
  ok:      { tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  error:   { tone: "bg-red-50 text-red-700 border-red-200",         icon: AlertCircle },
  idle:    { tone: "bg-slate-50 text-slate-500 border-slate-200",   icon: Pause },
};

function pickStatus(runs: ActiveRun[], agentId: string): ChipStatus {
  const key = AGENT_ID_TO_KEY[agentId];
  if (!key) return "idle";
  const matching = runs.filter((r) => r.agent === key);
  if (matching.length === 0) return "idle";
  const latest = [...matching].sort((a, b) => b.triggered_at - a.triggered_at)[0];
  if (latest.status === "running" || latest.status === "pending") return "running";
  if (latest.status === "failed") return "error";
  return "ok";
}

export default function AgentChips({ runs }: AgentChipsProps) {
  const { t } = useLanguage();

  function statusLabel(status: ChipStatus, agentId: string): string {
    if (status === "running") return t.agentChips.running;
    if (status === "ok") return t.agentChips.active;
    if (status === "error") return t.agentChips.error;
    const idleMap: Record<string, string> = {
      geo:       t.agentChips.idle.geo,
      seo:       t.agentChips.idle.seo,
      content:   t.agentChips.idle.content,
      social:    t.agentChips.idle.social,
      ads:       t.agentChips.idle.ads,
      analytics: t.agentChips.idle.analytics,
      strategy:  t.agentChips.idle.strategy,
      tech:      t.agentChips.idle.tech,
    };
    return idleMap[agentId] ?? t.agentChips.idle.default;
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t.agentChips.title}
      </h2>
      <div className="flex flex-wrap gap-2">
        {AGENT_LIST.filter((a) => ACTIVE_AGENT_IDS.has(a.id)).map((agent) => {
          const status = pickStatus(runs, agent.id);
          const meta = STATUS_TONE[status];
          const Icon = meta.icon;
          const label = statusLabel(status, agent.id);
          return (
            <Link
              key={agent.id}
              href={agent.href}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-shadow hover:shadow-sm ${meta.tone}`}
              title={`${agent.label} — ${label}`}
            >
              <agent.icon className="h-3.5 w-3.5" />
              <span className="text-slate-900">{agent.label}</span>
              <span className="flex items-center gap-1 opacity-80">
                <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
