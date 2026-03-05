"use client";

import { useState, useEffect } from "react";
import {
  Bot, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock,
  Play, RefreshCw, ChevronDown, ChevronUp, Zap, Target, BookOpen,
  MessageSquare, ShoppingCart, Wrench, BarChart2, Lightbulb, Eye,
  ArrowRight, Minus, Trash2
} from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EngineStats {
  total: number;
  mentioned: number;
  rate: number;
}

interface Summary {
  mention_rate: number;
  avg_rank: number | null;
  total_checks: number;
  open_gaps: number;
  top_competitors: { name: string; count: number }[];
  trend: 'up' | 'down' | 'flat';
  last_check_at: string | null;
  engine_stats: Record<string, EngineStats>;
}

interface AICheck {
  id: string;
  prompt: string;
  category: string;
  ai_engine: string;
  mentioned: boolean;
  rank: number | null;
  competitors_mentioned: string[];
  sentiment: string | null;
  ai_response_excerpt: string | null;
  full_response: string | null;
  checked_at: string;
}

interface Gap {
  id: string;
  prompt: string;
  category: string;
  ai_engine?: string;
  priority: 'high' | 'medium' | 'low';
  action_type: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
}

interface Recommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action_type: string;
  effort: string;
}

type TabId = 'overview' | 'checks' | 'gaps' | 'recommendations';

// ── Engine config ──────────────────────────────────────────────────────────────

const ENGINE_COLORS: Record<string, string> = {
  'ChatGPT (GPT-4o)':   'bg-green-100 text-green-800 border-green-200',
  'Claude (Anthropic)': 'bg-orange-100 text-orange-800 border-orange-200',
  'Gemini (Google)':    'bg-blue-100 text-blue-800 border-blue-200',
  'Perplexity AI':      'bg-purple-100 text-purple-800 border-purple-200',
  'Microsoft Copilot':  'bg-cyan-100 text-cyan-800 border-cyan-200',
};

const ENGINE_DOTS: Record<string, string> = {
  'ChatGPT (GPT-4o)':   'bg-green-500',
  'Claude (Anthropic)': 'bg-orange-500',
  'Gemini (Google)':    'bg-blue-500',
  'Perplexity AI':      'bg-purple-500',
  'Microsoft Copilot':  'bg-cyan-500',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const categoryIcon = (cat: string) => {
  if (cat === 'tool_recommendation') return <Wrench className="h-4 w-4 text-blue-600" />;
  if (cat === 'competitor_alternative') return <Target className="h-4 w-4 text-orange-600" />;
  if (cat === 'use_case') return <BookOpen className="h-4 w-4 text-purple-600" />;
  if (cat === 'buying_intent') return <ShoppingCart className="h-4 w-4 text-green-600" />;
  return <MessageSquare className="h-4 w-4 text-slate-500" />;
};

const categoryLabel = (cat: string) => ({
  tool_recommendation: 'Tool Rec.',
  competitor_alternative: 'Competitor Alt.',
  use_case: 'Use Case',
  buying_intent: 'Buying Intent',
}[cat] ?? cat);

const priorityColors: Record<string, string> = {
  high:   'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low:    'bg-blue-100 text-blue-800 border-blue-200',
};

const actionTypeLabel: Record<string, string> = {
  create_content:   'Create Content',
  optimize_page:    'Optimize Page',
  build_reviews:    'Build Reviews',
  forum_engagement: 'Forum Engagement',
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sv-SE');
};

const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

const EngineBadge = ({ engine }: { engine: string }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${ENGINE_COLORS[engine] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${ENGINE_DOTS[engine] ?? 'bg-slate-400'}`} />
    {engine}
  </span>
);

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIVisibilityPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [checks, setChecks] = useState<AICheck[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningCheck, setRunningCheck] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [checkStatus, setCheckStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  const [clearing, setClearing] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSummary(), fetchChecks(), fetchGaps()]);
    setLoading(false);
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/ai-visibility/summary`);
      if (res.ok) setSummary(await res.json());
    } catch { /* silent */ }
  };

  const fetchChecks = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/ai-visibility/checks?limit=100`);
      if (res.ok) { const d = await res.json(); setChecks(d.checks || []); }
    } catch { /* silent */ }
  };

  const fetchGaps = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/ai-visibility/gaps`);
      if (res.ok) { const d = await res.json(); setGaps(d.gaps || []); }
    } catch { /* silent */ }
  };

  const runCheck = async () => {
    setRunningCheck(true);
    setProgress(0);
    setCheckStatus(null);

    const steps = [
      { at: 0,  label: 'Starting monitoring run...' },
      { at: 2,  label: 'ChatGPT (GPT-4o) — tool recommendations...' },
      { at: 10, label: 'ChatGPT (GPT-4o) — competitor alternatives...' },
      { at: 18, label: 'Claude (Anthropic) — tool recommendations...' },
      { at: 26, label: 'Claude (Anthropic) — use cases...' },
      { at: 38, label: 'Gemini (Google) — tool recommendations...' },
      { at: 48, label: 'Gemini (Google) — buying intent...' },
      { at: 58, label: 'Perplexity AI — competitor alternatives...' },
      { at: 70, label: 'Perplexity AI — use cases...' },
      { at: 80, label: 'Microsoft Copilot — buying intent...' },
      { at: 90, label: 'Saving results and identifying gaps...' },
      { at: 97, label: 'Almost done...' },
    ];

    const initialCount = checks.length;
    const EXPECTED_TOTAL = 80; // 5 engines × 16 prompts

    try {
      const res = await fetch(`${SAMA_API_URL}/api/ai-visibility/check`, { method: 'POST' });
      if (!res.ok) {
        setRunningCheck(false);
        setProgress(0);
        setCheckStatus('Failed to start monitoring run.');
        return;
      }

      // Poll for actual progress
      const pollInterval = setInterval(async () => {
        try {
          const r = await fetch(`${SAMA_API_URL}/api/ai-visibility/checks?limit=200`);
          if (r.ok) {
            const d = await r.json();
            const newChecks = d.checks || [];
            const newCount = newChecks.length;
            const completed = Math.max(0, newCount - initialCount);
            const pct = Math.min(97, Math.round((completed / EXPECTED_TOTAL) * 100));
            setProgress(pct);
            const currentStep = [...steps].reverse().find(s => pct >= s.at);
            if (currentStep) setProgressStep(currentStep.label);

            if (completed >= EXPECTED_TOTAL || pct >= 97) {
              clearInterval(pollInterval);
              setProgress(100);
              setProgressStep('Done!');
              await fetchAll();
              setTimeout(() => {
                setRunningCheck(false);
                setProgress(0);
                setProgressStep('');
              }, 2000);
            }
          }
        } catch { /* ignore poll errors */ }
      }, 15_000);

      // Timeout fallback at 20 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (progress < 100) {
          setProgress(100);
          setProgressStep('Done!');
          fetchAll();
          setTimeout(() => {
            setRunningCheck(false);
            setProgress(0);
            setProgressStep('');
          }, 2000);
        }
      }, 1_200_000);

    } catch {
      setRunningCheck(false);
      setProgress(0);
      setCheckStatus('Could not reach backend.');
    }
  };

  const generateRecommendations = async () => {
    setLoadingRecs(true);
    setActiveTab('recommendations');
    try {
      const res = await fetch(`${SAMA_API_URL}/api/ai-visibility/recommendations`, { method: 'POST' });
      if (res.ok) { const d = await res.json(); setRecommendations(d.recommendations || []); }
    } catch { /* silent */ }
    finally { setLoadingRecs(false); }
  };

  const updateGapStatus = async (gapId: string, status: Gap['status']) => {
    try {
      await fetch(`${SAMA_API_URL}/api/ai-visibility/gaps/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gap_id: gapId, status }),
      });
      setGaps(prev => prev.map(g => g.id === gapId ? { ...g, status } : g));
    } catch { /* silent */ }
  };

  const clearData = async () => {
    // Clear all data
    setClearing(true);
    try {
      await fetch(`${SAMA_API_URL}/api/ai-visibility/clear`, { method: 'POST' });
      setSummary(null);
      setChecks([]);
      setGaps([]);
      setRecommendations([]);
    } catch { /* silent */ }
    finally { setClearing(false); }
  };

  const mentionRate = summary?.mention_rate ?? 0;
  const avgRank = summary?.avg_rank;
  const openGaps = summary?.open_gaps ?? gaps.filter(g => g.status === 'open').length;
  const engineStats = summary?.engine_stats ?? {};

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview',        label: 'Overview',    icon: <BarChart2 className="h-4 w-4" /> },
    { id: 'checks',          label: 'Checks',     icon: <Eye className="h-4 w-4" />,         count: checks.length || undefined },
    { id: 'gaps',            label: 'Gaps',       icon: <AlertCircle className="h-4 w-4" />, count: openGaps || undefined },
    { id: 'recommendations', label: 'GEO Advice',    icon: <Lightbulb className="h-4 w-4" />,  count: recommendations.length || undefined },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
<main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">AI Visibility Monitor</h2>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-slate-600">
              How often do ChatGPT, Claude, Gemini, Perplexity and Copilot mention Successifier?
            </p>
            {summary?.last_check_at && (
              <p className="mt-1 text-xs text-slate-400">Last check: {fmtDate(summary.last_check_at)}</p>
            )}
          </div>
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            <button onClick={clearData} disabled={clearing || runningCheck}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40">
              {clearing ? <Clock className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Clear Data
            </button>
            <button onClick={generateRecommendations} disabled={loadingRecs}
              className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {loadingRecs ? <Clock className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
              GEO Advice
            </button>
            <button onClick={runCheck} disabled={runningCheck}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 font-medium text-white hover:bg-violet-700 disabled:bg-violet-400 shadow-lg shadow-violet-600/20">
              {runningCheck
                ? <><Clock className="h-5 w-5 animate-spin" /> Running ({Math.round(progress)}%)</>
                : <><Play className="h-5 w-5" /> Run Monitoring</>
              }
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {runningCheck && (
          <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm font-medium text-violet-800">
                <Clock className="h-4 w-4 animate-spin" />
                {progressStep || 'Starting...'}
              </span>
              <span className="text-sm font-bold text-violet-700">{progress}%</span>
            </div>
            <div className="w-full rounded-full bg-violet-200 h-3 overflow-hidden">
              <div className="h-3 rounded-full bg-violet-600 transition-all duration-1000"
                style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['ChatGPT (GPT-4o)', 'Claude (Anthropic)', 'Gemini (Google)', 'Perplexity AI', 'Microsoft Copilot'].map(e => (
                <EngineBadge key={e} engine={e} />
              ))}
            </div>
            <p className="mt-2 text-xs text-violet-600">5 engines × 16 prompts × ~10 sec/prompt ≈ 13 min total</p>
          </div>
        )}

        {checkStatus && !runningCheck && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="inline h-4 w-4 mr-2" />{checkStatus}
          </div>
        )}

        {/* Stat cards */}
        <div className="mb-6 sm:mb-8 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          <StatCard label="Mention Rate" value={loading ? '—' : fmtPct(mentionRate)} sub="across all engines"
            trend={summary?.trend}
            valueColor={mentionRate >= 0.5 ? 'text-green-600' : mentionRate >= 0.25 ? 'text-yellow-600' : 'text-red-600'} />
          <StatCard label="Avg Rank" value={loading ? '—' : avgRank ? `#${avgRank.toFixed(1)}` : '—'}
            sub="when mentioned" valueColor="text-blue-600" />
          <StatCard label="Open Gaps" value={loading ? '—' : openGaps}
            sub="prompt/engine combos without mention"
            valueColor={openGaps > 20 ? 'text-red-600' : openGaps > 10 ? 'text-yellow-600' : 'text-green-600'} />
          <StatCard label="Total Checks" value={loading ? '—' : summary?.total_checks ?? checks.length}
            sub="prompt × engine runs" valueColor="text-violet-600" />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 border shadow-sm overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {tab.icon}{tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">

            {/* Per-engine mention rate */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Mention Rate per AI Engine</h3>
              {Object.keys(engineStats).length === 0 ? (
                <p className="text-sm text-slate-400">Run Monitoring to see per-engine statistics.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(engineStats)
                    .sort(([, a], [, b]) => b.rate - a.rate)
                    .map(([engine, stats]) => (
                      <div key={engine} className="flex items-center gap-3">
                        <EngineBadge engine={engine} />
                        <div className="flex-1 rounded-full bg-slate-100 h-3 overflow-hidden">
                          <div className={`h-3 rounded-full transition-all ${
                            stats.rate >= 0.5 ? 'bg-green-500' : stats.rate > 0 ? 'bg-yellow-400' : 'bg-red-400'
                          }`} style={{ width: `${stats.rate * 100}%` }} />
                        </div>
                        <span className="w-10 text-right text-sm font-bold text-slate-700">{fmtPct(stats.rate)}</span>
                        <span className="text-xs text-slate-400">{stats.mentioned}/{stats.total}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Category breakdown */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Mentions by Category</h3>
              {checks.length === 0
                ? <EmptyState icon={<Eye className="h-10 w-10 text-slate-300" />} title="No checks yet" desc="Run Monitoring to get started." />
                : <CategoryBreakdown checks={checks} />
              }
            </div>

            {/* Top competitors */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Competitors in AI Responses</h3>
              {(summary?.top_competitors ?? []).length === 0 ? (
                <p className="text-sm text-slate-400">Run a monitoring check to see competitors.</p>
              ) : (
                <div className="space-y-3">
                  {(summary?.top_competitors ?? []).slice(0, 8).map(c => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="w-36 truncate text-sm font-medium text-slate-800">{c.name}</span>
                      <div className="flex-1 rounded-full bg-slate-100 h-3 overflow-hidden">
                        <div className="h-3 rounded-full bg-orange-500"
                          style={{ width: `${Math.min(100, (c.count / ((summary?.top_competitors[0]?.count) || 1)) * 100)}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs font-bold text-slate-600">{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent checks */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Recent Checks</h3>
                <button onClick={() => setActiveTab('checks')}
                  className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-2">
                {checks.slice(0, 6).map(c => (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3 flex-wrap">
                    {categoryIcon(c.category)}
                    <p className="flex-1 text-sm text-slate-700 min-w-0 truncate">{c.prompt}</p>
                    <EngineBadge engine={c.ai_engine} />
                    {c.mentioned
                      ? <span className="flex items-center gap-1 text-xs font-medium text-green-700"><CheckCircle className="h-3.5 w-3.5" /> #{c.rank ?? '?'}</span>
                      : <span className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" /> Not mentioned</span>
                    }
                    <span className="text-xs text-slate-400">{fmtDate(c.checked_at)}</span>
                  </div>
                ))}
                {checks.length === 0 && <p className="text-sm text-slate-400">No checks yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── CHECKS ── */}
        {activeTab === 'checks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">{checks.length} checks. Click to view the full AI response.</p>
              <button onClick={fetchChecks} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
            {checks.length === 0
              ? <EmptyState icon={<Eye className="h-10 w-10 text-slate-300" />} title="No checks yet" desc="Run Monitoring to get started." />
              : checks.map(check => (
                <CheckCard key={check.id} check={check}
                  expanded={expandedCheck === check.id}
                  onToggle={() => setExpandedCheck(expandedCheck === check.id ? null : check.id)} />
              ))
            }
          </div>
        )}

        {/* ── GAPS ── */}
        {activeTab === 'gaps' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {gaps.filter(g => g.status === 'open').length} open gaps — prompt/engine combinations where Successifier is not mentioned.
              </p>
              <button onClick={fetchGaps} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
            {gaps.length === 0
              ? <EmptyState icon={<CheckCircle className="h-10 w-10 text-slate-300" />} title="No gaps found" desc="Run a monitoring check to identify gaps." />
              : gaps.map(gap => <GapCard key={gap.id} gap={gap} onUpdateStatus={updateGapStatus} />)
            }
          </div>
        )}

        {/* ── RECOMMENDATIONS ── */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Claude-generated GEO actions based on current gaps.</p>
              <button onClick={generateRecommendations} disabled={loadingRecs}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
                {loadingRecs ? <><Clock className="h-4 w-4 animate-spin" /> Generating...</> : <><Zap className="h-4 w-4" /> Generate New Advice</>}
              </button>
            </div>
            {recommendations.length === 0 && !loadingRecs
              ? <EmptyState icon={<Lightbulb className="h-10 w-10 text-slate-300" />} title="No advice yet"
                  desc='Click "Generate New Advice" to have Claude analyze your gaps.' />
              : recommendations.map((rec, i) => <RecommendationCard key={i} rec={rec} />)
            }
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, trend, valueColor = 'text-slate-900' }: {
  label: string; value: string | number; sub?: string; trend?: 'up' | 'down' | 'flat'; valueColor?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
        {trend === 'up'   && <TrendingUp   className="h-4 w-4 text-green-500 mb-1" />}
        {trend === 'down' && <TrendingDown  className="h-4 w-4 text-red-500 mb-1" />}
        {trend === 'flat' && <Minus         className="h-4 w-4 text-slate-400 mb-1" />}
      </div>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function CategoryBreakdown({ checks }: { checks: AICheck[] }) {
  const cats = ['tool_recommendation', 'competitor_alternative', 'use_case', 'buying_intent'];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cats.map(cat => {
        const catChecks = checks.filter(c => c.category === cat);
        const mentioned = catChecks.filter(c => c.mentioned).length;
        const total = catChecks.length;
        const rate = total > 0 ? mentioned / total : 0;
        return (
          <div key={cat} className="rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-2">
              {categoryIcon(cat)}
              <span className="text-sm font-medium text-slate-700">{categoryLabel(cat)}</span>
            </div>
            <p className={`text-2xl font-bold ${rate >= 0.5 ? 'text-green-600' : rate > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {total > 0 ? fmtPct(rate) : '—'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{mentioned}/{total} mentioned</p>
            {total > 0 && (
              <div className="mt-2 rounded-full bg-slate-100 h-1.5 overflow-hidden">
                <div className={`h-1.5 rounded-full ${rate >= 0.5 ? 'bg-green-500' : rate > 0 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${rate * 100}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckCard({ check, expanded, onToggle }: { check: AICheck; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {categoryIcon(check.category)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {categoryLabel(check.category)}
                </span>
                <EngineBadge engine={check.ai_engine} />
                {check.mentioned
                  ? <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                      <CheckCircle className="h-3 w-3" /> Mentioned {check.rank ? `#${check.rank}` : ''}
                    </span>
                  : <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                      <AlertCircle className="h-3 w-3" /> Not mentioned
                    </span>
                }
                {check.sentiment && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                    check.sentiment === 'positive' ? 'bg-green-50 text-green-700 border-green-200' :
                    check.sentiment === 'negative' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>{check.sentiment}</span>
                )}
              </div>
              <p className="text-sm text-slate-700 font-medium">{check.prompt}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-slate-400">{fmtDate(check.checked_at)}</span>
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {check.competitors_mentioned?.length > 0 && (
            <div className="rounded-lg bg-orange-50 p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">Competitors Mentioned</p>
              <div className="flex flex-wrap gap-1">
                {check.competitors_mentioned.map(c => (
                  <span key={c} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800 border border-orange-200">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Full AI response */}
          <div className="rounded-lg bg-slate-50 border p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              Full AI response from {check.ai_engine}
            </p>
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
              {check.full_response || check.ai_response_excerpt || '(no response saved)'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GapCard({ gap, onUpdateStatus }: { gap: Gap; onUpdateStatus: (id: string, s: Gap['status']) => void }) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${gap.status === 'resolved' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {categoryIcon(gap.category)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${priorityColors[gap.priority]}`}>{gap.priority}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{categoryLabel(gap.category)}</span>
              {gap.ai_engine && <EngineBadge engine={gap.ai_engine} />}
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 border border-violet-200">
                {actionTypeLabel[gap.action_type] ?? gap.action_type}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                gap.status === 'resolved'    ? 'bg-green-100 text-green-700 border-green-200' :
                gap.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                'bg-slate-100 text-slate-600 border-slate-200'
              }`}>{gap.status}</span>
            </div>
            <p className="text-sm text-slate-700">{gap.prompt}</p>
            <p className="mt-0.5 text-xs text-slate-400">{fmtDate(gap.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {gap.status === 'open' && (
            <button onClick={() => onUpdateStatus(gap.id, 'in_progress')}
              className="rounded-lg border px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">Start</button>
          )}
          {gap.status !== 'resolved' && (
            <button onClick={() => onUpdateStatus(gap.id, 'resolved')}
              className="rounded-lg border px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50">Resolved</button>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 flex-shrink-0 ${
          rec.priority === 'high' ? 'bg-red-100' : rec.priority === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
        }`}>
          <Lightbulb className={`h-5 w-5 ${
            rec.priority === 'high' ? 'text-red-600' : rec.priority === 'medium' ? 'text-yellow-600' : 'text-blue-600'
          }`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-slate-900">{rec.title}</h4>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${priorityColors[rec.priority]}`}>{rec.priority}</span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              {actionTypeLabel[rec.action_type] ?? rec.action_type}
            </span>
            {rec.effort && <span className="text-xs text-slate-400">Effort: {rec.effort}</span>}
          </div>
          <p className="text-sm text-slate-600">{rec.description}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
      <div className="mx-auto w-fit">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{desc}</p>
    </div>
  );
}
