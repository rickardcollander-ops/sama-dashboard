"use client";

import { useEffect, useState } from "react";
import { FileText, TrendingUp, Calendar, CheckCircle, Zap, Clock, Play, ChevronDown, ChevronUp, PenTool, BarChart3, BookOpen } from "lucide-react";
import Link from "next/link";
import AgentChat from "@/components/AgentChat";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface ContentPiece {
  id: string;
  title: string;
  type: string;
  status: string;
  word_count: number;
  target_keyword: string;
  created_at?: string;
}

interface Action {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  keyword?: string;
  content_id?: string;
  competitor?: string;
  pillar?: string;
  status: string;
}

export default function ContentPage() {
  const [loading, setLoading] = useState(true);
  const [contentPieces, setContentPieces] = useState<ContentPiece[]>([]);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [actions, setActions] = useState<Action[]>([]);

  // Execution state
  const [executing, setExecuting] = useState<Set<string>>(new Set());
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'library' | 'actions' | 'pillars'>('library');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  useEffect(() => { fetchLibrary(); }, []);

  const fetchLibrary = async () => {
    try {
      const response = await fetch(`${SAMA_API_URL}/api/content/library`);
      if (response.ok) {
        const data = await response.json();
        setContentPieces(data.content || []);
      }
    } catch (error) {
      console.error('Error fetching content library:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setActiveTab('actions');
    setError(null);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/content/analyze`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        setActions(data.actions || []);
        if (data.content?.length > 0) {
          setContentPieces(data.content);
        }
      } else {
        setError('Analysis failed. Check backend connection.');
      }
    } catch {
      setError('Error connecting to backend.');
    } finally {
      setAnalyzing(false);
    }
  };

  const executeAction = async (action: Action) => {
    setExecuting(prev => new Set([...prev, action.id]));
    try {
      const response = await fetch(`${SAMA_API_URL}/api/content/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (response.ok) {
        const result = await response.json();
        setExecutionResults(prev => ({ ...prev, [action.id]: result }));
        setActions(prev => prev.map(a => a.id === action.id ? { ...a, status: 'completed' } : a));
        fetchLibrary();
      } else {
        setExecutionResults(prev => ({ ...prev, [action.id]: { error: 'Execution failed' } }));
      }
    } catch {
      setExecutionResults(prev => ({ ...prev, [action.id]: { error: 'Backend not reachable' } }));
    } finally {
      setExecuting(prev => { const next = new Set(prev); next.delete(action.id); return next; });
    }
  };

  const executeAll = async () => {
    if (!window.confirm(`Run all ${pendingCount} pending actions?`)) return;
    await Promise.all(actions.filter(a => a.status === 'pending').map(action => executeAction(action)));
  };

  const getPriorityColor = (p: string) => {
    if (p === 'critical') return 'bg-red-100 text-red-800 border-red-200';
    if (p === 'high') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (p === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getTypeIcon = (t: string) => {
    if (t === 'blog_post') return <PenTool className="h-5 w-5 text-blue-600" />;
    if (t === 'comparison') return <BarChart3 className="h-5 w-5 text-purple-600" />;
    if (t === 'optimize') return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (t === 'meta') return <FileText className="h-5 w-5 text-orange-600" />;
    if (t === 'publish') return <CheckCircle className="h-5 w-5 text-green-600" />;
    return <BookOpen className="h-5 w-5 text-slate-600" />;
  };

  const filteredPieces = contentPieces.filter(cp => {
    const matchesStatus = statusFilter === 'all' || cp.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || cp.title.toLowerCase().includes(q) || (cp.target_keyword || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = actions.filter(a => a.status === 'pending').length;
  const completedCount = actions.filter(a => a.status === 'completed').length;
  const publishedCount = contentPieces.filter(c => c.status === 'published').length;
  const draftCount = contentPieces.filter(c => c.status === 'draft').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
<main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-6 max-w-[1400px] mx-auto">
        {/* Left: Content Area */}
        <div className="max-w-4xl flex-1 min-w-0">
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 font-bold hover:text-red-900">✕</button>
          </div>
        )}

        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Content Strategy</h2>
            <p className="mt-2 text-slate-600">Analyze gaps → Generate content → Optimize → Publish</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/content-analytics"
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
              <TrendingUp className="h-4 w-4 text-green-600" /> Analytics
            </Link>
            <button onClick={runAnalysis} disabled={analyzing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 shadow-lg shadow-blue-600/20">
              {analyzing ? <><Clock className="h-5 w-5 animate-spin" /> Analyzing...</> : <><Zap className="h-5 w-5" /> Run Content Analysis</>}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Content</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{contentPieces.length}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Published</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{publishedCount}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Drafts</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{draftCount}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Actions Pending</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{pendingCount}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 border shadow-sm">
          {[
            { id: 'library' as const, label: 'Content Library', icon: <BookOpen className="h-4 w-4" /> },
            { id: 'actions' as const, label: `Actions${actions.length > 0 ? ` (${pendingCount})` : ''}`, icon: <Zap className="h-4 w-4" /> },
            { id: 'pillars' as const, label: 'Content Pillars', icon: <BarChart3 className="h-4 w-4" /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: Library */}
        {activeTab === 'library' && (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Content Library</h3>
                  <p className="mt-1 text-sm text-slate-500">All generated content pieces from Supabase</p>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by title or keyword..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | 'published' | 'draft')}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div className="divide-y">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-500">Loading content...</div>
              ) : contentPieces.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">No Content Yet</h3>
                  <p className="mt-2 text-sm text-slate-500">Run analysis to discover content gaps and generate new pieces.</p>
                </div>
              ) : filteredPieces.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No content matches your search.</div>
              ) : (
                filteredPieces.map((cp) => {
                  // Generate live URL based on content type and title
                  let liveUrl = '';
                  if (cp.status === 'published') {
                    if (cp.type === 'comparison') {
                      // Extract competitor name from title (e.g., "Successifier vs Gainsight" -> "gainsight")
                      const match = cp.title.match(/vs\s+(\w+)/i);
                      if (match) {
                        liveUrl = `https://successifier.com/vs/${match[1].toLowerCase()}`;
                      }
                    } else if (cp.type === 'blog_post') {
                      // Generate slug from title
                      const slug = cp.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                      liveUrl = `https://successifier.com/blog/${slug}`;
                    }
                  }

                  return (
                    <div key={cp.id} className="p-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-900">{cp.title}</h4>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              cp.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>{cp.status}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{cp.type}</span>
                            {liveUrl && (
                              <a href={liveUrl} target="_blank" rel="noopener noreferrer" 
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                View Live
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {cp.word_count > 0 && <span>{cp.word_count} words</span>}
                            {cp.target_keyword && <span>Keyword: {cp.target_keyword}</span>}
                            {cp.created_at && <span>{new Date(cp.created_at).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB: Actions */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            {analysis && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Content Analysis</h3>
                  {pendingCount > 0 && (
                    <button onClick={executeAll} disabled={executing.size > 0}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400">
                      <Play className="h-4 w-4" /> Execute All ({pendingCount})
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-2xl font-bold text-slate-900">{analysis.summary?.total_actions || 0}</p>
                    <p className="text-xs text-slate-500">Total Actions</p>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3 text-center">
                    <p className="text-2xl font-bold text-orange-600">{analysis.summary?.content_gaps || 0}</p>
                    <p className="text-xs text-orange-600">Content Gaps</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{analysis.summary?.content_pieces || 0}</p>
                    <p className="text-xs text-blue-600">Existing Pieces</p>
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
                <p className="mt-2 text-sm text-slate-500">Click "Run Content Analysis" to find gaps and generate recommendations.</p>
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
                          <button onClick={() => executeAction(action)} disabled={executing.has(action.id)}
                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400">
                            {executing.has(action.id) ? <><Clock className="h-3 w-3 animate-spin" /> Running...</> : <><Play className="h-3 w-3" /> Execute</>}
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
                        {action.keyword && <p className="text-xs text-slate-500"><span className="font-medium">Keyword:</span> {action.keyword}</p>}
                        {action.competitor && <p className="text-xs text-slate-500"><span className="font-medium">Competitor:</span> {action.competitor}</p>}
                        {action.pillar && <p className="text-xs text-slate-500"><span className="font-medium">Pillar:</span> {action.pillar}</p>}
                        {executionResults[action.id] && (
                          <div className={`rounded-lg p-3 ${executionResults[action.id].error ? 'bg-red-50' : 'bg-green-50'}`}>
                            <p className="text-xs font-medium mb-1">{executionResults[action.id].error ? 'Error' : 'Result'}</p>
                            {executionResults[action.id].result ? (
                              <pre className="text-xs text-slate-700 whitespace-pre-wrap overflow-auto max-h-48">{JSON.stringify(executionResults[action.id].result, null, 2)}</pre>
                            ) : executionResults[action.id].meta_description ? (
                              <p className="text-sm text-slate-700">{executionResults[action.id].meta_description}</p>
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

        {/* TAB: Content Pillars */}
        {activeTab === 'pillars' && (
          <ContentPillarsTab contentPieces={contentPieces} apiUrl={SAMA_API_URL} />
        )}

        </div>

        {/* Right: Agent Chat Sidebar */}
        <div className="hidden lg:block w-[380px] flex-shrink-0">
          <div className="sticky top-8">
            <AgentChat
              agentName="Content"
              apiUrl={`${SAMA_API_URL}/api/content`}
              placeholder="Ask Content agent to create blog posts, comparison pages, or analyze content gaps"
              examplePrompts={[
                "Create a blog post about reducing customer churn",
                "Analyze content gaps for Q1",
                "Write a comparison page vs Gainsight",
                "What content should I prioritize?",
              ]}
            />
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}

const PILLAR_COLORS = [
  'border-red-200 bg-red-50', 'border-green-200 bg-green-50', 'border-blue-200 bg-blue-50',
  'border-purple-200 bg-purple-50', 'border-yellow-200 bg-yellow-50', 'border-orange-200 bg-orange-50',
  'border-pink-200 bg-pink-50', 'border-cyan-200 bg-cyan-50', 'border-indigo-200 bg-indigo-50',
];

const DEFAULT_PILLARS = [
  { key: 'churn_prevention', title: 'Churn Prevention', desc: 'Content around detecting and reducing churn' },
  { key: 'health_scoring', title: 'Health Scoring', desc: 'Customer health scoring frameworks' },
  { key: 'cs_automation', title: 'CS Automation', desc: 'Automating workflows and playbooks' },
  { key: 'onboarding', title: 'Onboarding', desc: 'Customer onboarding best practices' },
  { key: 'nrr_growth', title: 'NRR Growth', desc: 'Net revenue retention strategies' },
  { key: 'competitor', title: 'Competitor Comparisons', desc: 'vs Gainsight, Totango, ChurnZero' },
];

function ContentPillarsTab({ contentPieces, apiUrl }: { contentPieces: ContentPiece[]; apiUrl: string }) {
  const [pillars, setPillars] = useState(DEFAULT_PILLARS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/api/content/library`);
        if (res.ok) {
          const data = await res.json();
          const pieces: ContentPiece[] = data.content || [];
          // Derive pillars from actual target keywords
          const kwMap = new Map<string, number>();
          pieces.forEach(p => {
            const kw = (p.target_keyword || '').toLowerCase().trim();
            if (kw) kwMap.set(kw, (kwMap.get(kw) || 0) + 1);
          });
          if (kwMap.size > 0) {
            const derived = Array.from(kwMap.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 12)
              .map(([kw]) => ({
                key: kw.replace(/\s+/g, '_'),
                title: kw.replace(/\b\w/g, l => l.toUpperCase()),
                desc: `${kwMap.get(kw)} pieces targeting "${kw}"`,
              }));
            if (derived.length > 0) setPillars(derived);
          }
        }
      } catch { /* use defaults */ }
      setLoaded(true);
    })();
  }, [loaded, apiUrl]);

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b p-6">
        <h3 className="text-lg font-semibold text-slate-900">Content Pillars</h3>
        <p className="mt-1 text-sm text-slate-500">Strategic content themes derived from your content library</p>
      </div>
      <div className="grid gap-4 p-6 md:grid-cols-3">
        {pillars.map((pillar, i) => {
          const count = contentPieces.filter(cp =>
            (cp.target_keyword || '').toLowerCase().includes(pillar.key.replace(/_/g, ' ')) ||
            (cp.title || '').toLowerCase().includes(pillar.key.replace(/_/g, ' '))
          ).length;
          return (
            <div key={pillar.key} className={`rounded-lg border p-4 ${PILLAR_COLORS[i % PILLAR_COLORS.length]}`}>
              <h4 className="font-semibold text-slate-900">{pillar.title}</h4>
              <p className="mt-1 text-sm text-slate-600">{pillar.desc}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">{count} pieces</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
