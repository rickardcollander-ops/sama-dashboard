"use client";

import { useState, useEffect } from "react";
import {
  Users, MessageCircle, Repeat2, Zap, Clock, Play, ChevronDown, ChevronUp,
  CheckCircle, Calendar, AlertTriangle, Send, Twitter, ExternalLink, FileText,
  TrendingUp, RefreshCw, Sparkles, Trash2
} from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Action {
  id: string;
  db_id?: string;
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
  tweet_url?: string;
  username?: string;
  scheduled_date?: string;
  status: string;
}

interface Draft {
  id: string;
  title: string;
  content_type: string;
  content: string;
  status: string;
  word_count: number;
  created_at: string;
}

interface InterestingTweet {
  id: string;
  text: string;
  created_at: string;
  user: { username: string; followers_count: number; description?: string };
  engagement_score: number;
  tweet_url: string;
}

type TabId = 'actions' | 'interesting' | 'drafts' | 'calendar' | 'mentions';

export default function SocialPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<TabId>('actions');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [interestingTweets, setInterestingTweets] = useState<InterestingTweet[]>([]);
  const [loadingTweets, setLoadingTweets] = useState(false);
  const [dbActions, setDbActions] = useState<Action[]>([]);

  useEffect(() => {
    fetchDrafts();
    fetchDbActions();
  }, []);

  const fetchDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/drafts?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts || []);
      }
    } catch { /* silent */ }
    finally { setLoadingDrafts(false); }
  };

  const fetchDbActions = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/actions?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setDbActions(data.actions || []);
      }
    } catch { /* silent */ }
  };

  const fetchInterestingTweets = async () => {
    setLoadingTweets(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/interesting-tweets`);
      if (res.ok) {
        const data = await res.json();
        setInterestingTweets(data.tweets || []);
      }
    } catch { /* silent */ }
    finally { setLoadingTweets(false); }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setActiveTab('actions');
    try {
      const response = await fetch(`${SAMA_API_URL}/api/social/analyze`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        // Merge db_id from saved actions
        const savedActions = (data.actions || []).map((a: Action, i: number) => ({
          ...a,
          db_id: data.action_ids?.[i]
        }));
        setActions(savedActions);
        if (data.interesting_tweets?.length) {
          setInterestingTweets(data.interesting_tweets);
        }
        await fetchDbActions();
      } else {
        alert('Analysis failed. Check backend connection.');
      }
    } catch {
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
        // Refresh drafts after generation
        if (['generate_post', 'generate_thread'].includes(action.type)) {
          setTimeout(fetchDrafts, 1000);
        }
      } else {
        setExecutionResults(prev => ({ ...prev, [action.id]: { error: 'Execution failed' } }));
      }
    } catch {
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

  const dismissAction = (id: string) => {
    const action = actions.find(a => a.id === id);
    if (action?.db_id) {
      fetch(`${SAMA_API_URL}/api/social/actions/${action.db_id}`, { method: 'DELETE' }).catch(() => {});
    }
    setActions(prev => prev.filter(a => a.id !== id));
  };

  const dismissTweet = (id: string) => {
    setInterestingTweets(prev => prev.filter(t => t.id !== id));
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
    if (t === 'engage_interesting') return <Sparkles className="h-5 w-5 text-violet-600" />;
    if (t === 'config') return <AlertTriangle className="h-5 w-5 text-red-600" />;
    return <Twitter className="h-5 w-5 text-slate-600" />;
  };

  const pendingCount = actions.filter(a => a.status === 'pending').length;
  const completedCount = actions.filter(a => a.status === 'completed').length;
  const calendarActions = actions.filter(a => a.type === 'generate_post');
  const mentionActions = actions.filter(a => a.type === 'reply' || a.type === 'competitor_engage');
  const engageActions = actions.filter(a => a.type === 'engage_interesting');

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'actions', label: 'All Actions', icon: <Zap className="h-4 w-4" />, count: pendingCount || undefined },
    { id: 'interesting', label: 'Interesting Tweets', icon: <Sparkles className="h-4 w-4" />, count: interestingTweets.length || engageActions.length || undefined },
    { id: 'drafts', label: 'Saved Drafts', icon: <FileText className="h-4 w-4" />, count: drafts.length || undefined },
    { id: 'calendar', label: 'Content Calendar', icon: <Calendar className="h-4 w-4" />, count: calendarActions.length || undefined },
    { id: 'mentions', label: 'Mentions & Replies', icon: <MessageCircle className="h-4 w-4" />, count: mentionActions.length || undefined },
  ];

  // DB completed actions count
  const dbCompletedCount = dbActions.filter((a: any) => a.status === 'completed').length;

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
            <p className="mt-2 text-slate-600">Analyze → Discover tweets → Generate content → Engage → Publish</p>
          </div>
          <button onClick={runAnalysis} disabled={analyzing}
            className="flex items-center gap-2 rounded-lg bg-pink-600 px-6 py-3 font-medium text-white hover:bg-pink-700 disabled:bg-pink-400 shadow-lg shadow-pink-600/20">
            {analyzing ? <><Clock className="h-5 w-5 animate-spin" /> Analyzing...</> : <><Zap className="h-5 w-5" /> Run Social Analysis</>}
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pending Actions</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{pendingCount}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Completed</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{completedCount + dbCompletedCount}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Saved Drafts</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{drafts.length}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Tweet Opportunities</p>
            <p className="mt-1 text-2xl font-bold text-violet-600">{interestingTweets.length || engageActions.length}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Twitter API</p>
            <p className="mt-1 text-2xl font-bold">
              {analysis?.summary?.twitter_configured
                ? <span className="text-green-600">Connected</span>
                : <span className="text-red-600">Not Set</span>
              }
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 border shadow-sm overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-pink-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-pink-100 text-pink-700'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Summary bar */}
        {analysis && (
          <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm flex-wrap">
                <span className="font-medium text-slate-900">{analysis.summary?.total_actions || 0} actions generated</span>
                {analysis.actions_saved > 0 && <span className="text-blue-600">{analysis.actions_saved} saved to DB</span>}
                <span className="text-orange-600">{analysis.summary?.competitor_opportunities || 0} competitor opportunities</span>
                <span className="text-violet-600">{analysis.interesting_tweets?.length || 0} interesting tweets found</span>
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

        {/* Tab content */}

        {/* ACTIONS TAB */}
        {activeTab === 'actions' && (
          <ActionsList
            actions={actions}
            executing={executing}
            executionResults={executionResults}
            expandedAction={expandedAction}
            setExpandedAction={setExpandedAction}
            executeAction={executeAction}
            dismissAction={dismissAction}
            getPriorityColor={getPriorityColor}
            getTypeIcon={getTypeIcon}
          />
        )}

        {/* INTERESTING TWEETS TAB */}
        {activeTab === 'interesting' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Tweets about customer success pain points, churn challenges, and CS leadership topics.
                {!analysis?.summary?.twitter_configured && <span className="text-orange-600 ml-2">Configure Twitter API to enable live search.</span>}
              </p>
              <button onClick={fetchInterestingTweets} disabled={loadingTweets}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${loadingTweets ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Engage actions from analysis */}
            {engageActions.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">From last analysis ({engageActions.length} opportunities)</h3>
                <ActionsList
                  actions={engageActions}
                  executing={executing}
                  executionResults={executionResults}
                  expandedAction={expandedAction}
                  setExpandedAction={setExpandedAction}
                  executeAction={executeAction}
                  dismissAction={dismissAction}
                  getPriorityColor={getPriorityColor}
                  getTypeIcon={getTypeIcon}
                />
              </div>
            )}

            {/* Live interesting tweets */}
            {interestingTweets.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Live Tweet Feed ({interestingTweets.length})</h3>
                {interestingTweets.map(tweet => (
                  <div key={tweet.id} className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-slate-900">@{tweet.user.username}</span>
                          <span className="text-xs text-slate-400">{tweet.user.followers_count.toLocaleString()} followers</span>
                          {tweet.engagement_score > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                              <TrendingUp className="h-3 w-3" /> {tweet.engagement_score} engagements
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700">{tweet.text}</p>
                        {tweet.user.description && (
                          <p className="mt-1 text-xs text-slate-400 italic">{tweet.user.description.slice(0, 100)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a href={tweet.tweet_url} target="_blank" rel="noopener noreferrer"
                          className="rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> View
                        </a>
                        <button onClick={() => dismissTweet(tweet.id)}
                          className="rounded-lg border px-2 py-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Sparkles className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Interesting Tweets Loaded</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Run Social Analysis to find customer success pain point tweets automatically, or click Refresh.
                </p>
              </div>
            )}
          </div>
        )}

        {/* DRAFTS TAB */}
        {activeTab === 'drafts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Content generated by the Social Agent, saved as drafts.</p>
              <button onClick={fetchDrafts} disabled={loadingDrafts}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${loadingDrafts ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {drafts.length > 0 ? (
              <div className="space-y-3">
                {drafts.map(draft => (
                  <div key={draft.id} className="rounded-lg border bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                            draft.content_type === 'thread' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                          }`}>
                            {draft.content_type === 'thread' ? '🧵 Thread' : '🐦 Tweet'}
                          </span>
                          <span className="text-xs text-slate-400">{new Date(draft.created_at).toLocaleDateString('sv-SE')}</span>
                          {draft.word_count > 0 && <span className="text-xs text-slate-400">{draft.word_count} words</span>}
                        </div>
                        <h4 className="font-medium text-slate-900 mb-2">{draft.title}</h4>
                        <div className="rounded-lg bg-slate-50 p-3 space-y-2">
                          {draft.content?.split('\n\n').filter(Boolean).map((tweet, i) => (
                            <div key={i} className="rounded bg-white p-2 text-sm text-slate-700 border">
                              {draft.content_type === 'thread' && (
                                <span className="text-xs text-slate-400 font-medium mr-2">{i + 1}.</span>
                              )}
                              {tweet}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <FileText className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Drafts Yet</h3>
                <p className="mt-2 text-sm text-slate-500">Execute "Generate Post" or "Generate Thread" actions to create saved drafts.</p>
              </div>
            )}
          </div>
        )}

        {/* CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <div className="space-y-3">
            {calendarActions.length > 0 ? (
              calendarActions.map(action => (
                <div key={action.id} className={`rounded-lg border bg-white p-4 shadow-sm ${action.status === 'completed' ? 'opacity-75' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {action.status === 'completed' ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Calendar className="h-5 w-5 text-blue-600" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-slate-900">{action.title}</h4>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>{action.priority}</span>
                          {action.is_thread && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Thread</span>}
                        </div>
                        <p className="text-sm text-slate-500">{action.description}</p>
                      </div>
                    </div>
                    {action.status === 'pending' && (
                      <button onClick={() => executeAction(action)} disabled={executing === action.id}
                        className="flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700 disabled:bg-pink-400">
                        {executing === action.id ? <><Clock className="h-3 w-3 animate-spin" /> Generating...</> : <><Play className="h-3 w-3" /> Generate</>}
                      </button>
                    )}
                  </div>
                  {executionResults[action.id]?.result?.tweets && (
                    <div className="mt-3 ml-8 space-y-2">
                      {executionResults[action.id].result.tweets.map((tweet: string, i: number) => (
                        <div key={i} className="rounded bg-slate-50 p-2 text-sm text-slate-700 border">
                          <span className="text-xs text-slate-400 mr-2">{i + 1}.</span>{tweet}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Calendar className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Calendar Posts Yet</h3>
                <p className="mt-2 text-sm text-slate-500">Run Social Analysis to generate your 7-day content calendar.</p>
              </div>
            )}
          </div>
        )}

        {/* MENTIONS TAB */}
        {activeTab === 'mentions' && (
          <div className="space-y-3">
            {mentionActions.length > 0 ? (
              mentionActions.map(action => (
                <div key={action.id} className={`rounded-lg border bg-white p-4 shadow-sm ${action.status === 'completed' ? 'opacity-75' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {action.status === 'completed' ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" /> : getTypeIcon(action.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900">{action.title}</h4>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>{action.priority}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{action.type.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm text-slate-500 italic">"{action.description}"</p>
                        {executionResults[action.id]?.result?.reply && (
                          <div className="mt-2 rounded-lg bg-green-50 p-3">
                            <p className="text-xs font-medium text-green-700 mb-1">Generated Reply</p>
                            <p className="text-sm text-slate-700">{executionResults[action.id].result.reply}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {action.tweet_url && (
                        <a href={action.tweet_url} target="_blank" rel="noopener noreferrer"
                          className="rounded-lg border px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {action.status === 'pending' && (
                        <button onClick={() => executeAction(action)} disabled={executing === action.id}
                          className="flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700 disabled:bg-pink-400">
                          {executing === action.id ? <><Clock className="h-3 w-3 animate-spin" /> Running...</> : <><Play className="h-3 w-3" /> Reply</>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <MessageCircle className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Mentions Found</h3>
                <p className="mt-2 text-sm text-slate-500">Configure Twitter API and run analysis to monitor mentions.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}


// Extracted ActionsList component
function ActionsList({
  actions, executing, executionResults, expandedAction, setExpandedAction, executeAction, dismissAction, getPriorityColor, getTypeIcon
}: {
  actions: Action[];
  executing: string | null;
  executionResults: Record<string, any>;
  expandedAction: string | null;
  setExpandedAction: (id: string | null) => void;
  executeAction: (a: Action) => void;
  dismissAction: (id: string) => void;
  getPriorityColor: (p: string) => string;
  getTypeIcon: (t: string) => React.ReactNode;
}) {
  if (actions.length === 0) {
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
      {actions.map((action) => (
        <div key={action.id} className={`rounded-lg border bg-white shadow-sm transition-all ${action.status === 'completed' ? 'opacity-75' : ''}`}>
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {action.status === 'completed' ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" /> : getTypeIcon(action.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-slate-900">{action.title}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>{action.priority}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{action.type.replace(/_/g, ' ')}</span>
                    {action.scheduled_date && <span className="text-xs text-slate-400">{action.scheduled_date}</span>}
                    {action.status === 'completed' && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Done</span>}
                  </div>
                  <p className="text-sm text-slate-600">{action.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {action.tweet_url && (
                  <a href={action.tweet_url} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg border p-1.5 text-slate-500 hover:bg-slate-50">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {action.status === 'pending' && action.type !== 'config' && (
                  <button onClick={() => executeAction(action)} disabled={executing === action.id}
                    className="flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700 disabled:bg-pink-400">
                    {executing === action.id ? <><Clock className="h-3 w-3 animate-spin" /> Running...</> : <><Play className="h-3 w-3" /> Execute</>}
                  </button>
                )}
                <button onClick={() => dismissAction(action.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                  className="rounded p-1 hover:bg-slate-100">
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
                    {action.tweet_url && (
                      <a href={action.tweet_url} target="_blank" rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <ExternalLink className="h-3 w-3" /> View on Twitter
                      </a>
                    )}
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
                          <pre className="text-xs text-slate-700 whitespace-pre-wrap overflow-auto max-h-48">
                            {JSON.stringify(executionResults[action.id].result, null, 2)}
                          </pre>
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
}
