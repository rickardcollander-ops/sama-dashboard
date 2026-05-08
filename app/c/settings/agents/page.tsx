"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowLeft, BarChart2, Bot, CheckCircle, Compass,
  Globe, Loader2, Megaphone, Play, Search, Star, Users, Zap,
} from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { watchAgentRun, tenantApi } from "@/lib/api";
import CustomerNav from "@/components/CustomerNav";

interface AgentConfig {
  name: string;
  enabled: boolean;
  schedule: string;
  last_run: string | null;
}

const AGENT_INFO: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  seo: { label: "SEO Agent", icon: Search, description: "Rankings, technical audits & keywords" },
  content: { label: "Content Agent", icon: Bot, description: "AI-generated articles & pages" },
  social: { label: "Social Agent", icon: Users, description: "Automated posting & engagement" },
  ads: { label: "Ads Agent", icon: Megaphone, description: "AI-generated ad creatives & campaigns" },
  reviews: { label: "Reviews Agent", icon: Star, description: "Monitors & responds to reviews" },
  analytics: { label: "Analytics Agent", icon: BarChart2, description: "Cross-channel metrics & ROI" },
  geo: { label: "GEO Monitor", icon: Globe, description: "AI Visibility in ChatGPT, Claude, Perplexity & more" },
  strategy: { label: "Strategy Agent", icon: Compass, description: "Synthesizes a cross-channel marketing strategy from each agent's data" },
};

const ALL_AGENT_DEFAULTS: AgentConfig[] = [
  { name: "strategy", enabled: true, schedule: "weekly", last_run: null },
  { name: "seo", enabled: true, schedule: "daily", last_run: null },
  { name: "content", enabled: true, schedule: "weekly", last_run: null },
  { name: "social", enabled: true, schedule: "daily", last_run: null },
  { name: "ads", enabled: false, schedule: "manual", last_run: null },
  { name: "reviews", enabled: true, schedule: "daily", last_run: null },
  { name: "analytics", enabled: true, schedule: "daily", last_run: null },
  { name: "geo", enabled: true, schedule: "weekly", last_run: null },
];

function scheduleLabel(schedule: string): string {
  if (schedule === "daily") return "Daily";
  if (schedule === "weekly") return "Weekly";
  return "Manual";
}

export default function AgentsSettingsPage() {
  const { user } = useUser();
  const { tenantClient } = useSite();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const client = tenantClient;
      const data = await client.get<{ agents: AgentConfig[] }>("/api/tenant/agent-status");
      const fetched = data.agents || [];
      // Merge backend list with defaults so any newly registered agent
      // (e.g. strategy) shows up before the first toggle is persisted.
      const byName = new Map(fetched.map((a) => [a.name, a]));
      const merged = ALL_AGENT_DEFAULTS.map((d) => byName.get(d.name) ?? d);
      const extras = fetched.filter((a) => !merged.find((m) => m.name === a.name));
      setAgents([...merged, ...extras]);
    } catch {
      setAgents(ALL_AGENT_DEFAULTS);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleToggle = async (name: string, enabled: boolean) => {
    if (!user) return;
    setToggling(name);
    setError("");
    try {
      await tenantClient.post(`/api/tenant/agents/${name}/toggle`, { enabled });
      setAgents((prev) => prev.map((a) => (a.name === name ? { ...a, enabled } : a)));
    } catch {
      setError(`Could not toggle ${name}`);
    }
    setToggling(null);
  };

  const handleTrigger = async (name: string) => {
    if (!user) return;
    setTriggering(name);
    setError("");
    try {
      const resp = await tenantClient.post<{ run_id?: string; status?: string }>(
        `/api/tenant/agents/${name}/trigger`,
        undefined,
        { headers: { "X-Sama-Intent": "user-action" } },
      );
      if (resp?.run_id && resp?.status === "running") {
        watchAgentRun(user.id, resp.run_id).then(() => load()).catch(() => {});
      }
      await load();
    } catch {
      setError(`Could not run ${name}`);
    }
    setTriggering(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <Link
          href="/c/settings"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>

        <div className="mt-3 flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2">
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
            <p className="text-sm text-slate-500">
              Toggle agents on/off and trigger manual runs. Disabled agents are hidden from the top menu and excluded from the strategy.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {agents.map((agent) => {
                const info = AGENT_INFO[agent.name] ?? {
                  label: agent.name,
                  icon: Bot,
                  description: "",
                };
                const Icon = info.icon;
                const isToggling = toggling === agent.name;
                const isTriggering = triggering === agent.name;
                return (
                  <li key={agent.name} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`rounded-lg p-2 ${agent.enabled ? "bg-blue-50" : "bg-slate-100"}`}>
                        <Icon className={`h-5 w-5 ${agent.enabled ? "text-blue-600" : "text-slate-400"}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{info.label}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            {scheduleLabel(agent.schedule)}
                          </span>
                          {agent.enabled && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                              <CheckCircle className="h-2.5 w-2.5" /> On
                            </span>
                          )}
                        </div>
                        {info.description && (
                          <p className="mt-0.5 text-xs text-slate-500 truncate">{info.description}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Last run:{" "}
                          {agent.last_run
                            ? new Date(agent.last_run).toLocaleString(undefined, {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Never"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <button
                        onClick={() => handleToggle(agent.name, !agent.enabled)}
                        disabled={isToggling}
                        aria-label={`${agent.enabled ? "Disable" : "Enable"} ${info.label}`}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          agent.enabled ? "bg-blue-500" : "bg-slate-300"
                        } ${isToggling ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            agent.enabled ? "translate-x-[18px]" : "translate-x-[3px]"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => handleTrigger(agent.name)}
                        disabled={isTriggering || !agent.enabled}
                        title={agent.enabled ? "Run now" : "Enable the agent to run it"}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {isTriggering ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        Run
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-900">
          <div className="flex items-start gap-2">
            <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
            <div>
              The Strategy Agent runs automatically Sundays 18:00 UTC after a full week of data. It only runs for tenants where it is enabled, and disabled domain agents are excluded from the synthesized plan.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
