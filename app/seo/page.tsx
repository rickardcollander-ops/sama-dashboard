"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowUp, ArrowDown, Minus, Search, TrendingUp, Zap, FileText, Wrench,
  CheckCircle, XCircle, AlertTriangle, Clock, Play, ChevronDown, ChevronUp,
  Gauge, RefreshCw, ExternalLink, BarChart2, Globe
} from "lucide-react";
import Link from "next/link";
import AgentChat from "@/components/AgentChat";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

// ── Types ────────────────────────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
}

interface Keyword {
  keyword: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
  intent?: string;
  priority?: string;
  position_history?: { date: string; position: number }[];
}

interface Action {
  id: string;
  action_id: string;
  action_type?: string;
  type?: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  keyword?: string;
  target_page?: string;
  status: string;
  created_at?: string;
  executed_at?: string;
  execution_result?: any;
  error_message?: string;
}

interface Vitals {
  lcp: number;
  fcp: number;
  cls: number;
  tbt: number;
  speed_index: number;
  performance_score: number;
  error?: string;
}

interface SerpResult {
  keyword: string;
  results_analyzed: number;
  results: {
    position: number;
    url: string;
    title: string;
    snippet: string;
    word_count: number;
    h2_count: number;
    has_schema_markup: boolean;
    image_count: number;
  }[];
  insights: {
    recommended_word_count: number;
    recommended_h2_count: number;
    schema_usage_percentage: number;
    common_topics: string[];
    competitive_analysis: {
      avg_word_count: number;
      min_word_count: number;
      max_word_count: number;
      schema_adoption: string;
    };
    recommendations: string[];
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'high':     return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':   return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:         return 'bg-blue-100 text-blue-800 border-blue-200';
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'content':   return <FileText className="h-5 w-5 text-blue-600" />;
    case 'technical': return <Wrench   className="h-5 w-5 text-red-600" />;
    case 'on_page':   return <Search   className="h-5 w-5 text-purple-600" />;
    default:          return <Zap      className="h-5 w-5 text-slate-600" />;
  }
};

const getVitalStatus = (metric: string, value: number) => {
  if (metric === 'lcp') return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
  if (metric === 'fcp') return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
  if (metric === 'cls') return value <= 0.1  ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
  if (metric === 'tbt') return value <= 200  ? 'good' : value <= 600  ? 'needs-improvement' : 'poor';
  return 'unknown';
};

const getVitalColor = (status: string) => {
  if (status === 'good')             return 'text-green-700 bg-green-50 border-green-200';
  if (status === 'needs-improvement') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-red-700 bg-red-50 border-red-200';
};

/** Derive trend from position_history: compare latest vs entry ~7 days ago */
const getPositionTrend = (history: { date: string; position: number }[] | undefined, current: number) => {
  if (!history || history.length < 2 || current === 0) return 'flat';
  const prev = history[Math.max(0, history.length - 7)]?.position;
  if (!prev) return 'flat';
  if (current < prev) return 'up';   // lower position number = better
  if (current > prev) return 'down';
  return 'flat';
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SEOPage() {
  // Data
  const [keywords, setKeywords]       = useState<Keyword[]>([]);
  const [loadingKw, setLoadingKw]     = useState(true);
  const [actions, setActions]         = useState<Action[]>([]);
  const [vitals, setVitals]           = useState<Vitals | null>(null);
  const [loadingVitals, setLoadingVitals] = useState(true);
  const [auditHistory, setAuditHistory]   = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Computed stats
  const [stats, setStats] = useState({ avgPosition: 0, totalClicks: 0, totalImpressions: 0, avgCTR: 0 });

  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'vitals' | 'history' | 'serp'>('overview');
  const [analyzing, setAnalyzing]   = useState(false);
  const [analysis, setAnalysis]     = useState<any>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [executing, setExecuting]   = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});
  const [expandedAction, setExpandedAction]     = useState<string | null>(null);
  const [showCompleted, setShowCompleted]       = useState(false);

  // SERP state
  const [serpKeyword, setSerpKeyword]   = useState('');
  const [serpLoading, setSerpLoading]   = useState(false);
  const [serpResult, setSerpResult]     = useState<SerpResult | null>(null);
  const [serpError, setSerpError]       = useState<string | null>(null);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchKeywords = useCallback(async () => {
    setLoadingKw(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/keywords`);
      if (!res.ok) return;
      const data = await res.json();
      const kws: Keyword[] = (data.keywords || []).map((k: any) => ({
        keyword:          k.keyword,
        position:         k.current_position || 0,
        clicks:           k.current_clicks || 0,
        impressions:      k.current_impressions || 0,
        ctr:              k.current_impressions > 0 ? (k.current_clicks / k.current_impressions) * 100 : 0,
        intent:           k.intent || '',
        priority:         k.priority || '',
        position_history: k.position_history || [],
      }));
      setKeywords(kws);

      // Compute stats from keywords with real position data
      const withPos = kws.filter(k => k.position > 0);
      const totalClicks      = kws.reduce((s, k) => s + k.clicks, 0);
      const totalImpressions = kws.reduce((s, k) => s + k.impressions, 0);
      const avgPosition      = withPos.length ? withPos.reduce((s, k) => s + k.position, 0) / withPos.length : 0;
      const avgCTR           = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      setStats({
        avgPosition:      parseFloat(avgPosition.toFixed(1)),
        totalClicks,
        totalImpressions,
        avgCTR:           parseFloat(avgCTR.toFixed(1)),
      });
    } catch { /* silently fail */ }
    finally { setLoadingKw(false); }
  }, []);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/actions?limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      const all: Action[] = data.actions || [];
      // Deduplicate by action_id — keep latest
      const deduped = all.reduce((acc: Action[], cur) => {
        const ex = acc.find(a => a.action_id === cur.action_id);
        if (!ex) { acc.push(cur); }
        else if (new Date(cur.created_at || 0) > new Date(ex.created_at || 0)) {
          acc[acc.indexOf(ex)] = cur;
        }
        return acc;
      }, []);
      setActions(deduped);
    } catch { /* silently fail */ }
  }, []);

  const fetchVitals = useCallback(async () => {
    setLoadingVitals(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/vitals`);
      if (res.ok) {
        const data = await res.json();
        setVitals(data.vitals);
      }
    } catch { /* silently fail */ }
    finally { setLoadingVitals(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/audits?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setAuditHistory(data.audits || []);
      }
    } catch { /* silently fail */ }
    finally { setLoadingHistory(false); }
  }, []);

  // Load everything in parallel on mount
  useEffect(() => {
    fetchKeywords();
    fetchActions();
    fetchVitals();
  }, [fetchKeywords, fetchActions, fetchVitals]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const runAnalysis = async () => {
    setAnalyzing(true);
    setErrorMsg(null);
    setActiveTab('actions');
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/analyze`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
        await fetchActions();
        await fetchKeywords();
      } else {
        setErrorMsg('Analysis failed. Check backend connection.');
      }
    } catch {
      setErrorMsg('Error connecting to backend.');
    } finally {
      setAnalyzing(false);
    }
  };

  const executeAction = async (action: Action) => {
    setExecuting(action.id);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      const result = res.ok ? await res.json() : { error: 'Execution failed' };
      setExecutionResults(prev => ({ ...prev, [action.id]: result }));
      setExpandedAction(action.id);
      await fetchActions();
    } catch {
      setExecutionResults(prev => ({ ...prev, [action.id]: { error: 'Backend not reachable' } }));
    } finally {
      setExecuting(null);
    }
  };

  const executeAll = async () => {
    const pending = actions.filter(a => a.status === 'pending');
    await Promise.all(pending.map(a => executeAction(a)));
    await fetchActions();
  };

  const runSerpAnalysis = async () => {
    if (!serpKeyword.trim()) return;
    setSerpLoading(true);
    setSerpError(null);
    setSerpResult(null);
    try {
      const res = await fetch(
        `${SAMA_API_URL}/api/seo/advanced/serp/analyze?keyword=${encodeURIComponent(serpKeyword)}&num_results=5`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) { setSerpResult(data); }
      else { setSerpError(data.error || 'Analysis failed'); }
    } catch {
      setSerpError('Could not reach backend');
    } finally {
      setSerpLoading(false);
    }
  };

  // ── Computed ────────────────────────────────────────────────────────────────

  const pendingActions   = actions.filter(a => a.status === 'pending');
  const completedActions = actions.filter(a => a.status === 'completed');
  const displayedActions = showCompleted ? actions : pendingActions;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      {/* Nav */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Search className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">SEO Agent</h1>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400">Last 28 days · successifier.com</span>
              <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">← Back</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-6 max-w-[1400px] mx-auto">

          {/* ── Left: main content ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">SEO Performance</h2>
                <p className="mt-1 text-slate-500 text-sm">Observe → Orient → Decide → Execute → Track</p>
              </div>
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 shadow-lg shadow-blue-600/20 text-sm"
              >
                {analyzing
                  ? <><Clock className="h-4 w-4 animate-spin" /> Analyzing…</>
                  : <><Zap className="h-4 w-4" /> Run Full Analysis</>}
              </button>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{errorMsg}</p>
                <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
              </div>
            )}

            {/* Stats Grid */}
            <div className="mb-6 grid gap-4 md:grid-cols-4">
              {[
                { label: 'Avg Position',   value: stats.avgPosition || '—',  sub: 'keywords with data',    trend: undefined },
                { label: 'Total Clicks',   value: stats.totalClicks,          sub: 'last 28 days',           trend: undefined },
                { label: 'Impressions',    value: stats.totalImpressions,     sub: 'last 28 days',           trend: undefined },
                { label: 'Avg CTR',        value: `${stats.avgCTR}%`,        sub: 'clicks / impressions',   trend: undefined },
              ].map(card => (
                <div key={card.label} className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Tab nav */}
            <div className="mb-5 flex gap-1 rounded-xl bg-white p-1 border shadow-sm overflow-x-auto">
              {[
                { id: 'overview' as const, label: 'Keywords',        icon: <Search     className="h-4 w-4" /> },
                { id: 'actions'  as const, label: `Actions${pendingActions.length ? ` (${pendingActions.length})` : ''}`, icon: <Zap  className="h-4 w-4" /> },
                { id: 'serp'     as const, label: 'SERP Analysis',   icon: <Globe      className="h-4 w-4" /> },
                { id: 'vitals'   as const, label: 'Core Web Vitals', icon: <Gauge      className="h-4 w-4" /> },
                { id: 'history'  as const, label: 'Audit History',   icon: <Clock      className="h-4 w-4" /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'history' && auditHistory.length === 0) fetchHistory();
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* ── TAB: Keywords Overview ─────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="border-b px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Tracked Keywords</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {keywords.length} keywords · Trend = vs. 7 days ago
                    </p>
                  </div>
                  <button onClick={fetchKeywords} className="text-slate-400 hover:text-slate-600 p-1 rounded">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        {['Keyword','Intent','Priority','Position','Trend','Clicks','Impressions','CTR'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingKw ? (
                        <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">Loading…</td></tr>
                      ) : keywords.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-5 py-12 text-center">
                            <Search className="mx-auto h-10 w-10 text-slate-200 mb-3" />
                            <p className="text-slate-500 font-medium">No keywords tracked yet</p>
                            <p className="text-slate-400 text-xs mt-1">Click "Run Full Analysis" to pull data from Google Search Console</p>
                          </td>
                        </tr>
                      ) : (
                        keywords.map(kw => {
                          const trend = getPositionTrend(kw.position_history, kw.position);
                          return (
                            <tr key={kw.keyword} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3.5 font-medium text-slate-900">
                                <div className="flex items-center gap-2">
                                  {kw.keyword}
                                  <button
                                    onClick={() => { setSerpKeyword(kw.keyword); setActiveTab('serp'); }}
                                    title="Analyze SERP"
                                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-600 transition-opacity"
                                  >
                                    <BarChart2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                {kw.intent ? (
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    kw.intent === 'commercial'    ? 'bg-purple-100 text-purple-700' :
                                    kw.intent === 'transactional' ? 'bg-green-100 text-green-700' :
                                    kw.intent === 'informational' ? 'bg-blue-100 text-blue-700' :
                                    'bg-slate-100 text-slate-600'}`}>{kw.intent}</span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-5 py-3.5">
                                {kw.priority ? (
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    kw.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                    kw.priority === 'high'     ? 'bg-orange-100 text-orange-700' :
                                    kw.priority === 'medium'   ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-slate-100 text-slate-600'}`}>{kw.priority}</span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`font-semibold ${kw.position <= 3 ? 'text-green-600' : kw.position <= 10 ? 'text-blue-600' : kw.position > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                                  {kw.position > 0 ? `#${kw.position.toFixed(1)}` : '—'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                {kw.position === 0 ? (
                                  <span className="text-slate-300 text-xs">new</span>
                                ) : trend === 'up' ? (
                                  <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><ArrowUp className="h-3.5 w-3.5" />up</span>
                                ) : trend === 'down' ? (
                                  <span className="flex items-center gap-1 text-red-500 text-xs font-medium"><ArrowDown className="h-3.5 w-3.5" />down</span>
                                ) : (
                                  <span className="flex items-center gap-1 text-slate-400 text-xs"><Minus className="h-3.5 w-3.5" />flat</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-slate-700">{kw.clicks.toLocaleString()}</td>
                              <td className="px-5 py-3.5 text-slate-700">{kw.impressions.toLocaleString()}</td>
                              <td className="px-5 py-3.5 text-slate-700">{kw.ctr.toFixed(1)}%</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB: Actions ───────────────────────────────────────────── */}
            {activeTab === 'actions' && (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900">Action Items</h3>
                      <button
                        onClick={() => setShowCompleted(s => !s)}
                        className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
                      >
                        {showCompleted ? 'Hide completed' : `Show completed (${completedActions.length})`}
                      </button>
                    </div>
                    {pendingActions.length > 0 && (
                      <button
                        onClick={executeAll}
                        disabled={executing !== null}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-green-400"
                      >
                        <Play className="h-4 w-4" /> Execute All ({pendingActions.length})
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Pending',   value: pendingActions.length,                                                bg: 'bg-slate-50',   text: 'text-slate-700' },
                      { label: 'Critical',  value: pendingActions.filter(a => a.priority === 'critical').length,         bg: 'bg-red-50',     text: 'text-red-700' },
                      { label: 'High',      value: pendingActions.filter(a => a.priority === 'high').length,             bg: 'bg-orange-50',  text: 'text-orange-700' },
                      { label: 'Completed', value: completedActions.length,                                              bg: 'bg-green-50',   text: 'text-green-700' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-lg ${s.bg} p-3 text-center`}>
                        <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
                        <p className={`text-xs ${s.text} opacity-75`}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action list */}
                {displayedActions.length === 0 ? (
                  <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                    <Zap className="mx-auto h-12 w-12 text-slate-200" />
                    <h3 className="mt-4 font-semibold text-slate-900">No Actions Yet</h3>
                    <p className="mt-2 text-sm text-slate-500">Click "Run Full Analysis" to scan your site and generate actionable recommendations.</p>
                  </div>
                ) : (
                  displayedActions.map(action => {
                    const aType = action.action_type || action.type || '';
                    const res   = executionResults[action.id];
                    return (
                      <div
                        key={action.id}
                        className={`rounded-xl border bg-white shadow-sm transition-all ${action.status === 'completed' ? 'opacity-70 border-green-100' : action.status === 'failed' ? 'border-red-100' : ''}`}
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="mt-0.5 flex-shrink-0">
                                {action.status === 'completed' ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                                 action.status === 'failed'    ? <XCircle     className="h-5 w-5 text-red-500" /> :
                                 getTypeIcon(aType)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h4 className="font-medium text-slate-900 text-sm">{action.title}</h4>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>
                                    {action.priority}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{aType}</span>
                                  {action.status === 'completed' && action.executed_at && (
                                    <span className="text-xs text-slate-400">Done {new Date(action.executed_at).toLocaleTimeString()}</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">{action.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {action.status === 'pending' && (
                                <button
                                  onClick={() => executeAction(action)}
                                  disabled={executing === action.id}
                                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                                >
                                  {executing === action.id
                                    ? <><Clock className="h-3 w-3 animate-spin" /> Running…</>
                                    : <><Play  className="h-3 w-3" /> Execute</>}
                                </button>
                              )}
                              <button
                                onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                                className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400"
                              >
                                {expandedAction === action.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Expanded */}
                          {expandedAction === action.id && (
                            <div className="mt-3 ml-8 space-y-2">
                              <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                                <p className="text-xs font-medium text-slate-500 mb-1">Recommended Action</p>
                                <p className="text-xs text-slate-700">{action.action}</p>
                              </div>
                              {action.keyword && (
                                <div className="flex gap-4 text-xs text-slate-500">
                                  <span><span className="font-medium">Keyword:</span> {action.keyword}</span>
                                  {action.target_page && <span><span className="font-medium">Page:</span> {action.target_page}</span>}
                                </div>
                              )}
                              {(res || action.execution_result) && (() => {
                                const r       = res || action.execution_result;
                                const isError = !!r.error || r.success === false;
                                const text    = r.suggestions || r.fix_plan || r.message || r.error;
                                return (
                                  <div className={`rounded-lg p-3 border ${isError ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                    <p className={`text-xs font-semibold mb-1.5 ${isError ? 'text-red-700' : 'text-green-700'}`}>
                                      {isError ? '❌ Failed' : '✅ Completed'}
                                      {r.action_type && <span className="ml-2 font-normal opacity-60">({r.action_type})</span>}
                                    </p>
                                    {text && <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{text}</pre>}
                                    {r.result && !text && (
                                      <pre className="text-xs text-slate-700 whitespace-pre-wrap overflow-auto max-h-40">{JSON.stringify(r.result, null, 2)}</pre>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── TAB: SERP Analysis ─────────────────────────────────────── */}
            {activeTab === 'serp' && (
              <div className="space-y-4">
                {/* Search input */}
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-1">SERP Analysis</h3>
                  <p className="text-xs text-slate-500 mb-4">Analyze top Google results for any keyword — see word count, structure, schema usage and get content recommendations.</p>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={serpKeyword}
                        onChange={e => setSerpKeyword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && runSerpAnalysis()}
                        placeholder="e.g. customer success platform"
                        className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={runSerpAnalysis}
                      disabled={serpLoading || !serpKeyword.trim()}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                    >
                      {serpLoading ? <><Clock className="h-4 w-4 animate-spin" /> Analyzing…</> : <><Globe className="h-4 w-4" /> Analyze</>}
                    </button>
                  </div>
                  {/* Quick keywords */}
                  {keywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-xs text-slate-400">Quick:</span>
                      {keywords.slice(0, 6).map(k => (
                        <button
                          key={k.keyword}
                          onClick={() => { setSerpKeyword(k.keyword); }}
                          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-blue-100 hover:text-blue-700"
                        >
                          {k.keyword}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error */}
                {serpError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{serpError}</div>
                )}

                {/* Results */}
                {serpResult && (
                  <>
                    {/* Insights summary */}
                    <div className="rounded-xl border bg-white p-5 shadow-sm">
                      <h4 className="font-semibold text-slate-900 mb-4">
                        Competitive Insights — <span className="text-blue-600">"{serpResult.keyword}"</span>
                        <span className="ml-2 text-xs text-slate-400 font-normal">{serpResult.results_analyzed} pages analyzed</span>
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                        {[
                          { label: 'Avg Word Count',  value: `${(serpResult.insights.competitive_analysis?.avg_word_count || 0).toLocaleString()}` },
                          { label: 'Avg H2 Headings', value: serpResult.insights.recommended_h2_count },
                          { label: 'Schema Adoption', value: `${serpResult.insights.schema_usage_percentage}%` },
                          { label: 'Word Count Range', value: `${(serpResult.insights.competitive_analysis?.min_word_count || 0).toLocaleString()}–${(serpResult.insights.competitive_analysis?.max_word_count || 0).toLocaleString()}` },
                        ].map(m => (
                          <div key={m.label} className="rounded-lg bg-slate-50 p-3 text-center">
                            <p className="text-lg font-bold text-slate-900">{m.value}</p>
                            <p className="text-xs text-slate-500">{m.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Recommendations */}
                      {serpResult.insights.recommendations?.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recommendations for successifier.com</p>
                          <ul className="space-y-1.5">
                            {serpResult.insights.recommendations.map((r, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Common topics */}
                      {serpResult.insights.common_topics?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Common Topics in Top Results</p>
                          <div className="flex flex-wrap gap-2">
                            {serpResult.insights.common_topics.map((t, i) => (
                              <span key={i} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Per-result breakdown */}
                    <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
                      <div className="border-b px-5 py-4">
                        <h4 className="font-semibold text-slate-900">Top Results Breakdown</h4>
                      </div>
                      <div className="divide-y">
                        {serpResult.results.map(r => (
                          <div key={r.url} className="px-5 py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                                  {r.position}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">{r.title}</p>
                                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate">
                                    {r.url} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                  </a>
                                  {r.snippet && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.snippet}</p>}
                                </div>
                              </div>
                              <div className="flex-shrink-0 text-right text-xs text-slate-500 space-y-0.5">
                                <p><span className="font-medium text-slate-700">{r.word_count?.toLocaleString()}</span> words</p>
                                <p><span className="font-medium text-slate-700">{r.h2_count}</span> H2s</p>
                                <p>{r.has_schema_markup ? <span className="text-green-600 font-medium">Schema ✓</span> : <span className="text-slate-400">No schema</span>}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── TAB: Core Web Vitals ───────────────────────────────────── */}
            {activeTab === 'vitals' && (
              <div className="space-y-4">
                {loadingVitals ? (
                  <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                    <Clock className="mx-auto h-8 w-8 text-slate-300 animate-spin mb-3" />
                    <p className="text-slate-500 text-sm">Fetching from Google PageSpeed Insights API…</p>
                  </div>
                ) : vitals && !vitals.error ? (
                  <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-semibold text-slate-900">Core Web Vitals</h3>
                        <p className="text-xs text-slate-500">Live data · Mobile · successifier.com</p>
                      </div>
                      <button onClick={fetchVitals} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                      </button>
                    </div>

                    {/* Score circle */}
                    <div className="mb-6 flex justify-center">
                      <div className={`inline-flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 ${
                        (vitals.performance_score || 0) >= 90 ? 'border-green-500 bg-green-50' :
                        (vitals.performance_score || 0) >= 50 ? 'border-yellow-500 bg-yellow-50' :
                        'border-red-500 bg-red-50'}`}>
                        <span className="text-3xl font-bold text-slate-900">{vitals.performance_score || 0}</span>
                        <span className="text-xs text-slate-500">/ 100</span>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {[
                        { key: 'lcp', label: 'LCP',          value: vitals.lcp,  unit: 'ms', target: '< 2,500ms', desc: 'Largest Contentful Paint' },
                        { key: 'fcp', label: 'FCP',          value: vitals.fcp,  unit: 'ms', target: '< 1,800ms', desc: 'First Contentful Paint' },
                        { key: 'cls', label: 'CLS',          value: vitals.cls,  unit: '',   target: '< 0.1',     desc: 'Cumulative Layout Shift' },
                        { key: 'tbt', label: 'TBT',          value: vitals.tbt,  unit: 'ms', target: '< 200ms',   desc: 'Total Blocking Time' },
                      ].map(m => {
                        const st = getVitalStatus(m.key, m.value || 0);
                        return (
                          <div key={m.key} className={`rounded-xl border p-4 ${getVitalColor(st)}`}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{m.label}</p>
                              <span className="text-xs opacity-60">{st === 'good' ? '✓' : st === 'needs-improvement' ? '~' : '✗'}</span>
                            </div>
                            <p className="text-2xl font-bold">{m.value || 0}{m.unit}</p>
                            <p className="text-xs opacity-60 mt-1">Target: {m.target}</p>
                            <p className="text-xs opacity-50 mt-0.5">{m.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                    <Gauge className="mx-auto h-12 w-12 text-slate-200 mb-3" />
                    <p className="text-slate-500">{vitals?.error || 'Could not load vitals. Try refreshing.'}</p>
                    <button onClick={fetchVitals} className="mt-3 text-sm text-blue-600 hover:underline">Retry</button>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Audit History ─────────────────────────────────────── */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {loadingHistory ? (
                  <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                    <Clock className="mx-auto h-8 w-8 text-slate-300 animate-spin mb-3" />
                    <p className="text-slate-500 text-sm">Loading audit history…</p>
                  </div>
                ) : auditHistory.length === 0 ? (
                  <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                    <Clock className="mx-auto h-12 w-12 text-slate-200 mb-3" />
                    <h3 className="font-semibold text-slate-900">No Audits Yet</h3>
                    <p className="mt-1 text-sm text-slate-500">Run your first SEO audit to start tracking site health over time.</p>
                    <button onClick={runAnalysis} className="mt-4 text-sm text-blue-600 hover:underline font-medium">Run analysis now →</button>
                  </div>
                ) : (
                  auditHistory.map((audit, idx) => {
                    const criticals = Array.isArray(audit.critical_issues) ? audit.critical_issues : [];
                    const highs     = Array.isArray(audit.high_issues)     ? audit.high_issues     : [];
                    const mediums   = Array.isArray(audit.medium_issues)   ? audit.medium_issues   : [];
                    return (
                      <div key={idx} className="rounded-xl border bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-slate-900">
                              Audit — {new Date(audit.audit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">{new Date(audit.audit_date).toLocaleTimeString()}</p>
                          </div>
                          <div className="flex gap-3 text-xs font-medium">
                            {criticals.length > 0 && <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5">{criticals.length} critical</span>}
                            {highs.length     > 0 && <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5">{highs.length} high</span>}
                            {mediums.length   > 0 && <span className="rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5">{mediums.length} medium</span>}
                            {audit.lcp_score      && <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">LCP {audit.lcp_score}ms</span>}
                          </div>
                        </div>

                        {/* Actual issues list */}
                        {criticals.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-red-600 mb-1">Critical Issues</p>
                            <ul className="space-y-1">
                              {criticals.slice(0, 5).map((issue: any, i: number) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                  <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                  {issue.message || issue.type?.replace(/_/g, ' ')} {issue.url && <span className="text-slate-400 truncate">{issue.url}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {audit.recommendations && Array.isArray(audit.recommendations) && audit.recommendations.length > 0 && (
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500 mb-1.5">AI Recommendations</p>
                            <ul className="space-y-1">
                              {audit.recommendations.filter((r: string) => r.trim()).slice(0, 4).map((rec: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                  <span className="text-blue-500 flex-shrink-0">→</span> {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </div>{/* end left */}

          {/* ── Right: AgentChat sidebar ───────────────────────────────────── */}
          <div className="hidden lg:block w-[380px] flex-shrink-0">
            <div className="sticky top-[72px]">
              <AgentChat
                agentName="SEO"
                apiUrl={`${SAMA_API_URL}/api/seo`}
                placeholder="'analyze customer success platform' · 'show rankings' · 'run audit' · 'find opportunities'…"
              />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
