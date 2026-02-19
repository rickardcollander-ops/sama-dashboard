"use client";

import { useState, useEffect } from "react";
import {
  Bot, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock,
  Play, RefreshCw, ChevronDown, ChevronUp, Zap, Target, BookOpen,
  MessageSquare, ShoppingCart, Wrench, BarChart2, Lightbulb, Eye,
  ArrowRight, Minus
} from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Summary {
  mention_rate: number;
  avg_rank: number | null;
  total_checks: number;
  open_gaps: number;
  top_competitors: { name: string; count: number }[];
  trend: 'up' | 'down' | 'flat';
  last_check_at: string | null;
}

interface AICheck {
  id: string;
  prompt: string;
  category: string;
  mentioned: boolean;
  rank: number | null;
  competitors_mentioned: string[];
  sentiment: string | null;
  ai_response_excerpt: string | null;
  checked_at: string;
}

interface Gap {
  id: string;
  prompt: string;
  category: string;
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
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
};

const actionTypeLabel: Record<string, string> = {
  create_content: 'Create Content',
  optimize_page: 'Optimize Page',
  build_reviews: 'Build Reviews',
  forum_engagement: 'Forum Engagement',
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sv-SE');
};

const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

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

  useEffect(() => {
    fetchAll();
  }, []);

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
      const res = await fetch(`${SAMA_API_URL}/api/ai-visibility/checks?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setChecks(data.checks || []);
      }
    } catch { /* silent */ }
  };

  const fetchGaps = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/ai-visibility/gaps`);
      if (res.ok) {
        const data = await res.json();
        setGaps(data.gaps || []);
      }
    } catch { /* silent */ }
  };

  const runCheck = async () => {
    setRunningCheck(true);
    setCheckStatus('Startar monitoring-körning (~3 min)...');
    try {
      const res = await fetch(`${SAMA_API_URL}/api/ai-visibility/check`, { method: 'POST' });
      if (res.ok) {
        setCheckStatus('Körning startad i bakgrunden. Resultaten uppdateras automatiskt.');
        setTimeout(() => {
          fetchAll();
          setCheckStatus(null);
        }, 180000); // poll after 3 min
      } else {
        setCheckStatus('Misslyckades att starta körning.');
      }
    } catch {
      setCheckStatus('Kunde inte nå backend.');
    } finally {
      setRunningCheck(false);
    }
  };

  const generateRecommendations = async () => {
    setLoadingRecs(true);
    setActiveTab('recommendations');
    try {
      const res = await fetch(`${SAMA_API_URL}/api/ai-visibility/recommendations`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
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

  const mentionRate = summary?.mention_rate ?? 0;
  const avgRank = summary?.avg_rank;
  const openGaps = summary?.open_gaps ?? gaps.filter(g => g.status === 'open').length;
  const topCompetitors = summary?.top_competitors ?? [];

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Översikt', icon: <BarChart2 className="h-4 w-4" /> },
    { id: 'checks', label: 'Checks', icon: <Eye className="h-4 w-4" />, count: checks.length || undefined },
    { id: 'gaps', label: 'Gaps', icon: <AlertCircle className="h-4 w-4" />, count: openGaps || undefined },
    { id: 'recommendations', label: 'GEO-råd', icon: <Lightbulb className="h-4 w-4" />, count: recommendations.length || undefined },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Bot className="h-8 w-8 text-violet-600" />
              <h1 className="text-2xl font-bold text-slate-900">AI Visibility</h1>
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">← Back to Dashboard</Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">AI Visibility Monitor</h2>
            <p className="mt-2 text-slate-600">
              Hur ofta nämner AI-assistenter Successifier? Tracking av omnämnanden, rank och GEO-gaps.
            </p>
            {summary?.last_check_at && (
              <p className="mt-1 text-xs text-slate-400">Senaste check: {fmtDate(summary.last_check_at)}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={generateRecommendations} disabled={loadingRecs}
              className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {loadingRecs ? <Clock className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
              GEO-råd
            </button>
            <button onClick={runCheck} disabled={runningCheck}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 font-medium text-white hover:bg-violet-700 disabled:bg-violet-400 shadow-lg shadow-violet-600/20">
              {runningCheck ? <><Clock className="h-5 w-5 animate-spin" /> Kör...</> : <><Play className="h-5 w-5" /> Kör Monitoring</>}
            </button>
          </div>
        </div>

        {checkStatus && (
          <div className="mb-6 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
            <Clock className="inline h-4 w-4 mr-2" />{checkStatus}
          </div>
        )}

        {/* Stat cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <StatCard
            label="Mention Rate"
            value={loading ? '—' : fmtPct(mentionRate)}
            sub="av 16 prompts"
            trend={summary?.trend}
            valueColor={mentionRate >= 0.5 ? 'text-green-600' : mentionRate >= 0.25 ? 'text-yellow-600' : 'text-red-600'}
          />
          <StatCard
            label="Avg Rank"
            value={loading ? '—' : avgRank ? `#${avgRank.toFixed(1)}` : '—'}
            sub="när vi nämns"
            valueColor="text-blue-600"
          />
          <StatCard
            label="Öppna Gaps"
            value={loading ? '—' : openGaps}
            sub="prompts utan omnämnande"
            valueColor={openGaps > 8 ? 'text-red-600' : openGaps > 4 ? 'text-yellow-600' : 'text-green-600'}
          />
          <StatCard
            label="Totala Checks"
            value={loading ? '—' : summary?.total_checks ?? checks.length}
            sub="monitoring-körningar"
            valueColor="text-violet-600"
          />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 border shadow-sm overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Mention rate breakdown by category */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Omnämnanden per kategori</h3>
              {checks.length === 0 ? (
                <EmptyState icon={<Eye className="h-10 w-10 text-slate-300" />} title="Inga checks ännu" desc="Kör Monitoring för att starta." />
              ) : (
                <CategoryBreakdown checks={checks} />
              )}
            </div>

            {/* Top competitors */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Konkurrenter i AI-svar</h3>
              {topCompetitors.length === 0 ? (
                <p className="text-sm text-slate-400">Kör en monitoring-körning för att se vilka konkurrenter AI nämner.</p>
              ) : (
                <div className="space-y-3">
                  {topCompetitors.slice(0, 8).map(c => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="w-36 truncate text-sm font-medium text-slate-800">{c.name}</span>
                      <div className="flex-1 rounded-full bg-slate-100 h-3 overflow-hidden">
                        <div
                          className="h-3 rounded-full bg-orange-500"
                          style={{ width: `${Math.min(100, (c.count / (topCompetitors[0]?.count || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-bold text-slate-600">{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent checks mini-list */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Senaste checks</h3>
                <button onClick={() => setActiveTab('checks')}
                  className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800">
                  Visa alla <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-2">
                {checks.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                    {categoryIcon(c.category)}
                    <p className="flex-1 text-sm text-slate-700 truncate">{c.prompt}</p>
                    {c.mentioned
                      ? <span className="flex items-center gap-1 text-xs font-medium text-green-700"><CheckCircle className="h-3.5 w-3.5" /> #{c.rank ?? '?'}</span>
                      : <span className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" /> Ej nämnd</span>
                    }
                    <span className="text-xs text-slate-400">{fmtDate(c.checked_at)}</span>
                  </div>
                ))}
                {checks.length === 0 && <p className="text-sm text-slate-400">Inga checks ännu.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── CHECKS TAB ── */}
        {activeTab === 'checks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">{checks.length} monitoring-körningar totalt.</p>
              <button onClick={fetchChecks} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" /> Uppdatera
              </button>
            </div>
            {checks.length === 0
              ? <EmptyState icon={<Eye className="h-10 w-10 text-slate-300" />} title="Inga checks ännu" desc="Kör Monitoring för att starta." />
              : checks.map(check => (
                <CheckCard
                  key={check.id}
                  check={check}
                  expanded={expandedCheck === check.id}
                  onToggle={() => setExpandedCheck(expandedCheck === check.id ? null : check.id)}
                />
              ))
            }
          </div>
        )}

        {/* ── GAPS TAB ── */}
        {activeTab === 'gaps' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {gaps.filter(g => g.status === 'open').length} öppna gaps — prompts där Successifier inte nämns.
              </p>
              <button onClick={fetchGaps} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" /> Uppdatera
              </button>
            </div>
            {gaps.length === 0
              ? <EmptyState icon={<CheckCircle className="h-10 w-10 text-slate-300" />} title="Inga gaps hittade" desc="Kör en monitoring-körning för att identifiera gaps." />
              : gaps.map(gap => (
                <GapCard key={gap.id} gap={gap} onUpdateStatus={updateGapStatus} />
              ))
            }
          </div>
        )}

        {/* ── RECOMMENDATIONS TAB ── */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Claude-genererade GEO-åtgärder baserade på aktuella gaps.</p>
              <button onClick={generateRecommendations} disabled={loadingRecs}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
                {loadingRecs ? <><Clock className="h-4 w-4 animate-spin" /> Genererar...</> : <><Zap className="h-4 w-4" /> Generera nya råd</>}
              </button>
            </div>
            {recommendations.length === 0 && !loadingRecs
              ? <EmptyState icon={<Lightbulb className="h-10 w-10 text-slate-300" />} title="Inga råd ännu" desc='Klicka "Generera nya råd" för att få Claude att analysera dina gaps.' />
              : recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} />
              ))
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
        {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500 mb-1" />}
        {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500 mb-1" />}
        {trend === 'flat' && <Minus className="h-4 w-4 text-slate-400 mb-1" />}
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
            <p className="text-xs text-slate-400 mt-0.5">{mentioned}/{total} nämnd</p>
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
    <div className={`rounded-lg border bg-white shadow-sm transition-all`}>
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {categoryIcon(check.category)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {categoryLabel(check.category)}
                </span>
                {check.mentioned
                  ? <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                      <CheckCircle className="h-3 w-3" /> Nämnd {check.rank ? `#${check.rank}` : ''}
                    </span>
                  : <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                      <AlertCircle className="h-3 w-3" /> Ej nämnd
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
              <p className="text-sm text-slate-700">{check.prompt}</p>
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
          {check.competitors_mentioned.length > 0 && (
            <div className="rounded-lg bg-orange-50 p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">Konkurrenter nämnda</p>
              <div className="flex flex-wrap gap-1">
                {check.competitors_mentioned.map(c => (
                  <span key={c} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800 border border-orange-200">{c}</span>
                ))}
              </div>
            </div>
          )}
          {check.ai_response_excerpt && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">AI-svar (utdrag)</p>
              <p className="text-sm text-slate-700 italic">"{check.ai_response_excerpt}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GapCard({ gap, onUpdateStatus }: { gap: Gap; onUpdateStatus: (id: string, s: Gap['status']) => void }) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${gap.status === 'resolved' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          {categoryIcon(gap.category)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${priorityColors[gap.priority]}`}>
                {gap.priority}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {categoryLabel(gap.category)}
              </span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 border border-violet-200">
                {actionTypeLabel[gap.action_type] ?? gap.action_type}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                gap.status === 'resolved' ? 'bg-green-100 text-green-700 border-green-200' :
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
              className="rounded-lg border px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">
              Påbörja
            </button>
          )}
          {gap.status !== 'resolved' && (
            <button onClick={() => onUpdateStatus(gap.id, 'resolved')}
              className="rounded-lg border px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50">
              Löst
            </button>
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
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${priorityColors[rec.priority]}`}>
              {rec.priority}
            </span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              {actionTypeLabel[rec.action_type] ?? rec.action_type}
            </span>
            {rec.effort && (
              <span className="text-xs text-slate-400">Effort: {rec.effort}</span>
            )}
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
