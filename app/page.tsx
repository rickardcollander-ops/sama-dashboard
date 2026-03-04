"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, MessageSquare, Search, TrendingUp, Users, CheckCircle, XCircle } from "lucide-react";
import { useSEOData } from "@/lib/hooks/useSEOData";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface AgentDef {
  name: string;
  icon: typeof Search;
  status: string;
  color: string;
  endpoint: string;
  method: 'GET' | 'POST';
  payload?: Record<string, unknown>;
  page: string;
}

export default function Home() {
  const { stats } = useSEOData();
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<{ name: string; ok: boolean; message: string } | null>(null);

  const agents: AgentDef[] = [
    { name: "SEO Agent", icon: Search, status: "active", color: "bg-blue-500", endpoint: "/api/automation/trigger/seo-audit", method: "POST", page: "/seo" },
    { name: "Content Agent", icon: MessageSquare, status: "active", color: "bg-purple-500", endpoint: "/api/content/analyze", method: "POST", page: "/content" },
    { name: "Ads Agent", icon: TrendingUp, status: "active", color: "bg-green-500", endpoint: "/api/ads/analyze", method: "POST", page: "/ads" },
    { name: "Social Agent", icon: Users, status: "active", color: "bg-pink-500", endpoint: "/api/automation/daily-workflow", method: "POST", page: "/social" },
    { name: "Reviews Agent", icon: MessageSquare, status: "active", color: "bg-orange-500", endpoint: "/api/automation/daily-workflow", method: "POST", page: "/reviews" },
    { name: "Analytics Agent", icon: BarChart3, status: "active", color: "bg-indigo-500", endpoint: "/api/analytics/report/weekly", method: "GET", page: "/analytics" },
    { name: "AI Visibility", icon: Activity, status: "active", color: "bg-violet-500", endpoint: "/api/ai-visibility/check", method: "POST", page: "/ai-visibility" },
  ];

  const runAgent = async (agent: AgentDef) => {
    setRunningAgent(agent.name);
    setAgentResult(null);
    try {
      const options: RequestInit = agent.method === 'POST'
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(agent.payload ?? {}) }
        : { method: 'GET' };

      const response = await fetch(`${SAMA_API_URL}${agent.endpoint}`, options);

      if (response.ok) {
        const data = await response.json();
        setAgentResult({ name: agent.name, ok: true, message: data.message || data.summary || `${agent.name} completed successfully.` });
      } else {
        const errText = await response.text().catch(() => 'Unknown error');
        setAgentResult({ name: agent.name, ok: false, message: `Failed (${response.status}): ${errText.slice(0, 120)}` });
      }
    } catch (error) {
      setAgentResult({ name: agent.name, ok: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown'}` });
    } finally {
      setRunningAgent(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">SAMA 2.0</h1>
            </div>
            <div className="flex gap-4">
              <Link href="/seo" className="text-sm font-medium text-slate-600 hover:text-slate-900">SEO</Link>
              <Link href="/ads" className="text-sm font-medium text-slate-600 hover:text-slate-900">Ads</Link>
              <Link href="/social" className="text-sm font-medium text-slate-600 hover:text-slate-900">Social</Link>
              <Link href="/logs" className="text-sm font-medium text-slate-600 hover:text-slate-900">Logs</Link>
              <Link href="/ai-visibility" className="text-sm font-medium text-slate-600 hover:text-slate-900">AI Visibility</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Agent Overview</h2>
          <p className="mt-2 text-slate-600">Monitor and control your autonomous marketing agents</p>
        </div>

        {agentResult && (
          <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 ${agentResult.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-3">
              {agentResult.ok ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              <div>
                <p className={`text-sm font-medium ${agentResult.ok ? 'text-green-800' : 'text-red-800'}`}>{agentResult.name}</p>
                <p className={`text-sm ${agentResult.ok ? 'text-green-700' : 'text-red-700'}`}>{typeof agentResult.message === 'string' ? agentResult.message : JSON.stringify(agentResult.message).slice(0, 200)}</p>
              </div>
            </div>
            <button onClick={() => setAgentResult(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            return (
              <div key={agent.name} className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg ${agent.color} p-3`}>
                      <agent.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{agent.name}</h3>
                      <p className="text-sm text-slate-500">{agent.status}</p>
                    </div>
                  </div>
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={agent.page} className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200">
                    View Details
                  </Link>
                  <button
                    onClick={() => runAgent(agent)}
                    disabled={runningAgent !== null}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    {runningAgent === agent.name ? 'Running...' : 'Run'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Quick Stats</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-slate-500">SEO Position</p>
              <p className="text-2xl font-bold text-slate-900">{stats.avgPosition.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Clicks</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalClicks}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">CTR</p>
              <p className="text-2xl font-bold text-slate-900">{stats.avgCTR.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Impressions</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalImpressions}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
