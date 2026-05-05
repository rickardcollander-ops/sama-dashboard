"use client";

import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2, Pause } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AGENT_LIST } from "@/lib/agents";
import type { ActiveRun, AgentKey } from "@/lib/hooks/useActiveRuns";

// Sprint 2 (H3) — replaces the 4 large agent cards with a compact row of
// chips. Each chip shows: agent name + status, links to the agent's page.

type ChipStatus = "running" | "ok" | "error" | "idle";

interface AgentChipsProps {
  runs: ActiveRun[];
}

// AGENTS use display ids (geo, strategy, ...); useActiveRuns uses backend
// AgentKeys (ai_visibility, ...). Map between them.
const AGENT_ID_TO_KEY: Record<string, AgentKey | undefined> = {
  geo: "ai_visibility",
  seo: "seo",
  content: "content",
  social: "social",
  ads: "ads",
  analytics: "analytics",
  // strategy + tech don't run as background agents
  strategy: undefined,
  tech: undefined,
};

const STATUS_LABEL: Record<ChipStatus, { label: string; tone: string; icon: LucideIcon }> = {
  running: {
    label: "Kör",
    tone: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Loader2,
  },
  ok: {
    label: "Aktiv",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  error: {
    label: "Fel",
    tone: "bg-red-50 text-red-700 border-red-200",
    icon: AlertCircle,
  },
  idle: {
    label: "Vilar",
    tone: "bg-slate-50 text-slate-500 border-slate-200",
    icon: Pause,
  },
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
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Aktiva agenter
      </h2>
      <div className="flex flex-wrap gap-2">
        {AGENT_LIST.map((agent) => {
          const status = pickStatus(runs, agent.id);
          const meta = STATUS_LABEL[status];
          const Icon = meta.icon;
          return (
            <Link
              key={agent.id}
              href={agent.href}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-shadow hover:shadow-sm ${meta.tone}`}
              title={`${agent.label} — ${meta.label}`}
            >
              <agent.icon className="h-3.5 w-3.5" />
              <span className="text-slate-900">{agent.label}</span>
              <span className="flex items-center gap-1 opacity-80">
                <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
                {meta.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
