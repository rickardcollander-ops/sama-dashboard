"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity, Search, MessageSquare, TrendingUp, Users, BarChart3,
  Bot, CheckCircle, XCircle, ArrowRight, Zap, AlertTriangle,
  Clock, RefreshCw, Play, ChevronRight
} from "lucide-react";
import { useSEOData } from "@/lib/hooks/useSEOData";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  agent: string;
  action: string;
  impact: string;
  effort: string;
}

interface AgentDef {
  name: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  endpoint: string;
  method: 'GET' | 'POST';
  page: string;
}

const AGENTS: AgentDef[] = [
  { name: "SEO", icon: Search, color: "text-blue-600", bgColor: "bg-blue-50", endpoint: "/api/automation/trigger/seo-audit", method: "POST", page: "/seo" },
  { name: "Content", icon: MessageSquare, color: "text-purple-600", bgColor: "bg-purple-50", endpoint: "/api/content/analyze", method: "POST", page: "/content" },
  { name: "Ads", icon: TrendingUp, color: "text-green-600", bgColor: "bg-green-50", endpoint: "/api/ads/analyze", method: "POST", page: "/ads" },
  { name: "Social", icon: Users, color: "text-pink-600", bgColor: "bg-pink-50", endpoint: "/api/automation/daily-workflow", method: "POST", page: "/social" },
  { name: "Reviews", icon: BarChart3, color: "text-orange-600", bgColor: "bg-orange-50", endpoint: "/api/automation/daily-workflow", method: "POST", page: "/reviews" },
  { name: "Analytics", icon: Activity, color: "text-indigo-600", bgColor: "bg-indigo-50", endpoint: "/api/analytics/report/weekly", method: "GET", page: "/analytics" },
  { name: "AI Visibility", icon: Bot, color: "text-violet-600", bgColor: "bg-violet-50", endpoint: "/api/ai-visibility/check", method: "POST", page: "/ai-visibility" },
];

export default function Home() {
  const { stats } = useSEOData();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<{ name: string; ok: boolean; message: string } | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [dashCounts, setDashCounts] = useState<Record<string, number>>({});
  const [pendingAlerts, setPendingAlerts] = useState(0);

  useEffect(() => {
    fetchDashboard();
    fetchRecommendations();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/dashboard/status`);
      if (res.ok) {
        const data = await res.json();
        setDashCounts(data.counts || {});
        setRecentLogs(data.recent_activity || []);
        setPendingAlerts(data.counts?.alerts || 0);
      }
    } catch { /* silent */ }
  };

  const fetchRecommendations = async () => {
    setRecsLoading(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/dashboard/recommendations`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch { /* silent */ }
    setRecsLoading(false);
  };

  const runAgent = async (agent: AgentDef) => {
    setRunningAgent(agent.name);
    setAgentResult(null);
    try {
      const options: RequestInit = agent.method === 'POST'
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
        : { method: 'GET' };
      const response = await fetch(`${SAMA_API_URL}${agent.endpoint}`, options);
      if (response.ok) {
        const data = await response.json();
        setAgentResult({ name: agent.name, ok: true, message: data.message || data.summary || `${agent.name} completed.` });
      } else {
        setAgentResult({ name: agent.name, ok: false, message: `Failed (${response.status})` });
      }
    } catch {
      setAgentResult({ name: agent.name, ok: false, message: 'Connection error' });
    } finally {
      setRunningAgent(null);
    }
  };

  const priorityColor = (p: string) => ({
    high: 'border-l-red-500 bg-red-50/50',
    medium: 'border-l-yellow-500 bg-yellow-50/50',
    low: 'border-l-blue-500 bg-blue-50/50',
  }[p] || 'border-l-slate-300');

  const priorityBadge = (p: string) => ({
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-blue-100 text-blue-700',
  }[p] || 'bg-slate-100 text-slate-600');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Command Center</h1>
          <p className="mt-1 text-slate-500">Cross-agent intelligence and strategic overview</p>
        </div>

        {/* Agent result toast */}
        {agentResult && (
          <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 ${agentResult.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-3">
              {agentResult.ok ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              <div>
                <p className={`text-sm font-medium ${agentResult.ok ? 'text-green-800' : 'text-red-800'}`}>{agentResult.name}</p>
                <p className={`text-sm ${agentResult.ok ? 'text-green-700' : 'text-red-700'}`}>
                  {typeof agentResult.message === 'string' ? agentResult.message : JSON.stringify(agentResult.message).slice(0, 200)}
                </p>
              </div>
            </div>
            <button onClick={() => setAgentResult(null)} className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none">&times;</button>
          </div>
        )}

        {/* KPI Row */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <KPICard label="Avg Position" value={stats.avgPosition > 0 ? stats.avgPosition.toFixed(1) : '—'} icon={Search} color="text-blue-600" bgColor="bg-blue-50" />
          <KPICard label="Total Clicks" value={stats.totalClicks > 0 ? stats.totalClicks.toLocaleString() : '—'} icon={TrendingUp} color="text-green-600" bgColor="bg-green-50" />
          <KPICard label="Avg CTR" value={stats.avgCTR > 0 ? `${stats.avgCTR.toFixed(1)}%` : '—'} icon={Activity} color="text-violet-600" bgColor="bg-violet-50" />
          <KPICard label="Keywords Tracked" value={dashCounts.keywords ?? '—'} icon={BarChart3} color="text-orange-600" bgColor="bg-orange-50" />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left column: Recommendations + Agents */}
          <div className="lg:col-span-2 space-y-8">
            {/* Smart Recommendations */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  <h2 className="text-lg font-semibold text-slate-900">Smart Recommendations</h2>
                </div>
                <button onClick={fetchRecommendations} disabled={recsLoading}
                  className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50">
                  <RefreshCw className={`h-3.5 w-3.5 ${recsLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              {recsLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="animate-pulse rounded-lg border border-l-4 border-l-slate-200 bg-white p-4">
                      <div className="h-4 w-2/3 rounded bg-slate-200 mb-2" />
                      <div className="h-3 w-full rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : recommendations.length === 0 ? (
                <div className="rounded-lg border bg-white p-8 text-center">
                  <CheckCircle className="mx-auto h-8 w-8 text-green-400 mb-2" />
                  <p className="text-sm text-slate-500">Everything looks good! No urgent recommendations.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.slice(0, 6).map(rec => (
                    <div key={rec.id} className={`rounded-lg border border-l-4 p-4 ${priorityColor(rec.priority)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-sm font-semibold text-slate-900">{rec.title}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityBadge(rec.priority)}`}>
                              {rec.priority}
                            </span>
                            {rec.agent !== 'system' && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {rec.agent}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">{rec.description}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                          <span title="Impact" className={`rounded px-1.5 py-0.5 ${rec.impact === 'high' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {rec.impact} impact
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Agent Grid */}
            <section>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Agents</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {AGENTS.map(agent => (
                  <div key={agent.name} className="group rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`rounded-lg p-2 ${agent.bgColor}`}>
                        <agent.icon className={`h-5 w-5 ${agent.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">{agent.name}</h3>
                        <div className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          <span className="text-[10px] text-slate-400">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={agent.page}
                        className="flex-1 rounded-md bg-slate-50 px-2 py-1.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                        Open
                      </Link>
                      <button
                        onClick={() => runAgent(agent)}
                        disabled={runningAgent !== null}
                        className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {runningAgent === agent.name ? (
                          <Clock className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        Run
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right column: Activity + Quick links */}
          <div className="space-y-6">
            {/* Pending Alerts */}
            {pendingAlerts > 0 && (
              <Link href="/approvals"
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">{pendingAlerts} Pending Alerts</p>
                  <p className="text-xs text-amber-600">Require your attention</p>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-400" />
              </Link>
            )}

            {/* Data Counts */}
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Platform Data</h3>
              <div className="space-y-2">
                {[
                  { label: "Keywords tracked", value: dashCounts.keywords ?? 0, href: "/seo" },
                  { label: "Content pieces", value: dashCounts.content_pieces ?? 0, href: "/content" },
                  { label: "SEO audits", value: dashCounts.seo_audits ?? 0, href: "/seo" },
                  { label: "Alerts", value: dashCounts.alerts ?? 0, href: "/approvals" },
                ].map(item => (
                  <Link key={item.label} href={item.href}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50 transition-colors">
                    <span className="text-sm text-slate-600">{item.label}</span>
                    <span className="text-sm font-bold text-slate-900">{item.value}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
                <Link href="/logs" className="text-xs text-blue-600 hover:text-blue-800">View all</Link>
              </div>
              {recentLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No recent activity</p>
              ) : (
                <div className="space-y-2">
                  {recentLogs.slice(0, 8).map((log, i) => (
                    <div key={log.id || i} className="flex items-start gap-2 text-xs">
                      <span className={`mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                        log.status === 'success' ? 'bg-green-500' :
                        log.status === 'error' ? 'bg-red-500' :
                        'bg-slate-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 truncate">{log.action || log.message || 'Agent activity'}</p>
                        <p className="text-slate-400">{log.agent || 'system'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h3>
              <div className="space-y-1">
                {[
                  { label: "Run SEO Audit", href: "/seo", icon: Search },
                  { label: "View Anomalies", href: "/anomalies", icon: AlertTriangle },
                  { label: "Budget Optimizer", href: "/budget-optimizer", icon: TrendingUp },
                  { label: "Content Analytics", href: "/content-analytics", icon: BarChart3 },
                ].map(link => (
                  <Link key={link.label} href={link.href}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                    <link.icon className="h-4 w-4 text-slate-400" />
                    {link.label}
                    <ArrowRight className="ml-auto h-3 w-3 text-slate-300" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon: Icon, color, bgColor }: {
  label: string; value: string | number; icon: React.ElementType; color: string; bgColor: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={`text-xl font-bold text-slate-900`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
