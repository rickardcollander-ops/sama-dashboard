"use client";

import { useState } from "react";
import { Star, MessageSquare, Zap, Clock, Play, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Mail, BarChart3 } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Action {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  review?: any;
  platform?: string;
  competitor?: string;
  reviews?: any[];
  status: string;
}

export default function ReviewsPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'actions' | 'reviews' | 'platforms'>('actions');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setActiveTab('actions');
    try {
      const response = await fetch(`${SAMA_API_URL}/api/reviews/analyze`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        setActions(data.actions || []);
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
      const response = await fetch(`${SAMA_API_URL}/api/reviews/execute`, {
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
    if (t === 'respond') return <MessageSquare className="h-5 w-5 text-blue-600" />;
    if (t === 'request_reviews') return <Mail className="h-5 w-5 text-green-600" />;
    if (t === 'analyze_sentiment') return <BarChart3 className="h-5 w-5 text-purple-600" />;
    if (t === 'competitor_analysis') return <AlertTriangle className="h-5 w-5 text-orange-600" />;
    return <Star className="h-5 w-5 text-slate-600" />;
  };

  const pendingCount = actions.filter(a => a.status === 'pending').length;
  const completedCount = actions.filter(a => a.status === 'completed').length;
  const respondActions = actions.filter(a => a.type === 'respond');
  const reviewsList = analysis?.reviews || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Star className="h-8 w-8 text-yellow-600" />
              <h1 className="text-2xl font-bold text-slate-900">Reviews Agent</h1>
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">← Back to Dashboard</Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Review Management</h2>
            <p className="mt-2 text-slate-600">Analyze reviews → Generate responses → Request reviews → Track</p>
          </div>
          <button onClick={runAnalysis} disabled={analyzing}
            className="flex items-center gap-2 rounded-lg bg-yellow-600 px-6 py-3 font-medium text-white hover:bg-yellow-700 disabled:bg-yellow-400 shadow-lg shadow-yellow-600/20">
            {analyzing ? <><Clock className="h-5 w-5 animate-spin" /> Analyzing...</> : <><Zap className="h-5 w-5" /> Run Review Analysis</>}
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Avg Rating</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{analysis?.summary?.avg_rating || '—'} <span className="text-sm text-slate-400">/ 5</span></p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Reviews</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{analysis?.summary?.total_reviews || 0}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Unresponded</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{analysis?.summary?.unresponded || 0}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pending Actions</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{pendingCount}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 border shadow-sm">
          {[
            { id: 'actions' as const, label: `All Actions (${pendingCount})`, icon: <Zap className="h-4 w-4" /> },
            { id: 'reviews' as const, label: `Reviews (${reviewsList.length})`, icon: <Star className="h-4 w-4" /> },
            { id: 'platforms' as const, label: 'Platforms', icon: <BarChart3 className="h-4 w-4" /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-yellow-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Summary bar */}
        {analysis && (
          <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm">
                <span className="font-medium text-slate-900">{analysis.summary?.total_actions || 0} actions found</span>
                <span className="text-red-600">{respondActions.length} need responses</span>
                <span className="text-green-600">{completedCount} completed</span>
              </div>
              {pendingCount > 0 && (
                <button onClick={executeAll} disabled={executing !== null}
                  className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:bg-yellow-400">
                  <Play className="h-4 w-4" /> Execute All ({pendingCount})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'reviews' ? (
          <div className="space-y-3">
            {reviewsList.length === 0 ? (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Star className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Reviews</h3>
                <p className="mt-2 text-sm text-slate-500">Run analysis to load reviews from database.</p>
              </div>
            ) : reviewsList.map((review: any) => (
              <div key={review.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{review.platform}</span>
                      <div className="flex">{Array.from({ length: review.rating || 0 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-yellow-500 text-yellow-500" />)}</div>
                      {review.responded ?
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Responded</span> :
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Needs Response</span>
                      }
                    </div>
                    <h4 className="font-medium text-slate-900">{review.title}</h4>
                    <p className="text-sm text-slate-600 mt-1">{review.content}</p>
                    <p className="text-xs text-slate-400 mt-1">By {review.author}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'platforms' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {analysis?.summary?.platforms ? Object.entries(analysis.summary.platforms).map(([name, count]: [string, any]) => (
              <div key={name} className="rounded-lg border bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-2">{name}</h3>
                <p className="text-3xl font-bold text-slate-900">{count}</p>
                <p className="text-sm text-slate-500">reviews</p>
              </div>
            )) : (
              <div className="col-span-4 rounded-lg border bg-white p-12 text-center shadow-sm">
                <BarChart3 className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Platform Data</h3>
                <p className="mt-2 text-sm text-slate-500">Run analysis to see platform breakdown.</p>
              </div>
            )}
          </div>
        ) : (
          /* Actions tab */
          actions.length === 0 ? (
            <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
              <Zap className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No Actions Yet</h3>
              <p className="mt-2 text-sm text-slate-500">Click "Run Review Analysis" to find unresponded reviews and generate actions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map((action) => (
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
                            className="flex items-center gap-1 rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 disabled:bg-yellow-400">
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
                        {action.review && (
                          <div className="rounded-lg bg-blue-50 p-3">
                            <p className="text-xs font-medium text-blue-600 mb-1">Review ({action.review.rating}/5 stars)</p>
                            <p className="text-sm text-slate-700 italic">"{action.review.text?.substring(0, 200)}"</p>
                            <p className="text-xs text-slate-500 mt-1">— {action.review.reviewer} on {action.review.platform}</p>
                          </div>
                        )}
                        {executionResults[action.id] && (
                          <div className={`rounded-lg p-3 ${executionResults[action.id].error ? 'bg-red-50' : 'bg-green-50'}`}>
                            <p className="text-xs font-medium mb-1">{executionResults[action.id].error ? 'Error' : 'Result'}</p>
                            {executionResults[action.id].result ? (
                              <div>
                                {executionResults[action.id].result.response && (
                                  <p className="text-sm text-slate-700">{executionResults[action.id].result.response}</p>
                                )}
                                {executionResults[action.id].result.body && (
                                  <div>
                                    <p className="text-xs font-medium text-slate-500 mb-1">Subject: {executionResults[action.id].result.subject}</p>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{executionResults[action.id].result.body}</p>
                                  </div>
                                )}
                                {!executionResults[action.id].result.response && !executionResults[action.id].result.body && (
                                  <pre className="text-xs text-slate-700 whitespace-pre-wrap overflow-auto max-h-48">{JSON.stringify(executionResults[action.id].result, null, 2)}</pre>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-600">{executionResults[action.id].message || executionResults[action.id].error || 'Done'}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
