"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity, Search, TrendingUp, Users, BarChart3,
  Bot, CheckCircle, XCircle, ArrowRight, Zap, AlertTriangle,
  Clock, RefreshCw, Play, ChevronRight, Star, FileText,
  Shield, Calendar, Timer
} from "lucide-react";
import { useSEOData } from "@/lib/hooks/useSEOData";
import { useRealtimeSubscription } from "@/lib/hooks/useRealtimeSubscription";

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

interface SchedulerJob {
  last_run: string | null;
  last_status: string | null;
  last_error: string | null;
  next_run: string | null;
}

interface AgentDef {
  name: string;
  key: string;
  desc: string;
  runLabel: string;
  runDesc: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  endpoint: string;
  method: 'GET' | 'POST';
  page: string;
}

const AGENTS: AgentDef[] = [
  {
    name: "SEO", key: "seo",
    desc: "Keyword rankings, technical audits, Core Web Vitals",
    runLabel: "Run Audit", runDesc: "Full SEO audit + keyword update",
    icon: Search, color: "text-blue-600", bgColor: "bg-blue-50",
    endpoint: "/api/automation/trigger/seo-audit", method: "POST", page: "/seo",
  },
  {
    name: "Content", key: "content",
    desc: "Gap analysis, blog generation, comparison pages",
    runLabel: "Analyze", runDesc: "Scan competitors and identify content gaps",
    icon: FileText, color: "text-purple-600", bgColor: "bg-purple-50",
    endpoint: "/api/content/analyze", method: "POST", page: "/content",
  },
  {
    name: "Ads", key: "ads",
    desc: "Google Ads campaigns, bid optimization, ad copy",
    runLabel: "Optimize", runDesc: "Review campaigns and generate actions",
    icon: TrendingUp, color: "text-green-600", bgColor: "bg-green-50",
    endpoint: "/api/ads/analyze", method: "POST", page: "/ads",
  },
  {
    name: "Social", key: "social",
    desc: "Twitter monitoring, post scheduling, engagement",
    runLabel: "Workflow", runDesc: "Find tweets, generate replies, queue posts",
    icon: Users, color: "text-pink-600", bgColor: "bg-pink-50",
    endpoint: "/api/automation/daily-workflow", method: "POST", page: "/social",
  },
  {
    name: "Reviews", key: "reviews",
    desc: "G2, Capterra, Trustpilot monitoring and responses",
    runLabel: "Monitor", runDesc: "Check new reviews and draft responses",
    icon: Star, color: "text-orange-600", bgColor: "bg-orange-50",
    endpoint: "/api/reviews/analyze", method: "POST", page: "/reviews",
  },
  {
    name: "Analytics", key: "analytics",
    desc: "Cross-channel metrics, attribution, ROI reports",
    runLabel: "Report", runDesc: "Generate weekly performance summary",
    icon: Activity, color: "text-indigo-600", bgColor: "bg-indigo-50",
    endpoint: "/api/analytics/report/weekly", method: "GET", page: "/analytics",
  },
  {
    name: "AI Visibility", key: "ai_visibility",
    desc: "ChatGPT, Claude, Gemini, Perplexity mentions",
    runLabel: "Check", runDesc: "Query AI assistants and score visibility",
    icon: Bot, color: "text-violet-600", bgColor: "bg-violet-50",
    endpoint: "/api/ai-visibility/check", method: "POST", page: "/ai-visibility",
  },
];

const JOB_LABELS: Record<string, { label: string; desc: string }> = {
  daily_keyword_tracking: { label: "Keyword Tracking", desc: "Fetches GSC rankings for all keywords" },
  weekly_seo_audit: { label: "SEO Audit", desc: "Full technical audit (Mondays)" },
  daily_workflow: { label: "Daily Workflow", desc: "Reviews + social post generation" },
  daily_metrics: { label: "Metrics Collection", desc: "Cross-channel metrics into Supabase" },
  daily_ads_check: { label: "Ads Check", desc: "Flag underperforming campaigns" },
  weekly_content_analysis: { label: "Content Analysis", desc: "Gap analysis + actions (Wednesdays)" },
  weekly_ai_visibility: { label: "AI Visibility", desc: "Check AI assistant mentions (Thursdays)" },
  midday_review_check: { label: "Midday Reviews", desc: "Catch reviews posted during the day" },
};

export default function Home() {
  const { stats, error: seoError } = useSEOData();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<{ name: string; ok: boolean; message: string } | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [dashCounts, setDashCounts] = useState<Record<string, number>>({});
  const [pendingAlerts, setPendingAlerts] = useState(0);
  const [pendingActions, setPendingActions] = useState<Record<string, number>>({});
  const [scheduler, setScheduler] = useState<{ running: boolean; jobs: Record<string, SchedulerJob> } | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [marketingScore, setMarketingScore] = useState<number | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<{ label: string; points: number; max: number }[]>([]);

  // Realtime: auto-update when agent actions change (falls back to polling)
  const { connected: realtimeConnected } = useRealtimeSubscription<{ id: string }>({
    table: 'agent_actions',
    onInsert: useCallback(() => fetchDashboard(), []),
    onUpdate: useCallback(() => fetchDashboard(), []),
    onPoll: useCallback(() => fetchDashboard(), []),
  });

  // Realtime: live alerts (falls back to polling)
  useRealtimeSubscription<{ id: string }>({
    table: 'alerts',
    onInsert: useCallback(() => fetchDashboard(), []),
    onPoll: useCallback(() => fetchDashboard(), []),
  });

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
        setPendingAlerts(data.counts?.pending_actions || data.counts?.alerts || 0);
        setPendingActions(data.pending_actions || {});
        if (data.scheduler) setScheduler(data.scheduler);
        // Compute marketing score with transparent breakdown
        const c = data.counts || {};
        const breakdown = [
          { label: "SEO Keywords", points: c.keywords > 0 ? (c.keywords >= 20 ? 20 : 15) : 0, max: 20 },
          { label: "Content", points: c.content_pieces > 0 ? (c.content_pieces >= 10 ? 20 : 15) : 0, max: 20 },
          { label: "Reviews", points: c.reviews > 0 ? (c.reviews >= 10 ? 15 : 10) : 0, max: 15 },
          { label: "SEO Audits", points: c.seo_audits > 0 ? 10 : 0, max: 10 },
          { label: "Scheduler", points: data.scheduler?.running ? 20 : 0, max: 20 },
          { label: "Rating (4+)", points: (c.avg_rating || 0) >= 4 ? 15 : 0, max: 15 },
        ];
        const score = Math.min(100, breakdown.reduce((s, b) => s + b.points, 0));
        setScoreBreakdown(breakdown);
        setMarketingScore(score);
      }
    } catch {
      // Dashboard API unreachable — don't show fake data
    }
  };

  const runAllAgents = async () => {
    setRunningAll(true);
    const agentsToRun = AGENTS.filter(a => a.key !== 'linkedin');
    for (const agent of agentsToRun) {
      setRunningAgent(agent.name);
      try {
        const options: RequestInit = agent.method === 'POST'
          ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
          : { method: 'GET' };
        await fetch(`${SAMA_API_URL}${agent.endpoint}`, options);
      } catch { /* continue */ }
    }
    setRunningAgent(null);
    setRunningAll(false);
    setAgentResult({ name: 'All Agents', ok: true, message: 'All agents have been triggered.' });
    fetchDashboard();
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
        // Refresh dashboard data after agent run
        setTimeout(fetchDashboard, 2000);
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

  const fmtRelative = (iso: string | null) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const fmtTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Command Center</h1>
            <p className="mt-1 text-sm text-slate-500">
              Autonomous marketing platform for Successifier.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {scheduler?.running && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Active
              </span>
            )}
            {realtimeConnected && (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                Live
              </span>
            )}
            <button onClick={runAllAgents} disabled={runningAll || runningAgent !== null}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm">
              {runningAll ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {runningAll ? 'Running...' : 'Run All'}
            </button>
            <button onClick={() => { fetchDashboard(); fetchRecommendations(); }}
              className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
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
        <div className="mb-6 sm:mb-8 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {/* Marketing Score */}
          <div className="rounded-lg border bg-white p-3 sm:p-5 shadow-sm col-span-2 sm:col-span-1 group relative">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <svg className="h-10 w-10 sm:h-12 sm:w-12" viewBox="0 0 36 36">
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                    stroke={marketingScore !== null ? (marketingScore >= 70 ? '#22c55e' : marketingScore >= 40 ? '#eab308' : '#ef4444') : '#94a3b8'}
                    strokeWidth="3" strokeDasharray={`${marketingScore ?? 0}, 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-900">{marketingScore ?? '—'}</span>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Marketing Score</p>
                <p className="text-sm font-semibold text-slate-700">
                  {marketingScore !== null ? (marketingScore >= 70 ? 'Good' : marketingScore >= 40 ? 'Growing' : 'Needs Work') : '—'}
                </p>
              </div>
            </div>
            {/* Score breakdown tooltip */}
            {scoreBreakdown.length > 0 && (
              <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover:block w-56 rounded-lg border bg-white p-3 shadow-lg">
                <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase">Score Breakdown</p>
                {scoreBreakdown.map(b => (
                  <div key={b.label} className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600">{b.label}</span>
                    <span className={`font-medium ${b.points > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                      {b.points}/{b.max}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <KPICard label="Avg Position" value={stats && stats.avgPosition > 0 ? stats.avgPosition.toFixed(1) : '—'} icon={Search} color="text-blue-600" bgColor="bg-blue-50" error={seoError} />
          <KPICard label="Clicks (28d)" value={stats && stats.totalClicks > 0 ? stats.totalClicks.toLocaleString() : '—'} icon={TrendingUp} color="text-green-600" bgColor="bg-green-50" error={seoError} />
          <KPICard label="Avg CTR" value={stats && stats.avgCTR > 0 ? `${stats.avgCTR.toFixed(1)}%` : '—'} icon={Activity} color="text-violet-600" bgColor="bg-violet-50" error={seoError} />
          <KPICard label="Keywords" value={dashCounts.keywords ?? '—'} icon={BarChart3} color="text-orange-600" bgColor="bg-orange-50" />
          <KPICard label="Avg Rating" value={dashCounts.avg_rating ? `${dashCounts.avg_rating} / 5` : '—'} icon={Star} color="text-yellow-600" bgColor="bg-yellow-50" />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left column: Recommendations + Agents */}
          <div className="lg:col-span-2 space-y-8">
            {/* Pending Alerts Banner */}
            {pendingAlerts > 0 && (
              <Link href="/approvals"
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">{pendingAlerts} Pending Actions</p>
                  <p className="text-xs text-amber-600">Agent-generated actions awaiting your review</p>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-400" />
              </Link>
            )}

            {/* Smart Recommendations */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    <h2 className="text-lg font-semibold text-slate-900">Smart Recommendations</h2>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400 ml-7">AI analysis across all agents. Act on these to grow Successifier.</p>
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
                  <p className="text-sm text-slate-500">Everything looks good! No urgent recommendations right now.</p>
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
                              <Link href={`/${rec.agent === 'seo' ? 'seo' : rec.agent}`}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200">
                                {rec.agent}
                              </Link>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">{rec.description}</p>
                          <p className="mt-1 text-xs text-slate-400">{rec.action}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-xs flex-shrink-0">
                          <span className={`rounded px-1.5 py-0.5 ${rec.impact === 'high' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {rec.impact} impact
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                            {rec.effort} effort
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
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Agents</h2>
                <p className="text-xs text-slate-400 mt-0.5">Each agent operates autonomously. Trigger manually or wait for scheduled runs.</p>
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                {AGENTS.map(agent => {
                  const pending = pendingActions[agent.key] || 0;
                  return (
                    <div key={agent.name} className="group rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`rounded-lg p-2 ${agent.bgColor} flex-shrink-0`}>
                          <agent.icon className={`h-5 w-5 ${agent.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">{agent.name}</h3>
                            <AgentStatusBadge agentKey={agent.key} scheduler={scheduler} />
                            {pending > 0 && (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                {pending} pending
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{agent.desc}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link href={agent.page}
                          className="flex-1 rounded-md bg-slate-50 px-2 py-1.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                          Open Dashboard
                        </Link>
                        <button
                          onClick={() => runAgent(agent)}
                          disabled={runningAgent !== null}
                          title={agent.runDesc}
                          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {runningAgent === agent.name ? (
                            <Clock className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          {agent.runLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Autonomous Schedule */}
            {scheduler && (
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Autonomous Schedule</h3>
                </div>
                <p className="text-[10px] text-slate-400 mb-3">
                  These jobs run automatically. All times are UTC.
                </p>
                <div className="space-y-3">
                  {Object.entries(scheduler.jobs || {}).map(([jobId, job]) => {
                    const meta = JOB_LABELS[jobId] || { label: jobId, desc: '' };
                    return (
                      <div key={jobId} className="rounded-md border p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-800">{meta.label}</span>
                          {job.last_status === 'success' && <span className="flex items-center gap-1 text-[10px] text-green-600"><CheckCircle className="h-3 w-3" /> OK</span>}
                          {job.last_status === 'error' && <span className="flex items-center gap-1 text-[10px] text-red-600"><XCircle className="h-3 w-3" /> Error</span>}
                          {!job.last_status && <span className="text-[10px] text-slate-400">Not run yet</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mb-1.5">{meta.desc}</p>
                        <div className="flex gap-3 text-[10px] text-slate-500">
                          {job.last_run && (
                            <span className="flex items-center gap-1">
                              <Timer className="h-2.5 w-2.5" />
                              Last: {fmtRelative(job.last_run)}
                            </span>
                          )}
                          {job.next_run && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              Next: {fmtTime(job.next_run)}
                            </span>
                          )}
                        </div>
                        {job.last_error && (
                          <p className="mt-1 text-[10px] text-red-500 truncate" title={job.last_error}>
                            {job.last_error.slice(0, 80)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Data Counts */}
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Platform Data</h3>
              <p className="text-[10px] text-slate-400 mb-3">Stored in Supabase, updated by agents</p>
              <div className="space-y-2">
                {[
                  { label: "Keywords tracked", value: dashCounts.keywords ?? 0, href: "/seo" },
                  { label: "Content pieces", value: dashCounts.content_pieces ?? 0, href: "/content" },
                  { label: "Reviews", value: dashCounts.reviews ?? 0, href: "/reviews" },
                  { label: "SEO audits", value: dashCounts.seo_audits ?? 0, href: "/seo" },
                  { label: "Pending actions", value: dashCounts.pending_actions ?? 0, href: "/approvals" },
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
                <p className="text-xs text-slate-400 py-4 text-center">No recent activity. Run an agent to get started.</p>
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
                        <p className="text-slate-400">{log.agent || 'system'} {log.created_at ? `· ${fmtRelative(log.created_at)}` : ''}</p>
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
                  { label: "AI Visibility Monitor", href: "/ai-visibility", icon: Bot },
                  { label: "Anomaly Detection", href: "/anomalies", icon: Shield },
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

function KPICard({ label, value, icon: Icon, color, bgColor, error }: {
  label: string; value: string | number; icon: React.ElementType; color: string; bgColor: string; error?: string | null;
}) {
  return (
    <div className={`rounded-lg border bg-white p-3 sm:p-5 shadow-sm ${error ? 'border-red-200' : ''}`}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={`rounded-lg p-1.5 sm:p-2 ${error ? 'bg-red-50' : bgColor} flex-shrink-0`}>
          {error ? <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" /> : <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-medium text-slate-500 truncate">{label}</p>
          {error ? (
            <p className="text-xs text-red-500 truncate" title={error}>Kunde inte ladda</p>
          ) : (
            <p className="text-base sm:text-xl font-bold text-slate-900">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Agent-to-scheduler-job mapping
const AGENT_JOB_MAP: Record<string, string[]> = {
  seo: ['daily_keyword_tracking', 'weekly_seo_audit'],
  content: ['weekly_content_analysis'],
  ads: ['daily_ads_check'],
  social: ['daily_workflow', 'weekly_social_analysis'],
  reviews: ['midday_review_check', 'daily_workflow'],
  analytics: ['daily_metrics'],
  ai_visibility: ['weekly_ai_visibility'],
};

function AgentStatusBadge({ agentKey, scheduler }: {
  agentKey: string;
  scheduler: { running: boolean; jobs: Record<string, SchedulerJob> } | null;
}) {
  if (!scheduler?.running) {
    return (
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="text-[10px] text-slate-400">Offline</span>
      </span>
    );
  }

  const jobIds = AGENT_JOB_MAP[agentKey] || [];
  const jobs = jobIds.map(id => scheduler.jobs?.[id]).filter(Boolean);

  if (jobs.length === 0) {
    return (
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="text-[10px] text-slate-400">No schedule</span>
      </span>
    );
  }

  const hasError = jobs.some(j => j?.last_status === 'error');
  const hasRun = jobs.some(j => j?.last_run);

  if (hasError) {
    return (
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="text-[10px] text-red-500">Error</span>
      </span>
    );
  }

  if (hasRun) {
    return (
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        <span className="text-[10px] text-slate-400">Active</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
      <span className="text-[10px] text-slate-400">Scheduled</span>
    </span>
  );
}
