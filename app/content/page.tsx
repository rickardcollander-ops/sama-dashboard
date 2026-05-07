"use client";

import { useEffect, useState } from "react";
import { FileText, TrendingUp, Zap, Clock, BookOpen, Lightbulb, BarChart3 } from "lucide-react";
import Link from "next/link";
import AgentChat from "@/components/AgentChat";
import { useBackgroundAnalysis } from "@/lib/hooks/useBackgroundAnalysis";
import ContentPlanTab from "@/components/content/ContentPlanTab";
import QuickFixesPanel from "@/components/content/QuickFixesPanel";

const _RAW_SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || '';
const SAMA_API_URL = /^https?:\/\//.test(_RAW_SAMA_API) ? _RAW_SAMA_API : '/api/sama';

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
  status: string;
}

interface AnalysisSummary {
  total_actions?: number;
  content_gaps?: number;
  content_pieces?: number;
  high?: number;
  medium?: number;
}

const QUICK_FIX_TYPES = new Set(["optimize", "meta", "publish"]);

export default function ContentPage() {
  const [loading, setLoading] = useState(true);
  const [contentPieces, setContentPieces] = useState<ContentPiece[]>([]);

  // Analysis state — backed by the persistent cache so it survives reloads.
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Persist the latest analysis snapshot to the agent cache. Best-effort —
  // a failure just means the next reload won't have the cached snapshot.
  const persistSnapshot = async (snapshot: { summary: AnalysisSummary | null; actions: Action[] }) => {
    try {
      await fetch(`${SAMA_API_URL}/api/content/analysis/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'content', summary: snapshot.summary || {}, actions: snapshot.actions }),
      });
    } catch {
      /* non-fatal */
    }
  };

  const fetchActions = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/actions`);
      if (res.ok) {
        const d = await res.json();
        const newActions: Action[] = d.actions || [];
        setActions(newActions);
        return newActions;
      }
    } catch (err) {
      console.error('Failed to fetch content actions:', err);
    }
    return null;
  };

  const fetchLatestAnalysisFromCache = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/analysis/latest`);
      if (!res.ok) return;
      const data = await res.json();
      const cached = data?.analysis;
      if (cached && typeof cached === 'object') {
        if (Array.isArray(cached.actions)) setActions(cached.actions as Action[]);
        if (cached.summary && typeof cached.summary === 'object') setAnalysisSummary(cached.summary as AnalysisSummary);
      }
    } catch {
      /* cache miss is fine */
    }
  };

  const { startAnalysis: startBgAnalysis, analyzing, phase: analysisPhase, progress: analysisProgress } =
    useBackgroundAnalysis({
      agent: 'content',
      onComplete: async () => {
        fetchLibrary();
        const latest = await fetchActions();
        if (latest) {
          const summary: AnalysisSummary = {
            total_actions: latest.length,
            high: latest.filter(a => a.priority === 'high').length,
            medium: latest.filter(a => a.priority === 'medium').length,
            content_gaps: latest.filter(a => a.type === 'blog_post').length,
          };
          setAnalysisSummary(summary);
          persistSnapshot({ summary, actions: latest });
        }
      },
      onError: (err) => setError(err),
    });

  // UI state — Plan is now the default tab; analysis-driven gaps land
  // there automatically so it's the highest-leverage entry point.
  const [activeTab, setActiveTab] = useState<'plan' | 'library' | 'pillars'>('plan');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  useEffect(() => {
    fetchLibrary();
    fetchLatestAnalysisFromCache();
  }, []);

  const fetchLibrary = async () => {
    try {
      const response = await fetch(`${SAMA_API_URL}/api/content/library`);
      if (response.ok) {
        let data: any;
        try { data = await response.json(); } catch (e) { console.error('Failed to parse content library JSON:', e); data = {}; }
        setContentPieces(data.content || []);
      }
    } catch (err) {
      console.error('Error fetching content library:', err);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    // After analysis completes, the gaps auto-feed into the plan, so
    // jumping to Plan tab is the right place to land the user.
    setActiveTab('plan');
    setError(null);
    await startBgAnalysis();
  };

  const filteredPieces = contentPieces.filter(cp => {
    const matchesStatus = statusFilter === 'all' || cp.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || cp.title.toLowerCase().includes(q) || (cp.target_keyword || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const [suggestingNext, setSuggestingNext] = useState(false);
  const [nextArticleSuggestion, setNextArticleSuggestion] = useState<string | null>(null);

  const suggestNextArticle = async () => {
    setSuggestingNext(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `suggest-next-${Date.now()}`,
          type: 'blog_post',
          priority: 'high',
          title: 'AI-suggested next article',
          description: 'Based on content gaps and keyword opportunities, generate the next article',
          action: 'suggest_next_article',
          status: 'pending',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNextArticleSuggestion(data.result?.title || data.suggestions || data.message || 'Suggestion generated.');
        fetchActions();
        fetchLibrary();
      }
    } catch (err) { console.error('Failed to suggest next article:', err); }
    finally { setSuggestingNext(false); }
  };

  const quickFixCount = actions.filter(a => QUICK_FIX_TYPES.has(a.type) && a.status === 'pending').length;
  const publishedCount = contentPieces.filter(c => c.status === 'published').length;
  const draftCount = contentPieces.filter(c => c.status === 'draft').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6 max-w-[1400px] mx-auto">
          {/* Left: Content Area */}
          <div className="lg:max-w-4xl flex-1 min-w-0">
            {error && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-4 font-bold hover:text-red-900">✕</button>
              </div>
            )}

            {nextArticleSuggestion && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-800"><span className="font-medium">Next article suggestion:</span> {nextArticleSuggestion}</p>
                </div>
                <button onClick={() => setNextArticleSuggestion(null)} className="ml-4 font-bold text-blue-400 hover:text-blue-600">✕</button>
              </div>
            )}

            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Content Agent</h2>
                <p className="mt-1 sm:mt-2 text-slate-500 text-sm">
                  Analyse content gaps, plan articles, and edit them with AI — gaps surfaced by Analyze
                  feed straight into the plan below.
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <Link href="/content-analytics"
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
                  <TrendingUp className="h-4 w-4 text-green-600" /> <span className="hidden sm:inline">Analytics</span>
                </Link>
                <button onClick={suggestNextArticle} disabled={suggestingNext || analyzing}
                  className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  {suggestingNext ? <><Clock className="h-4 w-4 animate-spin" /> Suggesting...</> : <><BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Suggest</span> Next</>}
                </button>
                <button onClick={runAnalysis} disabled={analyzing}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 shadow-lg shadow-blue-600/20">
                  {analyzing ? <><Clock className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Zap className="h-4 w-4" /> Analyze</>}
                </button>
              </div>
            </div>

            {/* Analysis progress */}
            {analyzing && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 animate-spin text-blue-600" />
                    <p className="text-sm font-medium text-blue-800">{analysisPhase || 'Starting analysis...'}</p>
                  </div>
                  <span className="text-xs font-mono text-blue-600">{analysisProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-blue-100 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all duration-700 ease-out" style={{ width: `${analysisProgress}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-blue-600">You can navigate away — the analysis continues in the background. Gaps will auto-populate the plan.</p>
              </div>
            )}

            {/* Stats */}
            <div className="mb-6 grid gap-4 md:grid-cols-4">
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
                <p className="text-sm font-medium text-slate-500">Quick fixes</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{quickFixCount}</p>
              </div>
            </div>

            {/* Quick fixes (collapsible, only renders when there are any) */}
            <QuickFixesPanel apiUrl={SAMA_API_URL} />

            {/* Tabs */}
            <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 border shadow-sm overflow-x-auto">
              {[
                { id: 'plan' as const, label: 'Content Plan', icon: <Lightbulb className="h-4 w-4" /> },
                { id: 'library' as const, label: 'Library', icon: <BookOpen className="h-4 w-4" /> },
                { id: 'pillars' as const, label: 'Pillars', icon: <BarChart3 className="h-4 w-4" /> },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* TAB: Content Plan */}
            {activeTab === 'plan' && (
              <ContentPlanTab apiUrl={SAMA_API_URL} />
            )}

            {/* TAB: Library */}
            {activeTab === 'library' && (
              <div className="rounded-lg border bg-white shadow-sm">
                <div className="border-b p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Content Library</h3>
                      <p className="mt-1 text-sm text-slate-500">All content pieces generated by the Content Agent. Click any item to edit it with the AI editor.</p>
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
                      <p className="mt-2 text-sm text-slate-500">Switch to the <span className="font-medium">Content Plan</span> tab to generate ideas, or click &quot;Analyze&quot; to scan competitors and surface gaps.</p>
                    </div>
                  ) : filteredPieces.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">No content matches your search.</div>
                  ) : (
                    filteredPieces.map((cp) => {
                      let liveUrl = '';
                      if (cp.status === 'published') {
                        if (cp.type === 'comparison') {
                          const match = cp.title.match(/vs\s+(\w+)/i);
                          if (match) {
                            liveUrl = `https://successifier.com/vs/${match[1].toLowerCase()}`;
                          }
                        } else if (cp.type === 'blog_post') {
                          const slug = cp.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                          liveUrl = `https://successifier.com/blog/${slug}`;
                        }
                      }

                      return (
                        <Link
                          key={cp.id}
                          href={`/content/${cp.id}`}
                          className="block p-4 hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-slate-900">{cp.title}</h4>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  cp.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>{cp.status}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{cp.type}</span>
                                {liveUrl && (
                                  <span
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(liveUrl, '_blank'); }}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                                  >
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    View Live
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                {cp.word_count > 0 && <span>{cp.word_count} words</span>}
                                {cp.target_keyword && <span>Keyword: {cp.target_keyword}</span>}
                                {cp.created_at && <span>{new Date(cp.created_at).toLocaleDateString()}</span>}
                                <span className="ml-auto text-blue-600">Edit with AI →</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB: Pillars */}
            {activeTab === 'pillars' && (
              <ContentPillarsTab contentPieces={contentPieces} apiUrl={SAMA_API_URL} />
            )}

            {/* Tiny analysis-snapshot footer (replaces the old Actions tab) */}
            {analysisSummary && (
              <p className="mt-6 text-center text-xs text-slate-400">
                Last analysis surfaced {analysisSummary.total_actions || 0} actions
                {analysisSummary.content_gaps ? ` (${analysisSummary.content_gaps} content gaps)` : ''} —
                gaps appear in the plan above as <span className="font-medium text-amber-700">Gap</span> rows.
              </p>
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
      } catch (err) { console.error('Failed to load content pillars:', err); }
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
