"use client";

import { useState } from "react";
import { Users, Heart, MessageCircle, Repeat2, Zap, Clock, Play, ChevronDown, ChevronUp, CheckCircle, Calendar, AlertTriangle, Send, Twitter } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Action {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  topic?: string;
  style?: string;
  is_thread?: boolean;
  original_tweet?: string;
  tweet_id?: string;
  username?: string;
  scheduled_date?: string;
  status: string;
}

export default function SocialPage() {
  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [actions, setActions] = useState<Action[]>([]);

  // Execution state
  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});

  // UI state
  const [activeTab, setActiveTab] = useState<'actions' | 'calendar' | 'mentions'>('actions');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setActiveTab('actions');
    try {
      const response = await fetch(`${SAMA_API_URL}/api/social/analyze`, { method: 'POST' });
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
      const response = await fetch(`${SAMA_API_URL}/api/social/execute`, {
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
    if (t === 'generate_post') return <Send className="h-5 w-5 text-blue-600" />;
    if (t === 'generate_thread') return <MessageCircle className="h-5 w-5 text-purple-600" />;
    if (t === 'reply') return <Repeat2 className="h-5 w-5 text-green-600" />;
    if (t === 'competitor_engage') return <AlertTriangle className="h-5 w-5 text-orange-600" />;
    if (t === 'config') return <AlertTriangle className="h-5 w-5 text-red-600" />;
    return <Twitter className="h-5 w-5 text-slate-600" />;
  };

  const pendingCount = actions.filter(a => a.status === 'pending').length;
  const completedCount = actions.filter(a => a.status === 'completed').length;
  const calendarActions = actions.filter(a => a.type === 'generate_post');
  const mentionActions = actions.filter(a => a.type === 'reply' || a.type === 'competitor_engage');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Users className="h-8 w-8 text-pink-600" />
              <h1 className="text-2xl font-bold text-slate-900">Social Agent</h1>
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">← Back to Dashboard</Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Social Strategy</h2>
            <p className="mt-2 text-slate-600">Analyze mentions → Generate posts → Engage → Publish</p>
          </div>
          <button onClick={runAnalysis} disabled={analyzing}
            className="flex items-center gap-2 rounded-lg bg-pink-600 px-6 py-3 font-medium text-white hover:bg-pink-700 disabled:bg-pink-400 shadow-lg shadow-pink-600/20">
            {analyzing ? <><Clock className="h-5 w-5 animate-spin" /> Analyzing...</> : <><Zap className="h-5 w-5" /> Run Social Analysis</>}
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Actions</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{actions.length}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Calendar Posts</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{analysis?.summary?.calendar_posts || 0}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Mentions</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{analysis?.summary?.mentions_found || 0}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Twitter API</p>
            <p className="mt-1 text-2xl font-bold">{analysis?.summary?.twitter_configured ?
              <span className="text-green-600">Connected</span> :
              <span className="text-red-600">Not Set</span>
            }</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 border shadow-sm">
          {[
            { id: 'actions' as const, label: `All Actions${actions.length > 0 ? ` (${pendingCount})` : ''}`, icon: <Zap className="h-4 w-4" /> },
            { id: 'calendar' as const, label: `Content Calendar (${calendarActions.length})`, icon: <Calendar className="h-4 w-4" /> },
            { id: 'mentions' as const, label: `Mentions & Replies (${mentionActions.length})`, icon: <MessageCircle className="h-4 w-4" /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-pink-600 text-white' : 'text-slate-600 hover:bg-slate-100'
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
                <span className="text-orange-600">{analysis.summary?.competitor_opportunities || 0} competitor opportunities</span>
                <span className="text-green-600">{completedCount} completed</span>
              </div>
              {pendingCount > 0 && (
                <button onClick={executeAll} disabled={executing !== null}
                  className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:bg-pink-400">
                  <Play className="h-4 w-4" /> Execute All ({pendingCount})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Render actions based on tab */}
        {(() => {
          const filteredActions = activeTab === 'calendar' ? calendarActions
            : activeTab === 'mentions' ? mentionActions
            : actions;

          if (filteredActions.length === 0) {
            return (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Zap className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Actions Yet</h3>
                <p className="mt-2 text-sm text-slate-500">Click "Run Social Analysis" to generate your content calendar and find engagement opportunities.</p>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {filteredActions.map((action) => (
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
                            {action.scheduled_date && <span className="text-xs text-slate-400">{action.scheduled_date}</span>}
                          </div>
                          <p className="text-sm text-slate-600">{action.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {action.status === 'pending' && action.type !== 'config' && (
                          <button onClick={() => executeAction(action)} disabled={executing === action.id}
                            className="flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700 disabled:bg-pink-400">
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
                        {action.original_tweet && (
                          <div className="rounded-lg bg-blue-50 p-3">
                            <p className="text-xs font-medium text-blue-600 mb-1">Original Tweet</p>
                            <p className="text-sm text-slate-700 italic">"{action.original_tweet}"</p>
                            {action.username && <p className="text-xs text-slate-500 mt-1">— @{action.username}</p>}
                          </div>
                        )}
                        {executionResults[action.id] && (
                          <div className={`rounded-lg p-3 ${executionResults[action.id].error ? 'bg-red-50' : 'bg-green-50'}`}>
                            <p className="text-xs font-medium mb-1">{executionResults[action.id].error ? 'Error' : 'Result'}</p>
                            {executionResults[action.id].result ? (
                              <div>
                                {executionResults[action.id].result.tweets && (
                                  <div className="space-y-2">
                                    {executionResults[action.id].result.tweets.map((tweet: string, i: number) => (
                                      <div key={i} className="rounded bg-white p-2 text-sm text-slate-700 border">
                                        <span className="text-xs text-slate-400 mr-2">{i + 1}.</span>{tweet}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {executionResults[action.id].result.reply && (
                                  <p className="text-sm text-slate-700">{executionResults[action.id].result.reply}</p>
                                )}
                                {!executionResults[action.id].result.tweets && !executionResults[action.id].result.reply && (
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
          );
        })()}
      </main>
    </div>
  );
}
