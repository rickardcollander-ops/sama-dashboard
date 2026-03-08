"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star, MessageSquare, Zap, Clock, Play, ChevronDown, ChevronUp, CheckCircle,
  AlertTriangle, Mail, BarChart3, Trash2, Plus, Upload, XCircle, TrendingUp,
  TrendingDown, Minus, RefreshCw, Shield, ExternalLink
} from "lucide-react";
import Link from "next/link";
import AgentChat from "@/components/AgentChat";
import { useBackgroundAnalysis } from "@/lib/hooks/useBackgroundAnalysis";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

// ── Types ────────────────────────────────────────────────────────────────────

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
  review?: any;
  platform?: string;
  competitor?: string;
  reviews?: any[];
  status: string;
  created_at?: string;
  executed_at?: string;
  execution_result?: any;
  error_message?: string;
}

interface Review {
  id: string;
  platform: string;
  rating: number;
  author: string;
  title: string;
  content: string;
  review_url?: string;
  responded: boolean;
  response_text?: string;
  responded_at?: string;
  created_at: string;
  review_date?: string;
}

interface DashboardStats {
  total_reviews: number;
  avg_rating: number;
  responded: number;
  unresponded: number;
  positive: number;
  neutral: number;
  negative: number;
  sla_violations: number;
  sla_warnings: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const getPriorityColor = (p: string) => {
  if (p === 'critical') return 'bg-red-100 text-red-800 border-red-200';
  if (p === 'high') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (p === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-blue-100 text-blue-800 border-blue-200';
};

const getTypeIcon = (t: string) => {
  if (t === 'respond') return <MessageSquare className="h-5 w-5 text-blue-600" />;
  if (t === 'request_reviews') return <Mail className="h-5 w-5 text-green-600" />;
  if (t === 'analyze_sentiment') return <BarChart3 className="h-5 w-5 text-purple-600" />;
  if (t === 'competitor_analysis') return <AlertTriangle className="h-5 w-5 text-orange-600" />;
  return <Star className="h-5 w-5 text-slate-600" />;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  // Data
  const [reviews, setReviews] = useState<Review[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [platformStats, setPlatformStats] = useState<Record<string, any>>({});
  const [platformTargets, setPlatformTargets] = useState<Record<string, any>>({});
  const [ratingDist, setRatingDist] = useState<Record<string, number>>({});
  const [trend, setTrend] = useState<any>(null);
  const [loadingDash, setLoadingDash] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'reviews' | 'platforms' | 'import'>('overview');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [deletingAction, setDeletingAction] = useState<string | null>(null);
  const [deletingReview, setDeletingReview] = useState<string | null>(null);
  const [draftingResponse, setDraftingResponse] = useState<string | null>(null);
  const [draftedResponses, setDraftedResponses] = useState<Record<string, string>>({});

  // Edit-before-execute
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [editedActionDesc, setEditedActionDesc] = useState('');

  // Import form
  const [importForm, setImportForm] = useState({ platform: 'G2', rating: 5, author: '', title: '', content: '', review_url: '' });
  const [importing, setImporting] = useState(false);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    setLoadingDash(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/reviews/dashboard`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDashStats(data.stats);
          setPlatformStats(data.platform_stats || {});
          setPlatformTargets(data.platform_targets || {});
          setRatingDist(data.rating_distribution || {});
          setTrend(data.trend);
        }
      }
    } catch { /* silent */ }
    finally { setLoadingDash(false); }
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/reviews/recent?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/reviews/actions?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
      }
    } catch { /* silent */ }
  }, []);

  // Load everything on mount
  useEffect(() => {
    fetchDashboard();
    fetchReviews();
    fetchActions();
  }, [fetchDashboard, fetchReviews, fetchActions]);

  // ── Background analysis ─────────────────────────────────────────────────────

  const { startAnalysis: startBgAnalysis, analyzing, phase: analysisPhase, progress: analysisProgress } =
    useBackgroundAnalysis({
      agent: 'reviews',
      onComplete: () => { fetchActions(); fetchDashboard(); fetchReviews(); },
      onError: (err) => setErrorMsg(err),
    });

  const runAnalysis = async () => {
    setErrorMsg(null);
    setActiveTab('actions');
    await startBgAnalysis();
  };

  const executeAction = async (action: Action) => {
    setExecuting(action.id);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/reviews/execute`, {
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

  const deleteAction = async (actionId: string) => {
    setDeletingAction(actionId);
    setActions(prev => prev.filter(a => a.id !== actionId));
    try {
      await fetch(`${SAMA_API_URL}/api/reviews/actions/${actionId}`, { method: 'DELETE' });
    } catch { /* optimistic stays */ }
    finally { setDeletingAction(null); }
  };

  const draftResponse = async (review: Review) => {
    setDraftingResponse(review.id);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/reviews/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `draft-${review.id}`,
          type: 'respond',
          priority: review.rating <= 2 ? 'high' : 'medium',
          title: `Draft response for ${review.author}`,
          description: review.content,
          action: 'generate_response',
          review,
          platform: review.platform,
          status: 'pending',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const draft = data.result?.response || data.suggestions || data.message || 'Response drafted successfully. Check actions tab.';
        setDraftedResponses(prev => ({ ...prev, [review.id]: draft }));
      }
    } catch { /* silent */ }
    finally { setDraftingResponse(null); }
  };

  const deleteReview = async (reviewId: string) => {
    setDeletingReview(reviewId);
    setReviews(prev => prev.filter(r => r.id !== reviewId));
    try {
      await fetch(`${SAMA_API_URL}/api/reviews/reviews/${reviewId}`, { method: 'DELETE' });
      await fetchDashboard();
    } catch { /* optimistic stays */ }
    finally { setDeletingReview(null); }
  };

  const importReview = async () => {
    if (!importForm.content.trim()) return;
    setImporting(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/reviews/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importForm),
      });
      if (res.ok) {
        setImportForm({ platform: 'G2', rating: 5, author: '', title: '', content: '', review_url: '' });
        await fetchReviews();
        await fetchDashboard();
      } else {
        setErrorMsg('Import failed');
      }
    } catch {
      setErrorMsg('Could not reach backend');
    } finally {
      setImporting(false);
    }
  };

  // ── Computed ────────────────────────────────────────────────────────────────

  const pendingActions = actions.filter(a => a.status === 'pending');
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
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Reviews Agent</h2>
                <p className="mt-1 text-slate-500 text-sm">Monitors reviews on G2, Capterra, and Trustpilot. Drafts responses and tracks SLA compliance.</p>
              </div>
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="flex items-center gap-2 rounded-lg bg-yellow-600 px-5 py-2.5 font-medium text-white hover:bg-yellow-700 disabled:bg-yellow-400 shadow-lg shadow-yellow-600/20 text-sm self-start"
              >
                {analyzing
                  ? <><Clock className="h-4 w-4 animate-spin" /> Analyzing…</>
                  : <><Zap className="h-4 w-4" /> Analyze Reviews</>}
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

            {/* Analysis progress bar */}
            {analyzing && (
              <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 animate-spin text-yellow-600" />
                    <p className="text-sm font-medium text-yellow-800">{analysisPhase || 'Starting analysis...'}</p>
                  </div>
                  <span className="text-xs font-mono text-yellow-600">{analysisProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-yellow-100 overflow-hidden">
                  <div className="h-full rounded-full bg-yellow-500 transition-all duration-700 ease-out" style={{ width: `${analysisProgress}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-yellow-700">You can navigate away — the analysis continues in the background.</p>
              </div>
            )}

            {/* Stats Grid */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-5">
              {[
                { label: 'Avg Rating', value: dashStats?.avg_rating ? `${dashStats.avg_rating}` : '—', sub: '/ 5 stars', color: 'text-yellow-600' },
                { label: 'Total Reviews', value: dashStats?.total_reviews ?? 0, sub: 'all platforms', color: 'text-slate-900' },
                { label: 'Unresponded', value: dashStats?.unresponded ?? 0, sub: 'need attention', color: dashStats?.unresponded ? 'text-red-600' : 'text-green-600' },
                { label: 'SLA Violations', value: dashStats?.sla_violations ?? 0, sub: 'overdue responses', color: dashStats?.sla_violations ? 'text-red-600' : 'text-green-600' },
                { label: 'Pending Actions', value: pendingActions.length, sub: 'to execute', color: 'text-blue-600' },
              ].map(card => (
                <div key={card.label} className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                  <p className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Sentiment + Trend row */}
            {dashStats && (
              <div className="mb-6 grid gap-4 md:grid-cols-2">
                {/* Sentiment Distribution */}
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Sentiment Distribution</h4>
                  <div className="flex gap-3">
                    {[
                      { label: 'Positive', value: dashStats.positive, color: 'bg-green-500', textColor: 'text-green-700' },
                      { label: 'Neutral', value: dashStats.neutral, color: 'bg-yellow-500', textColor: 'text-yellow-700' },
                      { label: 'Negative', value: dashStats.negative, color: 'bg-red-500', textColor: 'text-red-700' },
                    ].map(s => (
                      <div key={s.label} className="flex-1 text-center">
                        <p className={`text-2xl font-bold ${s.textColor}`}>{s.value}</p>
                        <p className="text-xs text-slate-500">{s.label}</p>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${s.color}`} style={{ width: `${dashStats.total_reviews ? (s.value / dashStats.total_reviews) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rating Distribution */}
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Rating Distribution</h4>
                  <div className="space-y-1.5">
                    {[5, 4, 3, 2, 1].map(r => {
                      const count = ratingDist[String(r)] || 0;
                      const pct = dashStats.total_reviews ? (count / dashStats.total_reviews) * 100 : 0;
                      return (
                        <div key={r} className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-8">{r} ★</span>
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-yellow-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab nav */}
            <div className="mb-5 flex gap-1 rounded-xl bg-white p-1 border shadow-sm overflow-x-auto">
              {[
                { id: 'overview' as const, label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
                { id: 'actions' as const, label: `Actions${pendingActions.length ? ` (${pendingActions.length})` : ''}`, icon: <Zap className="h-4 w-4" /> },
                { id: 'reviews' as const, label: `Reviews (${reviews.length})`, icon: <Star className="h-4 w-4" /> },
                { id: 'platforms' as const, label: 'Platforms', icon: <Shield className="h-4 w-4" /> },
                { id: 'import' as const, label: 'Import', icon: <Upload className="h-4 w-4" /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-yellow-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* ── TAB: Overview ─────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Trend card */}
                {trend && (
                  <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">30-Day Trend</h4>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        {trend.direction === 'up' ? <TrendingUp className="h-5 w-5 text-green-600" /> :
                         trend.direction === 'down' ? <TrendingDown className="h-5 w-5 text-red-600" /> :
                         <Minus className="h-5 w-5 text-slate-400" />}
                        <span className={`text-lg font-bold ${trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-slate-600'}`}>
                          {trend.recent_avg}/5
                        </span>
                        <span className="text-sm text-slate-500">avg (last 30d)</span>
                      </div>
                      <div className="text-sm text-slate-500">
                        vs <span className="font-medium">{trend.previous_avg}/5</span> previous 30d
                      </div>
                      <div className="text-sm text-slate-500">
                        {trend.recent_count} new reviews
                      </div>
                    </div>
                  </div>
                )}

                {/* SLA Status */}
                {dashStats && (dashStats.sla_violations > 0 || dashStats.sla_warnings > 0) && (
                  <div className={`rounded-xl border p-5 shadow-sm ${dashStats.sla_violations > 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div className="flex items-center gap-3">
                      <Shield className={`h-5 w-5 ${dashStats.sla_violations > 0 ? 'text-red-600' : 'text-yellow-600'}`} />
                      <div>
                        <h4 className={`text-sm font-semibold ${dashStats.sla_violations > 0 ? 'text-red-700' : 'text-yellow-700'}`}>SLA Alert</h4>
                        <p className="text-sm text-slate-600">
                          {dashStats.sla_violations > 0 && <span className="text-red-600 font-medium">{dashStats.sla_violations} violated</span>}
                          {dashStats.sla_violations > 0 && dashStats.sla_warnings > 0 && ' · '}
                          {dashStats.sla_warnings > 0 && <span className="text-yellow-600 font-medium">{dashStats.sla_warnings} at risk</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick stats: unresponded reviews */}
                {reviews.filter(r => !r.responded).length > 0 && (
                  <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-700">Needs Response</h4>
                      <span className="text-xs text-slate-400">{reviews.filter(r => !r.responded).length} reviews</span>
                    </div>
                    <div className="space-y-2">
                      {reviews.filter(r => !r.responded).slice(0, 5).map(r => (
                        <div key={r.id} className="flex items-center gap-3 text-sm">
                          <div className="flex">
                            {Array.from({ length: r.rating }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                            ))}
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.platform}</span>
                          <span className="text-slate-700 truncate flex-1">{r.title || r.content?.substring(0, 60)}</span>
                          <span className="text-xs text-slate-400">{r.author}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!dashStats && !loadingDash && (
                  <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                    <Star className="mx-auto h-12 w-12 text-slate-200" />
                    <h3 className="mt-4 font-semibold text-slate-900">No Review Data Yet</h3>
                    <p className="mt-2 text-sm text-slate-500">Import reviews or run analysis to get started.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Actions ─────────────────────────────────────────────── */}
            {activeTab === 'actions' && (
              <div className="space-y-3">
                {/* Action summary bar */}
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium text-slate-900">{actions.length} actions</span>
                      <label className="flex items-center gap-1.5 text-slate-500 cursor-pointer">
                        <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} className="rounded" />
                        Show completed ({completedActions.length})
                      </label>
                    </div>
                    {pendingActions.length > 0 && (
                      <button
                        onClick={async () => { for (const a of pendingActions) await executeAction(a); }}
                        disabled={executing !== null}
                        className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:bg-yellow-400"
                      >
                        <Play className="h-4 w-4" /> Execute All ({pendingActions.length})
                      </button>
                    )}
                  </div>
                </div>

                {displayedActions.length === 0 ? (
                  <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                    <Zap className="mx-auto h-12 w-12 text-slate-200" />
                    <h3 className="mt-4 font-semibold text-slate-900">No Actions Yet</h3>
                    <p className="mt-2 text-sm text-slate-500">Click &quot;Analyze Reviews&quot; to scan all platforms. The agent will draft responses for unresponded reviews, flag SLA violations, and suggest review request campaigns.</p>
                  </div>
                ) : (
                  displayedActions.map(action => {
                    const aType = action.action_type || action.type || '';
                    const res = executionResults[action.id];
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
                                 action.status === 'failed' ? <XCircle className="h-5 w-5 text-red-500" /> :
                                 getTypeIcon(aType)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h4 className="font-medium text-slate-900 text-sm">{action.title}</h4>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>{action.priority}</span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{aType.replace(/_/g, ' ')}</span>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">{action.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {action.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => { setEditingAction(action); setEditedActionDesc(action.description); }}
                                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                  >
                                    <MessageSquare className="h-3 w-3" /> Edit
                                  </button>
                                  <button
                                    onClick={() => executeAction(action)}
                                    disabled={executing === action.id}
                                    className="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 disabled:bg-yellow-400"
                                  >
                                    {executing === action.id
                                      ? <><Clock className="h-3 w-3 animate-spin" /> Running…</>
                                      : <><Play className="h-3 w-3" /> Execute</>}
                                  </button>
                                </>
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
                              {action.review && (
                                <div className="rounded-lg bg-blue-50 px-3 py-2.5 border border-blue-100">
                                  <p className="text-xs font-medium text-blue-600 mb-1">Review ({action.review.rating}/5 stars)</p>
                                  <p className="text-xs text-slate-700 italic">"{action.review.text?.substring(0, 200)}"</p>
                                  <p className="text-xs text-slate-500 mt-1">— {action.review.reviewer} on {action.review.platform}</p>
                                </div>
                              )}
                              {(res || action.execution_result) && (() => {
                                const r = res || action.execution_result;
                                const isError = !!r.error || r.success === false;
                                return (
                                  <div className={`rounded-lg p-3 border ${isError ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                    <p className={`text-xs font-semibold mb-1.5 ${isError ? 'text-red-700' : 'text-green-700'}`}>
                                      {isError ? '❌ Failed' : '✅ Completed'}
                                    </p>
                                    {r.result?.response && <pre className="text-xs text-slate-700 whitespace-pre-wrap">{r.result.response}</pre>}
                                    {r.result?.body && (
                                      <div>
                                        <p className="text-xs font-medium text-slate-500 mb-1">Subject: {r.result.subject}</p>
                                        <pre className="text-xs text-slate-700 whitespace-pre-wrap">{r.result.body}</pre>
                                      </div>
                                    )}
                                    {r.error && <p className="text-xs text-red-600">{r.error}</p>}
                                    {r.result && !r.result.response && !r.result.body && !r.error && (
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

            {/* ── TAB: Reviews ─────────────────────────────────────────────── */}
            {activeTab === 'reviews' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-900">{reviews.length} Reviews</h3>
                  <button onClick={fetchReviews} className="text-slate-400 hover:text-slate-600 p-1 rounded">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                {reviews.length === 0 ? (
                  <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                    <Star className="mx-auto h-12 w-12 text-slate-200" />
                    <h3 className="mt-4 font-semibold text-slate-900">No Reviews Yet</h3>
                    <p className="mt-2 text-sm text-slate-500">Import reviews manually or scrape from platforms.</p>
                  </div>
                ) : (
                  reviews.map(review => (
                    <div key={review.id} className="rounded-xl border bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{review.platform}</span>
                            <div className="flex">
                              {Array.from({ length: review.rating || 0 }).map((_, i) => (
                                <Star key={i} className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                              ))}
                            </div>
                            {review.responded
                              ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Responded</span>
                              : <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Needs Response</span>
                            }
                            <span className="text-xs text-slate-400">by {review.author}</span>
                          </div>
                          {review.title && <h4 className="font-medium text-slate-900 text-sm">{review.title}</h4>}
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{review.content}</p>
                          {review.response_text && (
                            <div className="mt-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                              <p className="text-xs font-medium text-green-700 mb-0.5">Response:</p>
                              <p className="text-xs text-slate-700">{review.response_text}</p>
                            </div>
                          )}
                          {draftedResponses[review.id] && (
                            <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                              <p className="text-xs font-medium text-blue-700 mb-0.5">AI Draft:</p>
                              <p className="text-xs text-slate-700 whitespace-pre-wrap">{draftedResponses[review.id]}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {!review.responded && !draftedResponses[review.id] && (
                            <button
                              onClick={() => draftResponse(review)}
                              disabled={draftingResponse === review.id}
                              title="AI-draft a response"
                              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 disabled:opacity-50"
                            >
                              {draftingResponse === review.id ? <Clock className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                              Draft
                            </button>
                          )}
                          <button
                            onClick={() => deleteReview(review.id)}
                            disabled={deletingReview === review.id}
                            title="Delete review"
                            className="rounded-lg p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── TAB: Platforms ────────────────────────────────────────────── */}
            {activeTab === 'platforms' && (
              <div className="space-y-4">
                {Object.keys(platformStats).length === 0 && Object.keys(platformTargets).length === 0 ? (
                  <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                    <Shield className="mx-auto h-12 w-12 text-slate-200" />
                    <h3 className="mt-4 font-semibold text-slate-900">No Platform Data</h3>
                    <p className="mt-2 text-sm text-slate-500">Import reviews to see platform breakdown.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(platformTargets).map(([key, target]: [string, any]) => {
                      const stats = platformStats[target.name] || platformStats[key] || { count: 0, avg_rating: 0, responded: 0, unresponded: 0 };
                      const pct = target.target_reviews ? Math.min((stats.count / target.target_reviews) * 100, 100) : 0;
                      return (
                        <div key={key} className="rounded-xl border bg-white p-5 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-slate-900">{target.name}</h4>
                              <span className={`text-xs rounded-full px-2 py-0.5 ${target.priority === 'high' ? 'bg-orange-100 text-orange-700' : target.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                                {target.priority} priority
                              </span>
                            </div>
                            {target.url && (
                              <a href={target.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="text-center">
                              <p className="text-xl font-bold text-slate-900">{stats.count}</p>
                              <p className="text-xs text-slate-500">reviews</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-bold text-yellow-600">{stats.avg_rating || target.current_rating || '—'}</p>
                              <p className="text-xs text-slate-500">avg rating</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-bold text-green-600">{stats.responded}</p>
                              <p className="text-xs text-slate-500">responded</p>
                            </div>
                          </div>
                          {/* Progress to target */}
                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                              <span>{stats.count} / {target.target_reviews} target</span>
                              <span>{Math.round(pct)}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Import ──────────────────────────────────────────────── */}
            {activeTab === 'import' && (
              <div className="space-y-4">
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-4">Import Review</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Platform *</label>
                      <select
                        value={importForm.platform}
                        onChange={e => setImportForm(prev => ({ ...prev, platform: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      >
                        <option>G2</option>
                        <option>Capterra</option>
                        <option>Trustpilot</option>
                        <option>Product Hunt</option>
                        <option>Google</option>
                        <option>App Store</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Rating *</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(r => (
                          <button
                            key={r}
                            onClick={() => setImportForm(prev => ({ ...prev, rating: r }))}
                            className={`p-1.5 rounded ${importForm.rating >= r ? 'text-yellow-500' : 'text-slate-300'}`}
                          >
                            <Star className={`h-6 w-6 ${importForm.rating >= r ? 'fill-yellow-500' : ''}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Author</label>
                      <input
                        type="text"
                        value={importForm.author}
                        onChange={e => setImportForm(prev => ({ ...prev, author: e.target.value }))}
                        placeholder="Reviewer name"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={importForm.title}
                        onChange={e => setImportForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Review title"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Review Content *</label>
                      <textarea
                        value={importForm.content}
                        onChange={e => setImportForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Paste the review text here..."
                        rows={4}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Review URL (optional)</label>
                      <input
                        type="url"
                        value={importForm.review_url}
                        onChange={e => setImportForm(prev => ({ ...prev, review_url: e.target.value }))}
                        placeholder="https://www.g2.com/..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={importReview}
                      disabled={importing || !importForm.content.trim()}
                      className="flex items-center gap-2 rounded-lg bg-yellow-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-yellow-700 disabled:bg-yellow-400"
                    >
                      {importing ? <><Clock className="h-4 w-4 animate-spin" /> Importing…</> : <><Plus className="h-4 w-4" /> Import Review</>}
                    </button>
                  </div>
                </div>

                {/* Batch import info */}
                <div className="rounded-xl border bg-slate-50 p-5 shadow-sm">
                  <h4 className="font-semibold text-slate-700 mb-2">Batch Import (API)</h4>
                  <p className="text-xs text-slate-500 mb-2">POST to <code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/reviews/import/batch</code> with JSON:</p>
                  <pre className="text-xs bg-white rounded-lg p-3 border overflow-auto">{`{
  "reviews": [
    { "platform": "G2", "rating": 5, "author": "John", "title": "Great tool", "content": "..." },
    { "platform": "Capterra", "rating": 4, "author": "Jane", "content": "..." }
  ]
}`}</pre>
                </div>
              </div>
            )}

          </div>{/* end left */}

          {/* ── Right: AgentChat sidebar ───────────────────────────────────── */}
          <div className="hidden lg:block w-[380px] flex-shrink-0">
            <div className="sticky top-[72px]">
              <AgentChat
                agentName="Reviews"
                apiUrl={`${SAMA_API_URL}/api/reviews`}
                placeholder="'analyze reviews' · 'generate response' · 'check SLA' · 'find opportunities'…"
              />
            </div>
          </div>

        </div>
      </main>

      {/* Edit Action Modal */}
      {editingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingAction(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{editingAction.title}</h3>
            <p className="text-xs text-slate-400 mb-4">Edit the response before publishing</p>
            <textarea
              value={editedActionDesc}
              onChange={e => setEditedActionDesc(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingAction(null)} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => {
                  const updated = { ...editingAction, description: editedActionDesc };
                  setActions(prev => prev.map(a => a.id === updated.id ? updated : a));
                  setEditingAction(null);
                  executeAction(updated);
                }}
                className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
              >
                Save & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
