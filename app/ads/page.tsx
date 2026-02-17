"use client";

import { useEffect, useState } from "react";
import { TrendingUp, DollarSign, MousePointerClick, Eye, Zap, Clock, Play, CheckCircle, ChevronDown, ChevronUp, FileText, Target, Ban, PlusCircle, Wrench } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Campaign {
  campaign_id?: string;
  name: string;
  status: string;
  budget?: number;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpa?: number;
  roas?: number;
}

interface Action {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  campaign?: string;
  keyword?: string;
  campaign_type?: string;
  terms?: string[];
  status: string;
}

export default function AdsPage() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState({ totalSpend: 0, totalClicks: 0, totalImpressions: 0, avgCTR: 0 });

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [actions, setActions] = useState<Action[]>([]);

  // Execution state
  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});

  // UI state
  const [activeTab, setActiveTab] = useState<'campaigns' | 'actions' | 'rules'>('campaigns');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch(`${SAMA_API_URL}/api/ads/campaigns`);
      if (response.ok) {
        const data = await response.json();
        let campaignList: Campaign[] = [];
        const raw = data.campaigns;
        if (Array.isArray(raw)) {
          campaignList = raw;
        } else if (raw && typeof raw === 'object') {
          campaignList = Object.entries(raw).map(([key, val]: [string, any], idx) => ({
            name: val?.name || key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            status: 'Configured',
            impressions: 0, clicks: 0, cost: 0, conversions: 0, ctr: 0,
          }));
        }
        setCampaigns(campaignList);
        if (campaignList.length > 0) {
          const totalSpend = campaignList.reduce((s, c) => s + (c.cost || 0), 0);
          const totalClicks = campaignList.reduce((s, c) => s + (c.clicks || 0), 0);
          const totalImpressions = campaignList.reduce((s, c) => s + (c.impressions || 0), 0);
          setStats({
            totalSpend: Math.round(totalSpend * 100) / 100,
            totalClicks,
            totalImpressions,
            avgCTR: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setActiveTab('actions');
    try {
      const response = await fetch(`${SAMA_API_URL}/api/ads/analyze`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        setActions(data.actions || []);
        if (data.campaigns?.length > 0) {
          setCampaigns(data.campaigns);
          const totalSpend = data.campaigns.reduce((s: number, c: any) => s + (c.cost || 0), 0);
          const totalClicks = data.campaigns.reduce((s: number, c: any) => s + (c.clicks || 0), 0);
          const totalImpressions = data.campaigns.reduce((s: number, c: any) => s + (c.impressions || 0), 0);
          setStats({
            totalSpend: Math.round(totalSpend * 100) / 100,
            totalClicks,
            totalImpressions,
            avgCTR: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
          });
        }
      } else {
        alert('Analysis failed. Check backend connection.');
      }
    } catch (error) {
      alert('Error connecting to backend.');
    } finally {
      setAnalyzing(false);
    }
  };

  const executeAction = async (action: Action) => {
    setExecuting(action.id);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/ads/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (response.ok) {
        const result = await response.json();
        setExecutionResults(prev => ({ ...prev, [action.id]: result }));
        setActions(prev => prev.map(a => a.id === action.id ? { ...a, status: 'completed' } : a));
      } else {
        setExecutionResults(prev => ({ ...prev, [action.id]: { error: 'Execution failed' } }));
      }
    } catch (error) {
      setExecutionResults(prev => ({ ...prev, [action.id]: { error: 'Backend not reachable' } }));
    } finally {
      setExecuting(null);
    }
  };

  const executeAll = async () => {
    for (const action of actions.filter(a => a.status === 'pending')) {
      await executeAction(action);
    }
  };

  const getPriorityColor = (p: string) => {
    if (p === 'critical') return 'bg-red-100 text-red-800 border-red-200';
    if (p === 'high') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (p === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getTypeIcon = (t: string) => {
    if (t === 'ad_copy') return <FileText className="h-5 w-5 text-blue-600" />;
    if (t === 'bid_optimization') return <DollarSign className="h-5 w-5 text-green-600" />;
    if (t === 'budget') return <DollarSign className="h-5 w-5 text-red-600" />;
    if (t === 'quality_score') return <Target className="h-5 w-5 text-purple-600" />;
    if (t === 'negative_keywords') return <Ban className="h-5 w-5 text-orange-600" />;
    if (t === 'campaign_creation') return <PlusCircle className="h-5 w-5 text-green-600" />;
    if (t === 'keyword_management') return <Wrench className="h-5 w-5 text-slate-600" />;
    return <Zap className="h-5 w-5 text-slate-600" />;
  };

  const pendingCount = actions.filter(a => a.status === 'pending').length;
  const completedCount = actions.filter(a => a.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-slate-900">Ads Agent</h1>
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Google Ads Performance</h2>
            <p className="mt-2 text-slate-600">Analyze → Optimize → Execute → Track</p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 disabled:bg-green-400 shadow-lg shadow-green-600/20"
          >
            {analyzing ? <><Clock className="h-5 w-5 animate-spin" /> Analyzing...</> : <><Zap className="h-5 w-5" /> Run Full Analysis</>}
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Spend</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">${stats.totalSpend}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Clicks</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalClicks}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Impressions</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalImpressions}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Avg CTR</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.avgCTR}%</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 border shadow-sm">
          {[
            { id: 'campaigns' as const, label: 'Campaigns', icon: <TrendingUp className="h-4 w-4" /> },
            { id: 'actions' as const, label: `Actions${actions.length > 0 ? ` (${pendingCount})` : ''}`, icon: <Zap className="h-4 w-4" /> },
            { id: 'rules' as const, label: 'Optimization Rules', icon: <Target className="h-4 w-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-green-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: Campaigns */}
        {activeTab === 'campaigns' && (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b p-6">
              <h3 className="text-lg font-semibold text-slate-900">Campaigns</h3>
              <p className="mt-1 text-sm text-slate-500">Click "Run Full Analysis" to get actionable optimizations</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Campaign</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Impressions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Clicks</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">CTR</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Conv</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">CPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr><td colSpan={8} className="px-6 py-4 text-center text-sm text-slate-500">Loading...</td></tr>
                  ) : campaigns.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">No campaigns found. Run analysis to discover opportunities.</td></tr>
                  ) : (
                    campaigns.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{c.name}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            c.status === 'ENABLED' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-900">{c.impressions.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">{c.clicks.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">${(c.cost || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">{(c.ctr || 0).toFixed(2)}%</td>
                        <td className="px-6 py-4 text-sm text-slate-900">{(c.conversions || 0).toFixed(0)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">${(c.cpa || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Actions */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            {analysis && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Analysis Summary</h3>
                  {pendingCount > 0 && (
                    <button onClick={executeAll} disabled={executing !== null}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-green-400">
                      <Play className="h-4 w-4" /> Execute All ({pendingCount})
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-2xl font-bold text-slate-900">{analysis.summary?.total_actions || 0}</p>
                    <p className="text-xs text-slate-500">Total Actions</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{analysis.summary?.critical || 0}</p>
                    <p className="text-xs text-red-600">Critical</p>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3 text-center">
                    <p className="text-2xl font-bold text-orange-600">{analysis.summary?.high || 0}</p>
                    <p className="text-xs text-orange-600">High Priority</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                    <p className="text-xs text-green-600">Completed</p>
                  </div>
                </div>
              </div>
            )}

            {actions.length === 0 ? (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Zap className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Actions Yet</h3>
                <p className="mt-2 text-sm text-slate-500">Click "Run Full Analysis" to analyze campaigns and generate optimizations.</p>
              </div>
            ) : (
              actions.map((action) => (
                <div key={action.id} className={`rounded-lg border bg-white shadow-sm transition-all ${action.status === 'completed' ? 'opacity-75' : ''}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {action.status === 'completed' ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" /> : getTypeIcon(action.type)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-900">{action.title}</h4>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>{action.priority}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{action.type.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-sm text-slate-600">{action.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {action.status === 'pending' && (
                          <button onClick={() => executeAction(action)} disabled={executing === action.id}
                            className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:bg-green-400">
                            {executing === action.id ? <><Clock className="h-3 w-3 animate-spin" /> Running...</> : <><Play className="h-3 w-3" /> Execute</>}
                          </button>
                        )}
                        <button onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)} className="rounded p-1 hover:bg-slate-100">
                          {expandedAction === action.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {expandedAction === action.id && (
                      <div className="mt-3 ml-8 space-y-2">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs font-medium text-slate-500 mb-1">Recommended Action</p>
                          <p className="text-sm text-slate-700">{action.action}</p>
                        </div>
                        {action.campaign && <p className="text-xs text-slate-500"><span className="font-medium">Campaign:</span> {action.campaign}</p>}
                        {action.keyword && <p className="text-xs text-slate-500"><span className="font-medium">Keyword:</span> {action.keyword}</p>}
                        {action.terms && action.terms.length > 0 && (
                          <div className="text-xs text-slate-500">
                            <span className="font-medium">Terms to negate:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {action.terms.map((t, i) => <span key={i} className="rounded bg-red-50 px-2 py-0.5 text-red-700">{t}</span>)}
                            </div>
                          </div>
                        )}
                        {executionResults[action.id] && (
                          <div className={`rounded-lg p-3 ${executionResults[action.id].error ? 'bg-red-50' : 'bg-green-50'}`}>
                            <p className="text-xs font-medium mb-1">{executionResults[action.id].error ? 'Error' : 'Result'}</p>
                            {executionResults[action.id].suggestions ? (
                              <pre className="text-xs text-slate-700 whitespace-pre-wrap">{executionResults[action.id].suggestions}</pre>
                            ) : executionResults[action.id].result ? (
                              <pre className="text-xs text-slate-700 whitespace-pre-wrap overflow-auto max-h-48">{JSON.stringify(executionResults[action.id].result, null, 2)}</pre>
                            ) : (
                              <p className="text-xs text-slate-600">{executionResults[action.id].message || executionResults[action.id].error || 'Done'}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Optimization Rules */}
        {activeTab === 'rules' && (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b p-6">
              <h3 className="text-lg font-semibold text-slate-900">Optimization Rules</h3>
              <p className="mt-1 text-sm text-slate-500">Automated rules that the Ads Agent applies during analysis</p>
            </div>
            <div className="divide-y">
              {[
                { name: 'Pause Underperformers', condition: 'CTR < 0.5% after 500 impressions', action: 'Pause keyword or ad', schedule: 'Daily' },
                { name: 'Scale Winners', condition: 'CPA < target by 20%+, ROAS > 300%', action: 'Increase bid by 15%', schedule: 'Daily' },
                { name: 'Quality Score Fix', condition: 'QS < 5 on any keyword', action: 'Rewrite ad copy, review landing page', schedule: 'Weekly' },
                { name: 'Budget Reallocation', condition: 'Campaign spend < 70% of budget', action: 'Shift budget to top performer', schedule: 'Weekly' },
                { name: 'Negative Keyword Harvest', condition: 'Search term CTR < 0.3%, 0 conversions', action: 'Add to negative keyword list', schedule: 'Daily' },
              ].map((rule, i) => (
                <div key={i} className="p-4 flex items-center gap-4">
                  <Target className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900">{rule.name}</h4>
                    <p className="text-sm text-slate-600">If: {rule.condition}</p>
                    <p className="text-sm text-slate-600">Then: {rule.action}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{rule.schedule}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
