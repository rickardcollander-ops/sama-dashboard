"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type { AgentDef } from "@/lib/agents";

export interface MetricRow {
  label: string;
  value: React.ReactNode;
  trend?: React.ReactNode;
}

export interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface AgentCardProps {
  agent: AgentDef;
  lastUpdated?: string;
  metrics: MetricRow[];
  quickAction?: QuickAction;
  children?: React.ReactNode;
}

export default function AgentCard({
  agent,
  lastUpdated,
  metrics,
  quickAction,
  children,
}: AgentCardProps) {
  const Icon = agent.icon;

  return (
    <div className="flex flex-col rounded-xl border bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`rounded-lg ${agent.bg} p-2.5`}>
          <Icon className={`h-6 w-6 ${agent.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">{agent.label}</h3>
            {lastUpdated && (
              <span className="text-[10px] text-slate-400">{lastUpdated}</span>
            )}
          </div>
          <p className="text-xs text-slate-500">{agent.description}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        {metrics.map((m) => (
          <div key={typeof m.label === "string" ? m.label : ""} className="flex items-center justify-between">
            <span className="text-sm text-slate-600">{m.label}</span>
            <div className="flex items-center gap-2">
              {m.value}
              {m.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Custom content (e.g. agent pills) */}
      {children}

      {/* Actions */}
      <div className="mt-auto flex gap-2 pt-4">
        {quickAction && (
          <button
            onClick={quickAction.onClick}
            disabled={quickAction.disabled || quickAction.loading}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border ${agent.borderColor} ${agent.bg} px-3 py-2 text-sm font-medium ${agent.textColor} ${agent.hoverBg} disabled:opacity-50 transition-colors`}
          >
            {quickAction.loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              quickAction.icon
            )}
            {quickAction.label}
          </button>
        )}
        <Link
          href={agent.href}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg ${agent.solidBg} px-3 py-2 text-sm font-medium text-white ${agent.solidHover} transition-colors`}
        >
          <Icon className="h-4 w-4" /> Öppna
        </Link>
      </div>
    </div>
  );
}
