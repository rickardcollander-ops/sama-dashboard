"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowUp, ArrowDown, Minus, Search, TrendingUp, Zap, FileText, Wrench,
  CheckCircle, XCircle, AlertTriangle, Clock, Play, ChevronDown, ChevronUp,
  Gauge, RefreshCw, ExternalLink, BarChart2, Globe, Trash2, Target, Lightbulb
} from "lucide-react";
import Link from "next/link";
import AgentChat from "@/components/AgentChat";
import { useToast } from "@/components/Toast";
import { useBackgroundAnalysis } from "@/lib/hooks/useBackgroundAnalysis";

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

interface StrategyTask {
  id: string;
  title: string;
  detail?: string;
  category: 'quick_win' | 'month1' | 'month2' | 'month3' | 'technical';
  impact: string;
  effort: string;
  timeframe: string;
  done: boolean;
  done_at: string | null;
}

interface Strategy {
  headline: string;
  quick_wins: { title: string; action: string; impact: string; effort: string; timeframe: string }[];
  month1: { focus: string; actions: string[] }[];
  month2: { focus: string; actions: string[] }[];
  month3: { focus: string; actions: string[] }[];
  content_gaps: string[];
  technical_priorities: string[];
  kpi_targets: { top10_keywords?: number; monthly_clicks?: number; avg_position?: number };
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
  const toast = useToast();
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
  const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'vitals' | 'history' | 'serp' | 'strategy'>('overview');
  const [kwFilter, setKwFilter] = useState<'all' | 'quick_wins'>('all');
  const [analysis, setAnalysis]     = useState<any>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [executing, setExecuting]   = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});
  const [expandedAction, setExpandedAction]     = useState<string | null>(null);
  const [showCompleted, setShowCompleted]       = useState(false);
  const [syncingGsc, setSyncingGsc]             = useState(false);

  // SERP state
  const [serpKeyword, setSerpKeyword]   = useState('');
  const [serpLoading, setSerpLoading]   = useState(false);
  const [serpResult, setSerpResult]     = useState<SerpResult | null>(null);
  const [serpError, setSerpError]       = useState<string | null>(null);

  // Strategy state
  const [strategy, setStrategy]             = useState<Strategy | null>(null);
  const [strategyTasks, setStrategyTasks]   = useState<StrategyTask[]>([]);
  const [strategyId, setStrategyId]         = useState<string | null>(null);
  const [strategyCreatedAt, setStrategyCreatedAt] = useState<string | null>(null);
  const [strategyFingerprint, setStrategyFingerprint] = useState<string | null>(null);
  const [strategyCached, setStrategyCached] = useState(false);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [togglingTask, setTogglingTask]     = useState<string | null>(null);

  // Delete state
  const [deletingKw, setDeletingKw] = useState<string | null>(null);
  const [deletingAction, setDeletingAction] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState<string | null>(null);
  const [resettingSeo, setResettingSeo] = useState(false);

  // ── Background analysis hook ────────────────────────────────────────────────

  const onAnalysisComplete = useCallback(() => {
    fetchActions();
    fetchKeywords();
    fetchVitals();
    fetchHistory();
    loadStrategy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { startAnalysis: startBgAnalysis, analyzing, phase: analysisPhase, progress: analysisProgress, error: analysisError } =
    useBackgroundAnalysis({
      agent: 'seo',
      onComplete: onAnalysisComplete,
      onError: (err) => setErrorMsg(err),
    });

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
    } catch {
      toast.error("Failed to load keyword data");
    }
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
    } catch {
      console.error("Failed to load SEO actions");
    }
  }, []);

  const fetchVitals = useCallback(async () => {
    setLoadingVitals(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/vitals`);
      if (res.ok) {
        const data = await res.json();
        setVitals(data.vitals);
      }
    } catch {
      toast.error("Failed to load web vitals");
    }
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
    } catch {
      console.error("Failed to load audit history");
    }
    finally { setLoadingHistory(false); }
  }, []);

  const applyStrategyData = (data: any) => {
    if (data.strategy)  setStrategy(data.strategy);
    if (data.tasks)     setStrategyTasks(data.tasks);
    if (data.id)        setStrategyId(data.id);
    if (data.created_at) setStrategyCreatedAt(data.created_at);
    if (data.data_fingerprint) setStrategyFingerprint(data.data_fingerprint);
    setStrategyCached(!!data.cached);
  };

  const loadStrategy = useCallback(async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/strategy`);
      const data = await res.json();
      if (data.success && data.strategy) applyStrategyData(data);
    } catch {
      console.error("Failed to load strategy");
    }
  }, []);

  // Load everything in parallel on mount
  useEffect(() => {
    fetchKeywords();
    fetchActions();
    fetchVitals();
    loadStrategy();
  }, [fetchKeywords, fetchActions, fetchVitals, loadStrategy]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const [initializing, setInitializing]   = useState(false);
  const [trackingKw, setTrackingKw]       = useState<string | null>(null);
  const [trackedKws, setTrackedKws]       = useState<Set<string>>(new Set());

  const addKeyword = async (keyword: string, intent = 'manual', priority = 'medium') => {
    const kw = keyword.trim().toLowerCase();
    if (!kw || trackedKws.has(kw)) return;
    setTrackingKw(kw);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/keywords/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw, intent, priority })
      });
      const data = await res.json();
      if (data.success) {
        setTrackedKws(prev => new Set([...prev, kw]));
        await fetchKeywords();
      }
    } catch {
      toast.error("Failed to add keyword");
    } finally {
      setTrackingKw(null);
    }
  };

  const resetSeoData = async (includeKeywords: boolean) => {
    const mode = includeKeywords ? "ALL SEO data incl. keywords" : "SEO analysis data (keep keywords)";
    // Proceed with reset

    setResettingSeo(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/reset?include_keywords=${includeKeywords}`, {
        method: 'POST',
      });

      if (!res.ok) {
        setErrorMsg('Failed to reset SEO data. Check backend connection.');
        return;
      }

      // Clear local UI state immediately
      setActions([]);
      setAnalysis(null);
      setAuditHistory([]);
      setStrategy(null);
      setStrategyTasks([]);
      setStrategyId(null);
      setStrategyCreatedAt(null);
      setStrategyFingerprint(null);
      setExecutionResults({});
      setExpandedAction(null);
      setShowCompleted(false);

      if (includeKeywords) {
        setKeywords([]);
        setStats({ avgPosition: 0, totalClicks: 0, totalImpressions: 0, avgCTR: 0 });
      }

      // Reload from backend so UI reflects true DB state
      await fetchActions();
      await fetchHistory();
      await loadStrategy();
      await fetchVitals();
      await fetchKeywords();
      toast.success(`SEO data reset successfully`);
    } catch {
      setErrorMsg('Error resetting SEO data.');
      toast.error('Error resetting SEO data');
    } finally {
      setResettingSeo(false);
    }
  };

  const deleteKeyword = async (keyword: string) => {
    setDeletingKw(keyword);
    try {
      await fetch(`${SAMA_API_URL}/api/seo/keywords/${encodeURIComponent(keyword)}`, { method: 'DELETE' });
      await fetchKeywords();
    } catch {
      toast.error("Failed to delete keyword");
    } finally {
      setDeletingKw(null);
    }
  };

  const fetchStrategy = async (force = false) => {
    setStrategyLoading(true);
    try {
      const url = `${SAMA_API_URL}/api/seo/strategy${force ? '?force=true' : ''}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (data.success) applyStrategyData(data);
      else setErrorMsg(data.detail || 'Strategy generation failed');
    } catch {
      setErrorMsg('Could not reach backend');
    } finally {
      setStrategyLoading(false);
    }
  };

  const toggleTask = async (taskId: string, done: boolean) => {
    setTogglingTask(taskId);
    // Optimistic update
    setStrategyTasks(prev => prev.map(t => t.id === taskId ? { ...t, done, done_at: done ? new Date().toISOString() : null } : t));
    try {
      await fetch(`${SAMA_API_URL}/api/seo/strategy/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done })
      });
    } catch {
      console.error("Failed to toggle task");
    }
    finally { setTogglingTask(null); }
  };

  const deleteAction = async (actionId: string) => {
    setDeletingAction(actionId);
    // Optimistic removal
    setActions(prev => prev.filter(a => a.id !== actionId));
    try {
      await fetch(`${SAMA_API_URL}/api/seo/actions/${actionId}`, { method: 'DELETE' });
    } catch {
      console.error('Failed to delete action');
    }
    finally { setDeletingAction(null); }
  };

  const deleteTask = async (taskId: string) => {
    setDeletingTask(taskId);
    // Optimistic removal
    setStrategyTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/strategy/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.tasks) setStrategyTasks(data.tasks);
      }
    } catch {
      console.error('Failed to delete task');
    }
    finally { setDeletingTask(null); }
  };

  const initializeKeywords = async () => {
    setInitializing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/initialize`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchKeywords();
        setErrorMsg(null);
      } else {
        setErrorMsg(data.message || 'Initialize failed');
      }
    } catch {
      setErrorMsg('Could not reach backend');
    } finally {
      setInitializing(false);
    }
  };

  const syncGscKeywords = async () => {
    setSyncingGsc(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/seo/keywords/sync-gsc`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`GSC sync: ${data.inserted} new keywords, ${data.updated} updated (${data.total_gsc} total in GSC)`);
        await fetchKeywords();
      } else {
        setErrorMsg('GSC sync failed');
      }
    } catch {
      setErrorMsg('Could not reach backend');
    } finally {
      setSyncingGsc(false);
    }
  };

  const runAnalysis = async () => {
    setErrorMsg(null);
    setActiveTab('actions');
    await startBgAnalysis();
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
        `${SAMA_API_URL}/api/seo/serp/analyze?keyword=${encodeURIComponent(serpKeyword)}&num_results=5`,
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
<main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6 max-w-[1400px] mx-auto">

          {/* ── Left: main content ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">SEO Agent</h2>
                <p className="mt-1 text-slate-500 text-sm">Tracks keyword rankings, audits technical SEO, and generates optimization actions.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => resetSeoData(false)}
                  disabled={resettingSeo || analyzing || initializing}
                  title="Clear SEO actions, audits and strategy, keep tracked keywords"
                  className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 text-sm"
                >
                  {resettingSeo
                    ? <><Clock className="h-4 w-4 animate-spin" /> Resetting…</>
                    : <><Trash2 className="h-4 w-4" /> Reset SEO Data</>}
                </button>
                <button
                  onClick={() => resetSeoData(true)}
                  disabled={resettingSeo || analyzing || initializing}
                  title="Clear everything including tracked keywords"
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 text-sm"
                >
                  <Trash2 className="h-4 w-4" /> Full Reset
                </button>
                <button
                  onClick={initializeKeywords}
                  disabled={initializing}
                  title="Imports target keywords from config and top queries from Google Search Console into the tracking database"
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-sm"
                >
                  {initializing
                    ? <><Clock className="h-4 w-4 animate-spin" /> Initializing…</>
                    : <><RefreshCw className="h-4 w-4" /> Initialize Keywords</>}
                </button>
                <button
                  onClick={syncGscKeywords}
                  disabled={syncingGsc || analyzing}
                  title="Fetch ALL keywords from Google Search Console and add any missing ones to tracking. Also updates metrics for existing keywords."
                  className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 font-medium text-green-800 hover:bg-green-100 disabled:opacity-50 text-sm"
                >
                  {syncingGsc
                    ? <><Clock className="h-4 w-4 animate-spin" /> Syncing…</>
                    : <><RefreshCw className="h-4 w-4" /> Sync GSC Keywords</>}
                </button>
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
            </div>

            {/* Error banner */}
            {(errorMsg || analysisError) && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{errorMsg || analysisError}</p>
                <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
              </div>
            )}

            {/* Analysis progress bar */}
            {analyzing && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 animate-spin text-blue-600" />
                    <p className="text-sm font-medium text-blue-800">{analysisPhase || 'Starting analysis...'}</p>
                  </div>
                  <span className="text-xs font-mono text-blue-600">{analysisProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-blue-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-700 ease-out"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-blue-600">You can navigate away — the analysis continues in the background.</p>
              </div>
            )}

            {/* Stats Grid */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
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
            <div className="mb-5 flex gap-1 rounded-xl bg-white p-1 border shadow-sm overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-1">
              {[
                { id: 'overview' as const, label: 'Keyword Rankings',  icon: <Search     className="h-4 w-4" /> },
                { id: 'actions'  as const, label: `Optimization Actions${pendingActions.length ? ` (${pendingActions.length})` : ''}`, icon: <Zap  className="h-4 w-4" /> },
                { id: 'serp'     as const, label: 'SERP Analysis',   icon: <Globe      className="h-4 w-4" /> },
                { id: 'vitals'   as const, label: 'Core Web Vitals', icon: <Gauge      className="h-4 w-4" /> },
                { id: 'history'  as const, label: 'Past Audits',     icon: <Clock      className="h-4 w-4" /> },
                { id: 'strategy' as const, label: 'SEO Strategy',    icon: <Target     className="h-4 w-4" /> },
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
                      {keywords.length} keywords from Google Search Console · Position data updated daily at 02:00 UTC
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setKwFilter(f => f === 'quick_wins' ? 'all' : 'quick_wins')}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        kwFilter === 'quick_wins' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'border text-slate-500 hover:bg-slate-50'
                      }`}>
                      <Lightbulb className="h-3.5 w-3.5" />
                      Quick Wins
                      {keywords.filter(k => k.position >= 4 && k.position <= 10 && k.impressions >= 100).length > 0 && (
                        <span className="ml-1 rounded-full bg-amber-200 px-1.5 text-[10px] font-bold text-amber-800">
                          {keywords.filter(k => k.position >= 4 && k.position <= 10 && k.impressions >= 100).length}
                        </span>
                      )}
                    </button>
                    <button onClick={fetchKeywords} className="text-slate-400 hover:text-slate-600 p-1 rounded">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        {['Keyword','Intent','Priority','Position','Trend','Clicks','Impressions','CTR',''].map(h => (
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
                        (kwFilter === 'quick_wins'
                          ? keywords.filter(k => k.position >= 4 && k.position <= 10 && k.impressions >= 100)
                          : keywords
                        ).map(kw => {
                          const trend = getPositionTrend(kw.position_history, kw.position);
                          return (
                            <tr key={kw.keyword} className={`group hover:bg-slate-50 transition-colors ${kwFilter === 'quick_wins' ? 'bg-amber-50/30' : ''}`}>
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
                              <td className="px-3 py-3.5">
                                <button
                                  onClick={() => deleteKeyword(kw.keyword)}
                                  disabled={deletingKw === kw.keyword}
                                  title="Remove keyword"
                                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity disabled:opacity-50"
                                >
                                  {deletingKw === kw.keyword
                                    ? <Clock className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5" />}
                                </button>
                              </td>
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
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900">Optimization Actions</h3>
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
                        title="Sends each action to the SEO agent for execution (e.g. generate meta tags, create content briefs, fix technical issues)"
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-green-400"
                      >
                        <Play className="h-4 w-4" /> Execute All ({pendingActions.length})
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Generated by AI analysis. Each action can be executed individually — the agent will perform the task (write content, update meta tags, etc.).</p>
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
                    <p className="mt-2 text-sm text-slate-500">Click &quot;Run Full Analysis&quot; above. The agent will fetch GSC data, audit your site, and generate specific optimization actions you can review and execute.</p>
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
                                onClick={() => deleteAction(action.id)}
                                disabled={deletingAction === action.id}
                                title="Remove this action"
                                className="rounded-lg p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
                                const r = res || action.execution_result;
                                const isError = !!r.error || r.success === false;

                                // ── Content generated → show PR link ──────────
                                if (r.action_type === 'content_generated') {
                                  const gh = r.github || {};
                                  const pr_ok = gh.success && gh.pr_url;
                                  return (
                                    <div className={`rounded-lg p-3 border space-y-2 ${isError ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                      <p className="text-xs font-semibold text-green-700">✅ Blog post generated</p>
                                      {r.result && (
                                        <div className="text-xs text-slate-600 space-y-0.5">
                                          <p><span className="font-medium">Title:</span> {r.result.title}</p>
                                          <p><span className="font-medium">Words:</span> {r.result.word_count}</p>
                                          <p><span className="font-medium">Slug:</span> /blog/{r.result.slug}</p>
                                          <p className="italic text-slate-500">{r.result.meta_description}</p>
                                        </div>
                                      )}
                                      {pr_ok ? (
                                        <a href={gh.pr_url} target="_blank" rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                                          🔗 Review PR #{gh.pr_number} on GitHub
                                        </a>
                                      ) : (
                                        <p className="text-xs text-orange-600">
                                          ⚠️ GitHub PR failed: {gh.error || 'GITHUB_TOKEN may not be set in Railway'}
                                        </p>
                                      )}
                                    </div>
                                  );
                                }

                                // ── On-page suggestions → structured boxes ──
                                if (r.action_type === 'on_page_suggestions') {
                                  const s = r.suggestions || {};
                                  const raw = s.raw;
                                  return (
                                    <div className="rounded-lg border bg-green-50 border-green-200 p-3 space-y-2">
                                      <p className="text-xs font-semibold text-green-700">✅ On-page optimisation</p>
                                      {raw ? (
                                        <pre className="text-xs text-slate-700 whitespace-pre-wrap">{raw}</pre>
                                      ) : (
                                        <div className="space-y-2">
                                          {s.title_tag && (
                                            <div className="rounded bg-white border p-2">
                                              <p className="text-xs font-medium text-slate-500 mb-0.5">Title tag ({s.title_tag.length} chars)</p>
                                              <p className="text-xs font-mono text-slate-800">{s.title_tag}</p>
                                            </div>
                                          )}
                                          {s.meta_description && (
                                            <div className="rounded bg-white border p-2">
                                              <p className="text-xs font-medium text-slate-500 mb-0.5">Meta description ({s.meta_description.length} chars)</p>
                                              <p className="text-xs font-mono text-slate-800">{s.meta_description}</p>
                                            </div>
                                          )}
                                          {s.h1 && (
                                            <div className="rounded bg-white border p-2">
                                              <p className="text-xs font-medium text-slate-500 mb-0.5">H1</p>
                                              <p className="text-xs font-mono text-slate-800">{s.h1}</p>
                                            </div>
                                          )}
                                          {s.lsi_keywords?.length > 0 && (
                                            <div>
                                              <p className="text-xs font-medium text-slate-500 mb-1">LSI keywords to add</p>
                                              <div className="flex flex-wrap gap-1">
                                                {s.lsi_keywords.map((kw: string, i: number) => (
                                                  <span key={i} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{kw}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {s.internal_links?.length > 0 && (
                                            <div>
                                              <p className="text-xs font-medium text-slate-500 mb-1">Internal links to add</p>
                                              <ul className="space-y-1">
                                                {s.internal_links.map((link: any, i: number) => (
                                                  <li key={i} className="text-xs text-slate-700">
                                                    → <span className="font-medium">&quot;{link.anchor}&quot;</span> → <span className="font-mono text-blue-600">{link.url}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                          {s.quick_wins?.length > 0 && (
                                            <div>
                                              <p className="text-xs font-medium text-slate-500 mb-1">Quick wins</p>
                                              <ul className="space-y-1">
                                                {s.quick_wins.map((win: string, i: number) => (
                                                  <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                                                    <span className="text-green-600 flex-shrink-0">✓</span>{win}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                // ── Technical fix plan → structured steps ───
                                if (r.action_type === 'technical_fix_plan') {
                                  const fp = r.fix_plan || {};
                                  const raw = fp.raw;
                                  const severityColor: Record<string, string> = {
                                    critical: 'bg-red-100 text-red-700',
                                    high: 'bg-orange-100 text-orange-700',
                                    medium: 'bg-yellow-100 text-yellow-700',
                                    low: 'bg-blue-100 text-blue-700'
                                  };
                                  return (
                                    <div className="rounded-lg border bg-green-50 border-green-200 p-3 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-semibold text-green-700">✅ Technical fix plan</p>
                                        {fp.severity && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor[fp.severity] || ''}`}>{fp.severity}</span>}
                                        {fp.estimated_effort && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">⏱ {fp.estimated_effort}</span>}
                                      </div>
                                      {raw ? (
                                        <pre className="text-xs text-slate-700 whitespace-pre-wrap">{raw}</pre>
                                      ) : (
                                        <div className="space-y-2">
                                          {fp.expected_impact && <p className="text-xs text-slate-600 italic">{fp.expected_impact}</p>}
                                          {fp.steps?.length > 0 && (
                                            <div>
                                              <p className="text-xs font-medium text-slate-500 mb-1">Steps</p>
                                              <ol className="space-y-1">
                                                {fp.steps.map((step: string, i: number) => (
                                                  <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                                                    <span className="font-medium text-slate-400 flex-shrink-0">{i + 1}.</span>{step}
                                                  </li>
                                                ))}
                                              </ol>
                                            </div>
                                          )}
                                          {fp.files_to_change?.length > 0 && (
                                            <div>
                                              <p className="text-xs font-medium text-slate-500 mb-1">Files to change</p>
                                              <div className="flex flex-wrap gap-1">
                                                {fp.files_to_change.map((f: string, i: number) => (
                                                  <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">{f}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                // ── Fallback / unknown ───────────────────────
                                const text = typeof r.suggestions === 'string' ? r.suggestions
                                  : typeof r.fix_plan === 'string' ? r.fix_plan
                                  : r.message || r.error;
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
                      <div className="flex items-center justify-between mb-4 gap-3">
                        <h4 className="font-semibold text-slate-900">
                          Competitive Insights — <span className="text-blue-600">"{serpResult.keyword}"</span>
                          <span className="ml-2 text-xs text-slate-400 font-normal">{serpResult.results_analyzed} pages analyzed</span>
                        </h4>
                        {(() => {
                          const kw = serpResult.keyword.toLowerCase();
                          const already = trackedKws.has(kw) || keywords.some(k => k.keyword.toLowerCase() === kw);
                          return already ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-medium px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
                              <CheckCircle className="h-3.5 w-3.5" /> Tracked
                            </span>
                          ) : (
                            <button
                              onClick={() => addKeyword(serpResult.keyword, 'commercial', 'high')}
                              disabled={trackingKw === kw}
                              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                            >
                              {trackingKw === kw ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                              Track this keyword
                            </button>
                          );
                        })()}
                      </div>
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
                            {serpResult.insights.common_topics.map((t, i) => {
                              const kw = t.toLowerCase();
                              const already = trackedKws.has(kw) || keywords.some(k => k.keyword.toLowerCase() === kw);
                              return (
                                <button
                                  key={i}
                                  onClick={() => !already && addKeyword(t)}
                                  disabled={already || trackingKw === kw}
                                  title={already ? 'Already tracked' : `Track "${t}"`}
                                  className={`rounded-full px-3 py-1 text-xs flex items-center gap-1 transition-colors ${
                                    already
                                      ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 cursor-pointer'
                                  }`}
                                >
                                  {already ? <CheckCircle className="h-3 w-3" /> : trackingKw === kw ? <Clock className="h-3 w-3 animate-spin" /> : <span className="font-bold">+</span>}
                                  {t}
                                </button>
                              );
                            })}
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

            {/* ── TAB: Strategy ──────────────────────────────────────────── */}
            {activeTab === 'strategy' && (() => {
              const doneTasks   = strategyTasks.filter(t => t.done).length;
              const totalTasks  = strategyTasks.length;
              const pct         = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
              const CATEGORIES  = [
                { key: 'quick_win', label: '⚡ Quick Wins',        color: 'yellow' },
                { key: 'month1',    label: '📅 Month 1',           color: 'blue'   },
                { key: 'month2',    label: '📅 Month 2',           color: 'purple' },
                { key: 'month3',    label: '📅 Month 3',           color: 'green'  },
                { key: 'technical', label: '🔧 Technical',         color: 'slate'  },
              ] as const;

              return (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900">90-Day SEO Strategy</h3>
                        {strategy && (
                          <p className="text-sm text-blue-700 font-medium mt-0.5">🎯 {strategy.headline}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {strategyCreatedAt && (
                            <span className="text-xs text-slate-400">
                              Generated {new Date(strategyCreatedAt).toLocaleDateString('en-US')}
                            </span>
                          )}
                          {strategyCached && (
                            <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                              ✓ Up to date
                            </span>
                          )}
                          {totalTasks > 0 && (
                            <span className="text-xs text-slate-500">{doneTasks}/{totalTasks} tasks done</span>
                          )}
                        </div>
                        {/* Progress bar */}
                        {totalTasks > 0 && (
                          <div className="mt-2 h-1.5 w-64 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {strategy && (
                          <button
                            onClick={() => fetchStrategy(true)}
                            disabled={strategyLoading}
                            title="Force regenerate even if data hasn't changed"
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                          </button>
                        )}
                        <button
                          onClick={() => fetchStrategy(false)}
                          disabled={strategyLoading}
                          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                        >
                          {strategyLoading
                            ? <><Clock className="h-4 w-4 animate-spin" /> Generating…</>
                            : <><Lightbulb className="h-4 w-4" /> {strategy ? 'Refresh' : 'Generate Strategy'}</>}
                        </button>
                      </div>
                    </div>
                  </div>

                  {!strategy && !strategyLoading && (
                    <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                      <Target className="mx-auto h-10 w-10 text-slate-200 mb-3" />
                      <p className="text-slate-500 text-sm">Click "Generate Strategy" to get a Claude-powered 90-day SEO plan based on your data.</p>
                    </div>
                  )}

                  {strategyLoading && (
                    <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                      <Clock className="mx-auto h-8 w-8 text-slate-300 animate-spin mb-3" />
                      <p className="text-slate-500 text-sm">Analyzing your keyword data and generating strategy…</p>
                    </div>
                  )}

                  {strategy && !strategyLoading && (
                    <>
                      {/* KPI Targets */}
                      {strategy.kpi_targets && (
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Top-10 Keywords Target', value: strategy.kpi_targets.top10_keywords },
                            { label: 'Monthly Clicks Target',  value: strategy.kpi_targets.monthly_clicks?.toLocaleString() },
                            { label: 'Avg Position Target',    value: strategy.kpi_targets.avg_position },
                          ].map(t => (
                            <div key={t.label} className="rounded-xl border bg-white p-4 text-center shadow-sm">
                              <p className="text-2xl font-bold text-slate-900">{t.value ?? '—'}</p>
                              <p className="text-xs text-slate-500 mt-1">{t.label}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Task lists per category */}
                      {CATEGORIES.map(({ key, label }) => {
                        const catTasks = strategyTasks.filter(t => t.category === key);
                        if (!catTasks.length) return null;
                        const catDone = catTasks.filter(t => t.done).length;
                        return (
                          <div key={key} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b bg-slate-50 flex items-center justify-between">
                              <h4 className="font-semibold text-slate-800 text-sm">{label}</h4>
                              <span className="text-xs text-slate-400">{catDone}/{catTasks.length} done</span>
                            </div>
                            <ul className="divide-y">
                              {catTasks.map(task => (
                                <li key={task.id}
                                  className={`flex items-start gap-3 px-5 py-3.5 transition-colors ${task.done ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/50'}`}
                                >
                                  <button
                                    onClick={() => toggleTask(task.id, !task.done)}
                                    disabled={togglingTask === task.id}
                                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                      task.done
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'border-slate-300 hover:border-blue-400'
                                    }`}
                                  >
                                    {task.done && <CheckCircle className="h-3 w-3" />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                      {task.title}
                                    </p>
                                    {task.detail && !task.done && (
                                      <p className="text-xs text-slate-400 mt-0.5">{task.detail}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {task.impact && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${task.impact === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {task.impact}
                                      </span>
                                    )}
                                    {task.timeframe && (
                                      <span className="text-xs text-slate-400">{task.timeframe}</span>
                                    )}
                                    {task.done_at && (
                                      <span className="text-xs text-slate-300">{new Date(task.done_at).toLocaleDateString('en-US')}</span>
                                    )}
                                    <button
                                      onClick={() => deleteTask(task.id)}
                                      disabled={deletingTask === task.id}
                                      title="Remove this task"
                                      className="rounded p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50 ml-1"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}

                      {/* Content Gaps */}
                      {strategy.content_gaps?.length > 0 && (
                        <div className="rounded-xl border bg-white p-5 shadow-sm">
                          <h4 className="font-semibold text-slate-900 mb-3">📝 Content Gaps — Track as Keywords</h4>
                          <div className="flex flex-wrap gap-2">
                            {strategy.content_gaps.map((g, i) => (
                              <button
                                key={i}
                                onClick={() => addKeyword(g)}
                                title={`Track "${g}"`}
                                className={`rounded-full px-3 py-1 text-xs flex items-center gap-1 border transition-colors ${
                                  trackedKws.has(g.toLowerCase()) || keywords.some(k => k.keyword.toLowerCase() === g.toLowerCase())
                                    ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                                }`}
                              >
                                {trackedKws.has(g.toLowerCase()) || keywords.some(k => k.keyword.toLowerCase() === g.toLowerCase())
                                  ? <CheckCircle className="h-3 w-3" />
                                  : <span className="font-bold">+</span>}
                                {g}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

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
