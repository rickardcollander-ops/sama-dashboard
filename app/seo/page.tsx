"use client";

import { useState, useEffect } from "react";
import { ArrowUp, Search, TrendingUp, Zap, FileText, Wrench, CheckCircle, AlertTriangle, Clock, Play, ChevronDown, ChevronUp, Gauge } from "lucide-react";
import Link from "next/link";
import { useSEOData } from "@/lib/hooks/useSEOData";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Action {
  id: string;
  action_id: string;
  type: string;
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
}

export default function SEOPage() {
  const { loading, stats, keywords } = useSEOData();
  
  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [actions, setActions] = useState<Action[]>([]);
  
  // Execution state
  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});
  
  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'vitals' | 'history'>('overview');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  
  // Vitals state
  const [vitals, setVitals] = useState<any>(null);
  const [loadingVitals, setLoadingVitals] = useState(false);
  
  // History state
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch actions from database on mount
  useEffect(() => {
    fetchActions();
  }, []);

  const fetchActions = async () => {
    try {
      const response = await fetch(`${SAMA_API_URL}/api/seo/actions?status=pending`);
      if (response.ok) {
        const data = await response.json();
        const allActions = data.actions || [];
        
        // Deduplicate actions - keep only the latest version of each action_id
        const uniqueActions = allActions.reduce((acc: Action[], current: Action) => {
          const existing = acc.find(a => a.action_id === current.action_id);
          if (!existing) {
            acc.push(current);
          } else if (new Date(current.created_at || 0) > new Date(existing.created_at || 0)) {
            // Replace with newer version
            const index = acc.indexOf(existing);
            acc[index] = current;
          }
          return acc;
        }, []);
        
        setActions(uniqueActions);
      }
    } catch (error) {
      console.error('Failed to fetch actions:', error);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setActiveTab('actions');
    try {
      const response = await fetch(`${SAMA_API_URL}/api/seo/analyze`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        if (data.core_web_vitals) setVitals(data.core_web_vitals);
        // Fetch actions from database instead of using response
        await fetchActions();
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
      const response = await fetch(`${SAMA_API_URL}/api/seo/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (response.ok) {
        const result = await response.json();
        setExecutionResults(prev => ({ ...prev, [action.id]: result }));
        // Refresh actions from database
        await fetchActions();
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
    const pending = actions.filter(a => a.status === 'pending');
    for (const action of pending) {
      await executeAction(action);
    }
  };

  const loadVitals = async () => {
    setLoadingVitals(true);
    setActiveTab('vitals');
    try {
      const response = await fetch(`${SAMA_API_URL}/api/seo/vitals`);
      if (response.ok) {
        const data = await response.json();
        setVitals(data.vitals);
      }
    } catch (error) {
      console.error('Error loading vitals:', error);
    } finally {
      setLoadingVitals(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    setActiveTab('history');
    try {
      const response = await fetch(`${SAMA_API_URL}/api/seo/audits?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setAuditHistory(data.audits || []);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'content': return <FileText className="h-5 w-5 text-blue-600" />;
      case 'technical': return <Wrench className="h-5 w-5 text-red-600" />;
      case 'on_page': return <Search className="h-5 w-5 text-purple-600" />;
      default: return <Zap className="h-5 w-5 text-slate-600" />;
    }
  };

  const getVitalStatus = (metric: string, value: number) => {
    if (metric === 'lcp') return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    if (metric === 'fcp') return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    if (metric === 'cls') return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    if (metric === 'tbt') return value <= 200 ? 'good' : value <= 600 ? 'needs-improvement' : 'poor';
    return 'unknown';
  };

  const getVitalColor = (status: string) => {
    if (status === 'good') return 'text-green-600 bg-green-50';
    if (status === 'needs-improvement') return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const pendingCount = actions.filter(a => a.status === 'pending').length;
  const completedCount = actions.filter(a => a.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Search className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">SEO Agent</h1>
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header with main CTA */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">SEO Performance</h2>
            <p className="mt-2 text-slate-600">Analyze → Recommend → Execute → Track</p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 shadow-lg shadow-blue-600/20"
          >
            {analyzing ? (
              <><Clock className="h-5 w-5 animate-spin" /> Analyzing...</>
            ) : (
              <><Zap className="h-5 w-5" /> Run Full Analysis</>
            )}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Avg Position</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.avgPosition}</p>
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

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 border shadow-sm">
          {[
            { id: 'overview' as const, label: 'Keywords', icon: <Search className="h-4 w-4" /> },
            { id: 'actions' as const, label: `Actions${actions.length > 0 ? ` (${pendingCount})` : ''}`, icon: <Zap className="h-4 w-4" /> },
            { id: 'vitals' as const, label: 'Core Web Vitals', icon: <Gauge className="h-4 w-4" /> },
            { id: 'history' as const, label: 'Audit History', icon: <Clock className="h-4 w-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'vitals' && !vitals) loadVitals();
                if (tab.id === 'history' && auditHistory.length === 0) loadHistory();
              }}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: Keywords Overview */}
        {activeTab === 'overview' && (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b p-6">
              <h3 className="text-lg font-semibold text-slate-900">Tracked Keywords</h3>
              <p className="mt-1 text-sm text-slate-500">Click "Run Full Analysis" to generate action items from this data</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Keyword</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Intent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Clicks</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Impressions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr><td colSpan={7} className="px-6 py-4 text-center text-sm text-slate-500">Loading...</td></tr>
                  ) : keywords.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">No keywords tracked yet. Run analysis to discover opportunities.</td></tr>
                  ) : (
                    keywords.map((kw) => (
                      <tr key={kw.keyword} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{kw.keyword}</td>
                        <td className="px-6 py-4 text-sm">
                          {kw.intent ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              kw.intent === 'commercial' ? 'bg-purple-100 text-purple-700' :
                              kw.intent === 'transactional' ? 'bg-green-100 text-green-700' :
                              kw.intent === 'informational' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>{kw.intent}</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {kw.priority ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              kw.priority === 'critical' ? 'bg-red-100 text-red-700' :
                              kw.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                              kw.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>{kw.priority}</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center gap-1 font-medium ${kw.position <= 3 ? 'text-green-600' : kw.position <= 10 ? 'text-blue-600' : 'text-slate-900'}`}>
                            {kw.position > 0 ? kw.position.toFixed(1) : '—'}
                            {kw.position > 0 && kw.position <= 3 && <ArrowUp className="h-4 w-4" />}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-900">{kw.clicks}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">{kw.impressions}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">{kw.ctr.toFixed(1)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Action Items */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            {/* Analysis Summary */}
            {analysis && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Analysis Summary</h3>
                  {pendingCount > 0 && (
                    <button
                      onClick={executeAll}
                      disabled={executing !== null}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-green-400"
                    >
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

            {/* Action Items List */}
            {actions.length === 0 ? (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Zap className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Actions Yet</h3>
                <p className="mt-2 text-sm text-slate-500">Click "Run Full Analysis" to scan your site and generate actionable recommendations.</p>
              </div>
            ) : (
              actions.map((action) => (
                <div
                  key={action.id}
                  className={`rounded-lg border bg-white shadow-sm transition-all ${action.status === 'completed' ? 'opacity-75' : ''}`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {action.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                          getTypeIcon(action.type)
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-900">{action.title}</h4>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>
                              {action.priority}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              {action.type}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">{action.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {action.status === 'pending' && (
                          <button
                            onClick={() => executeAction(action)}
                            disabled={executing === action.id}
                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                          >
                            {executing === action.id ? (
                              <><Clock className="h-3 w-3 animate-spin" /> Running...</>
                            ) : (
                              <><Play className="h-3 w-3" /> Execute</>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                          className="rounded p-1 hover:bg-slate-100"
                        >
                          {expandedAction === action.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expandedAction === action.id && (
                      <div className="mt-3 ml-8 space-y-2">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs font-medium text-slate-500 mb-1">Recommended Action</p>
                          <p className="text-sm text-slate-700">{action.action}</p>
                        </div>
                        {action.keyword && (
                          <div className="text-xs text-slate-500">
                            <span className="font-medium">Target Keyword:</span> {action.keyword}
                            {action.target_page && <> | <span className="font-medium">Page:</span> {action.target_page}</>}
                          </div>
                        )}
                        {executionResults[action.id] && (
                          <div className={`rounded-lg p-3 ${executionResults[action.id].error ? 'bg-red-50' : 'bg-green-50'}`}>
                            <p className="text-xs font-medium mb-1 ${executionResults[action.id].error ? 'text-red-700' : 'text-green-700'}">
                              {executionResults[action.id].error ? 'Error' : 'Execution Result'}
                            </p>
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

        {/* TAB: Core Web Vitals */}
        {activeTab === 'vitals' && (
          <div className="space-y-4">
            {loadingVitals ? (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <p className="text-slate-500">Checking Core Web Vitals via PageSpeed Insights API...</p>
              </div>
            ) : vitals ? (
              <>
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Core Web Vitals</h3>
                      <p className="text-sm text-slate-500">Real data from Google PageSpeed Insights API</p>
                    </div>
                    <button onClick={loadVitals} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Refresh</button>
                  </div>

                  {vitals.error ? (
                    <p className="text-slate-500">{vitals.error}</p>
                  ) : (
                    <>
                      {/* Performance Score */}
                      <div className="mb-6 text-center">
                        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 ${
                          (vitals.performance_score || 0) >= 90 ? 'border-green-500' : (vitals.performance_score || 0) >= 50 ? 'border-yellow-500' : 'border-red-500'
                        }`}>
                          <span className="text-3xl font-bold">{vitals.performance_score || 0}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">Performance Score</p>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {[
                          { key: 'lcp', label: 'LCP', value: vitals.lcp, unit: 'ms', target: '< 2500ms' },
                          { key: 'fcp', label: 'FCP', value: vitals.fcp, unit: 'ms', target: '< 1800ms' },
                          { key: 'cls', label: 'CLS', value: vitals.cls, unit: '', target: '< 0.1' },
                          { key: 'tbt', label: 'TBT', value: vitals.tbt, unit: 'ms', target: '< 200ms' },
                        ].map(metric => {
                          const status = getVitalStatus(metric.key, metric.value || 0);
                          return (
                            <div key={metric.key} className={`rounded-lg p-4 ${getVitalColor(status)}`}>
                              <p className="text-xs font-medium opacity-75">{metric.label}</p>
                              <p className="text-2xl font-bold">{metric.value || 0}{metric.unit}</p>
                              <p className="text-xs opacity-75">Target: {metric.target}</p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Gauge className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Vitals Data</h3>
                <p className="mt-2 text-sm text-slate-500">Loading Core Web Vitals...</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: Audit History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {loadingHistory ? (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <p className="text-slate-500">Loading audit history...</p>
              </div>
            ) : auditHistory.length === 0 ? (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Clock className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Audits Yet</h3>
                <p className="mt-2 text-sm text-slate-500">Run your first SEO audit to start tracking progress.</p>
              </div>
            ) : (
              auditHistory.map((audit, idx) => (
                <div key={idx} className="rounded-lg border bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-slate-900">
                      Audit - {new Date(audit.audit_date).toLocaleDateString()}
                    </h4>
                    <span className="text-xs text-slate-500">{new Date(audit.audit_date).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{audit.summary}</p>
                  <div className="flex gap-4 text-sm">
                    {audit.critical_issues && (
                      <span className="text-red-600">{Array.isArray(audit.critical_issues) ? audit.critical_issues.length : 0} critical</span>
                    )}
                    {audit.high_issues && (
                      <span className="text-orange-600">{Array.isArray(audit.high_issues) ? audit.high_issues.length : 0} high</span>
                    )}
                    {audit.medium_issues && (
                      <span className="text-yellow-600">{Array.isArray(audit.medium_issues) ? audit.medium_issues.length : 0} medium</span>
                    )}
                    {audit.lcp_score && <span className="text-slate-500">LCP: {audit.lcp_score}ms</span>}
                  </div>
                  {audit.recommendations && Array.isArray(audit.recommendations) && audit.recommendations.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50">
                      <p className="text-xs font-medium text-slate-500 mb-1">AI Recommendations</p>
                      <ul className="text-xs text-slate-600 space-y-1">
                        {audit.recommendations.slice(0, 5).map((rec: string, i: number) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
