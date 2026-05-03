"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target, Users, TrendingUp, Zap, BarChart3, RefreshCw,
  ChevronRight, ArrowUp, ArrowDown, Minus, Clock,
  Crosshair, Megaphone, GitBranch, CheckCircle, AlertTriangle,
  DollarSign, UserCheck
} from "lucide-react";

const _RAW_SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || '';
const SAMA_API_URL = /^https?:\/\//.test(_RAW_SAMA_API) ? _RAW_SAMA_API : '/api/sama';

type Tab = 'overview' | 'icp' | 'strategy' | 'signals' | 'pipeline';

interface DashboardData {
  icp: Record<string, unknown> | null;
  strategy: Record<string, unknown> | null;
  pipeline: Record<string, unknown>;
  marketing_summary: {
    top_keywords_count: number;
    top_content_count: number;
    has_daily_metrics: boolean;
  };
}

export default function GTMPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [icpResult, setIcpResult] = useState<Record<string, unknown> | null>(null);
  const [strategyResult, setStrategyResult] = useState<Record<string, unknown> | null>(null);
  const [signalsResult, setSignalsResult] = useState<Record<string, unknown> | null>(null);
  const [reviewResult, setReviewResult] = useState<Record<string, unknown> | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/gtm/dashboard`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data.dashboard);
        if (data.dashboard?.icp) setIcpResult(data.dashboard.icp);
        if (data.dashboard?.strategy) setStrategyResult(data.dashboard.strategy);
      }
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const runAction = async (action: string) => {
    setRunning(action);
    try {
      const endpointMap: Record<string, { url: string; method: string }> = {
        icp: { url: '/api/gtm/icp/analyze', method: 'POST' },
        strategy: { url: '/api/gtm/strategy/generate', method: 'POST' },
        signals: { url: '/api/gtm/signals/generate', method: 'POST' },
        review: { url: '/api/gtm/review', method: 'POST' },
      };
      const ep = endpointMap[action];
      if (!ep) return;

      const res = await fetch(`${SAMA_API_URL}${ep.url}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: action === 'strategy' ? JSON.stringify({ focus: 'full' }) : undefined,
      });

      if (res.ok) {
        const data = await res.json();
        if (action === 'icp') setIcpResult(data.analysis);
        if (action === 'strategy') setStrategyResult(data.strategy);
        if (action === 'signals') setSignalsResult(data.signals);
        if (action === 'review') setReviewResult(data.review);
        // Refresh dashboard
        fetchDashboard();
      }
    } catch {
      // handle error
    } finally {
      setRunning(null);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'icp', label: 'ICP', icon: Crosshair },
    { id: 'strategy', label: 'Strategy', icon: Megaphone },
    { id: 'signals', label: 'Signals', icon: Zap },
    { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Target className="h-6 w-6 text-indigo-600" />
              GTM Strategy
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Go-to-market intelligence connecting SAMA + Growth Hub CRM
            </p>
          </div>
          <button
            onClick={() => fetchDashboard()}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          dashboard={dashboard}
          loading={loading}
          running={running}
          onRun={runAction}
          reviewResult={reviewResult}
        />
      )}
      {activeTab === 'icp' && (
        <ICPTab
          icp={icpResult}
          running={running}
          onRun={() => runAction('icp')}
        />
      )}
      {activeTab === 'strategy' && (
        <StrategyTab
          strategy={strategyResult}
          running={running}
          onRun={() => runAction('strategy')}
        />
      )}
      {activeTab === 'signals' && (
        <SignalsTab
          signals={signalsResult}
          running={running}
          onRun={() => runAction('signals')}
        />
      )}
      {activeTab === 'pipeline' && (
        <PipelineTab
          pipeline={dashboard?.pipeline || {}}
          loading={loading}
        />
      )}
    </div>
  );
}


// ── Overview Tab ────────────────────────────────────────────────────

function OverviewTab({ dashboard, loading, running, onRun, reviewResult }: {
  dashboard: DashboardData | null;
  loading: boolean;
  running: string | null;
  onRun: (action: string) => void;
  reviewResult: Record<string, unknown> | null;
}) {
  const actions = [
    { key: 'icp', label: 'Analyze ICP', desc: 'Refine ideal customer profile from pipeline data', icon: Crosshair, color: 'bg-blue-50 text-blue-600' },
    { key: 'strategy', label: 'Generate Strategy', desc: 'Create GTM strategy with prioritized segments', icon: Megaphone, color: 'bg-purple-50 text-purple-600' },
    { key: 'signals', label: 'Generate Signals', desc: 'Send targeting signals to all agents', icon: Zap, color: 'bg-amber-50 text-amber-600' },
    { key: 'review', label: 'Performance Review', desc: 'Evaluate what\'s working and what to change', icon: BarChart3, color: 'bg-green-50 text-green-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          label="ICP Defined"
          value={dashboard?.icp ? 'Yes' : 'Not yet'}
          icon={Crosshair}
          color={dashboard?.icp ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-50'}
        />
        <StatusCard
          label="Strategy Active"
          value={dashboard?.strategy ? 'Yes' : 'Not yet'}
          icon={Megaphone}
          color={dashboard?.strategy ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-50'}
        />
        <StatusCard
          label="Pipeline Connected"
          value={Object.keys(dashboard?.pipeline || {}).length > 0 ? 'Connected' : 'Offline'}
          icon={GitBranch}
          color={Object.keys(dashboard?.pipeline || {}).length > 0 ? 'text-green-600 bg-green-50' : 'text-red-400 bg-red-50'}
        />
        <StatusCard
          label="Keywords Tracked"
          value={String(dashboard?.marketing_summary?.top_keywords_count || 0)}
          icon={TrendingUp}
          color="text-blue-600 bg-blue-50"
        />
      </div>

      {/* Action Cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {actions.map(action => (
            <button
              key={action.key}
              onClick={() => onRun(action.key)}
              disabled={running !== null}
              className="flex items-start gap-3 rounded-lg border bg-white p-4 text-left hover:border-indigo-200 hover:shadow-sm transition-all disabled:opacity-50"
            >
              <div className={`rounded-lg p-2 ${action.color}`}>
                {running === action.key ? (
                  <Clock className="h-5 w-5 animate-spin" />
                ) : (
                  <action.icon className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{action.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 ml-auto mt-1" />
            </button>
          ))}
        </div>
      </div>

      {/* Performance Review Results */}
      {reviewResult && (
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Latest Performance Review
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <HealthBadge health={(reviewResult as { overall_health?: string }).overall_health || 'unknown'} />
            <span className="text-2xl font-bold text-slate-900">
              {(reviewResult as { score?: number }).score ?? '—'}/100
            </span>
          </div>
          <JSONSection title="Working Well" data={(reviewResult as { working_well?: unknown[] }).working_well} />
          <JSONSection title="Needs Improvement" data={(reviewResult as { needs_improvement?: unknown[] }).needs_improvement} />
          <JSONSection title="Next Actions" data={(reviewResult as { next_actions?: unknown[] }).next_actions} />
        </div>
      )}
    </div>
  );
}


// ── ICP Tab ─────────────────────────────────────────────────────────

function ICPTab({ icp, running, onRun }: {
  icp: Record<string, unknown> | null;
  running: string | null;
  onRun: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Ideal Customer Profile</h2>
        <button
          onClick={onRun}
          disabled={running !== null}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
        >
          {running === 'icp' ? <Clock className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {running === 'icp' ? 'Analyzing...' : 'Analyze ICP'}
        </button>
      </div>

      {!icp && (
        <EmptyState
          icon={Crosshair}
          title="No ICP analysis yet"
          desc="Run an ICP analysis to define your ideal customer based on pipeline and marketing data."
        />
      )}

      {icp && (
        <div className="space-y-4">
          {/* Refined ICP */}
          {(icp as { refined_icp?: { primary_segment?: Record<string, unknown> } }).refined_icp?.primary_segment && (
            <div className="rounded-lg border bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Primary Segment</h3>
              <SegmentCard segment={(icp as { refined_icp: { primary_segment: Record<string, unknown> } }).refined_icp.primary_segment} />
            </div>
          )}

          {/* Secondary Segments */}
          {Array.isArray((icp as { refined_icp?: { secondary_segments?: unknown[] } }).refined_icp?.secondary_segments) &&
            ((icp as { refined_icp: { secondary_segments: Record<string, unknown>[] } }).refined_icp.secondary_segments).length > 0 && (
            <div className="rounded-lg border bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Secondary Segments</h3>
              <div className="space-y-3">
                {((icp as { refined_icp: { secondary_segments: Record<string, unknown>[] } }).refined_icp.secondary_segments).map((seg, i) => (
                  <SegmentCard key={i} segment={seg} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <JSONSection title="Recommendations" data={(icp as { recommendations?: unknown[] }).recommendations} />
          <JSONSection title="Insights" data={(icp as { refined_icp?: { insights?: unknown[] } }).refined_icp?.insights} />
          <JSONSection title="Gaps" data={(icp as { refined_icp?: { gaps?: unknown[] } }).refined_icp?.gaps} />
        </div>
      )}
    </div>
  );
}


// ── Strategy Tab ────────────────────────────────────────────────────

function StrategyTab({ strategy, running, onRun }: {
  strategy: Record<string, unknown> | null;
  running: string | null;
  onRun: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">GTM Strategy</h2>
        <button
          onClick={onRun}
          disabled={running !== null}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
        >
          {running === 'strategy' ? <Clock className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
          {running === 'strategy' ? 'Generating...' : 'Generate Strategy'}
        </button>
      </div>

      {!strategy && (
        <EmptyState
          icon={Megaphone}
          title="No strategy generated yet"
          desc="Generate a GTM strategy to get prioritized segments, channels, and messaging."
        />
      )}

      {strategy && (
        <div className="space-y-4">
          {/* Header */}
          {(strategy as { strategy_name?: string }).strategy_name && (
            <div className="rounded-lg border-l-4 border-indigo-500 bg-indigo-50 p-4">
              <h3 className="font-semibold text-indigo-900">{(strategy as { strategy_name: string }).strategy_name}</h3>
              <p className="text-sm text-indigo-700 mt-1">
                Time horizon: {(strategy as { time_horizon?: string }).time_horizon || 'N/A'}
              </p>
            </div>
          )}

          {/* Priority Segments */}
          <JSONSection title="Priority Segments" data={(strategy as { priority_segments?: unknown[] }).priority_segments} />

          {/* Channel Priorities */}
          <JSONSection title="Channel Priorities" data={(strategy as { channel_priorities?: unknown[] }).channel_priorities} />

          {/* Outreach Signals */}
          {(strategy as { outreach_signals?: Record<string, unknown> }).outreach_signals && (
            <div className="rounded-lg border bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Outreach Signals for LinkedIn Agent</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries((strategy as { outreach_signals: Record<string, unknown> }).outreach_signals).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs font-medium text-slate-500 mb-1">{key.replace(/_/g, ' ')}</p>
                    {Array.isArray(val) ? (
                      <div className="flex flex-wrap gap-1">
                        {(val as string[]).map((v, i) => (
                          <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{v}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700">{String(val)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPIs */}
          <JSONSection title="KPIs" data={(strategy as { kpis?: unknown[] }).kpis} />

          {/* Content Themes */}
          {Array.isArray((strategy as { content_themes?: string[] }).content_themes) && (
            <div className="rounded-lg border bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Content Themes</h3>
              <div className="flex flex-wrap gap-2">
                {((strategy as { content_themes: string[] }).content_themes).map((theme, i) => (
                  <span key={i} className="rounded-full bg-purple-50 px-3 py-1 text-sm text-purple-700 font-medium">{theme}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Signals Tab ─────────────────────────────────────────────────────

function SignalsTab({ signals, running, onRun }: {
  signals: Record<string, unknown> | null;
  running: string | null;
  onRun: () => void;
}) {
  const agentColors: Record<string, string> = {
    seo_agent: 'border-blue-400 bg-blue-50',
    content_agent: 'border-purple-400 bg-purple-50',
    ads_agent: 'border-green-400 bg-green-50',
    social_agent: 'border-amber-400 bg-amber-50',
    linkedin_agent: 'border-indigo-400 bg-indigo-50',
  };

  const agentLabels: Record<string, string> = {
    seo_agent: 'SEO Agent',
    content_agent: 'Content Agent',
    ads_agent: 'Ads Agent',
    social_agent: 'Social Agent',
    linkedin_agent: 'LinkedIn Agent',
  };

  const agents = (signals as { agents?: Record<string, unknown> })?.agents || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Agent Signals</h2>
        <button
          onClick={onRun}
          disabled={running !== null}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
        >
          {running === 'signals' ? <Clock className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {running === 'signals' ? 'Generating...' : 'Generate Signals'}
        </button>
      </div>

      {Object.keys(agents).length === 0 && (
        <EmptyState
          icon={Zap}
          title="No signals generated yet"
          desc="Generate signals to send targeting instructions to all agents based on your GTM strategy."
        />
      )}

      {Object.keys(agents).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(agents).map(([agentKey, agentSignals]) => (
            <div
              key={agentKey}
              className={`rounded-lg border-l-4 border bg-white p-5 ${agentColors[agentKey] || 'border-slate-300 bg-slate-50'}`}
            >
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                {agentLabels[agentKey] || agentKey}
              </h3>
              <div className="space-y-2">
                {Object.entries(agentSignals as Record<string, unknown>).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs font-medium text-slate-500 mb-0.5">{key.replace(/_/g, ' ')}</p>
                    {Array.isArray(val) ? (
                      <div className="flex flex-wrap gap-1">
                        {(val as string[]).slice(0, 8).map((v, i) => (
                          <span key={i} className="rounded bg-white px-2 py-0.5 text-xs text-slate-700 border">{v}</span>
                        ))}
                        {(val as string[]).length > 8 && (
                          <span className="text-xs text-slate-400">+{(val as string[]).length - 8} more</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700">{String(val)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Pipeline Tab ────────────────────────────────────────────────────

function PipelineTab({ pipeline, loading }: {
  pipeline: Record<string, unknown>;
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-sm text-slate-500 py-8 text-center">Loading pipeline data...</div>;
  }

  if (Object.keys(pipeline).length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="Pipeline not connected"
        desc="Configure GROWTH_HUB_BRIDGE_API_KEY in SAMA to connect to the Growth Hub CRM pipeline."
      />
    );
  }

  const prospects = pipeline.prospects as { total?: number; byStatus?: Record<string, number> } | undefined;
  const deals = pipeline.deals as { total?: number; byStage?: Record<string, { count: number; value: number }> } | undefined;
  const outreach = pipeline.outreach as { total?: number; byStatus?: Record<string, number> } | undefined;
  const revenue = pipeline.revenue as { totalRevenue?: number; totalMRR?: number } | undefined;

  const hasStructuredData = prospects || deals || revenue;

  const funnelStatusColors: Record<string, string> = {
    new: 'bg-slate-400',
    researched: 'bg-blue-400',
    contacted: 'bg-indigo-400',
    replied: 'bg-violet-500',
    demo_booked: 'bg-purple-500',
    won: 'bg-green-500',
    lost: 'bg-red-400',
  };

  const dealStageColors: Record<string, string> = {
    qualification: 'bg-blue-400',
    discovery: 'bg-indigo-400',
    proposal: 'bg-violet-500',
    negotiation: 'bg-purple-500',
    closed_won: 'bg-green-500',
    closed_lost: 'bg-red-400',
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val}`;
  };

  // Compute stats
  const totalProspects = prospects?.total ?? 0;
  const totalDeals = deals?.total ?? 0;
  const wonCount = deals?.byStage?.closed_won?.count ?? prospects?.byStatus?.won ?? 0;
  const lostCount = deals?.byStage?.closed_lost?.count ?? prospects?.byStatus?.lost ?? 0;
  const winRate = (wonCount + lostCount) > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;
  const pipelineValue = deals?.byStage
    ? Object.values(deals.byStage).reduce((sum, s) => sum + (s.value || 0), 0)
    : 0;

  if (!hasStructuredData) {
    // Fallback: formatted JSON
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Pipeline from Growth Hub</h2>
        <div className="rounded-lg border bg-white p-5">
          <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(pipeline, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Pipeline from Growth Hub</h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg p-1.5 bg-blue-50 text-blue-600"><Users className="h-4 w-4" /></div>
            <span className="text-xs font-medium text-slate-500">Total Prospects</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalProspects}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg p-1.5 bg-indigo-50 text-indigo-600"><GitBranch className="h-4 w-4" /></div>
            <span className="text-xs font-medium text-slate-500">Total Deals</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalDeals}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg p-1.5 bg-green-50 text-green-600"><UserCheck className="h-4 w-4" /></div>
            <span className="text-xs font-medium text-slate-500">Win Rate</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{winRate}%</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg p-1.5 bg-purple-50 text-purple-600"><DollarSign className="h-4 w-4" /></div>
            <span className="text-xs font-medium text-slate-500">Pipeline Value</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{pipelineValue > 0 ? formatCurrency(pipelineValue) : (revenue?.totalRevenue ? formatCurrency(revenue.totalRevenue) : '$0')}</p>
          {revenue?.totalMRR ? <p className="text-xs text-slate-500 mt-0.5">MRR: {formatCurrency(revenue.totalMRR)}</p> : null}
        </div>
      </div>

      {/* Prospect Funnel */}
      {prospects?.byStatus && Object.keys(prospects.byStatus).length > 0 && (
        <div className="rounded-lg border bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Prospect Funnel</h3>
          <div className="space-y-3">
            {Object.entries(prospects.byStatus)
              .sort(([a], [b]) => {
                const order = ['new', 'researched', 'contacted', 'replied', 'demo_booked', 'won', 'lost'];
                return order.indexOf(a) - order.indexOf(b);
              })
              .map(([status, count]) => {
                const maxCount = Math.max(...Object.values(prospects.byStatus!));
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500 w-28 text-right capitalize">
                      {status.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 h-7 bg-slate-100 rounded-md overflow-hidden relative">
                      <div
                        className={`h-full rounded-md transition-all ${funnelStatusColors[status] || 'bg-slate-400'}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-900 w-12 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Deal Stages */}
      {deals?.byStage && Object.keys(deals.byStage).length > 0 && (
        <div className="rounded-lg border bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Deal Stages</h3>
          <div className="space-y-3">
            {Object.entries(deals.byStage).map(([stage, data]) => {
              const maxVal = Math.max(...Object.values(deals.byStage!).map(s => s.value || 0));
              const pct = maxVal > 0 ? ((data.value || 0) / maxVal) * 100 : 0;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 w-28 text-right capitalize">
                    {stage.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 h-7 bg-slate-100 rounded-md overflow-hidden">
                    <div
                      className={`h-full rounded-md transition-all ${dealStageColors[stage] || 'bg-slate-400'}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <div className="text-right w-28">
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(data.value || 0)}</span>
                    <span className="text-xs text-slate-500 ml-1">({data.count})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Outreach Stats */}
      {outreach?.byStatus && Object.keys(outreach.byStatus).length > 0 && (
        <div className="rounded-lg border bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Outreach Activity</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(outreach.byStatus).map(([status, count]) => (
              <div key={status} className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{count}</p>
                <p className="text-xs text-slate-500 capitalize">{status.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ── Shared Components ───────────────────────────────────────────────

function StatusCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-slate-500">{label}</p>
          <p className="text-sm sm:text-base font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
      <Icon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{desc}</p>
    </div>
  );
}

function SegmentCard({ segment }: { segment: Record<string, unknown> }) {
  return (
    <div className="rounded border bg-slate-50 p-3 space-y-2">
      {Object.entries(segment).map(([key, val]) => (
        <div key={key} className="flex gap-2">
          <span className="text-xs font-medium text-slate-500 min-w-[120px]">{key.replace(/_/g, ' ')}:</span>
          {Array.isArray(val) ? (
            <div className="flex flex-wrap gap-1">
              {(val as string[]).map((v, i) => (
                <span key={i} className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-700 border">{v}</span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-700">{String(val)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function HealthBadge({ health }: { health: string }) {
  const styles: Record<string, string> = {
    strong: 'bg-green-100 text-green-700',
    good: 'bg-blue-100 text-blue-700',
    needs_attention: 'bg-yellow-100 text-yellow-700',
    critical: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[health] || 'bg-slate-100 text-slate-600'}`}>
      {health.replace(/_/g, ' ')}
    </span>
  );
}

function JSONSection({ title, data }: { title: string; data: unknown }) {
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  return (
    <div className="rounded-lg border bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      {Array.isArray(data) ? (
        <div className="space-y-2">
          {(data as Record<string, unknown>[]).map((item, i) => (
            <div key={i} className="rounded border bg-slate-50 p-3">
              {typeof item === 'object' && item !== null ? (
                Object.entries(item).map(([key, val]) => (
                  <div key={key} className="flex gap-2 py-0.5">
                    <span className="text-xs font-medium text-slate-500 min-w-[100px]">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-xs text-slate-700">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-700">{String(item)}</p>
              )}
            </div>
          ))}
        </div>
      ) : typeof data === 'object' ? (
        <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-slate-700">{String(data)}</p>
      )}
    </div>
  );
}
