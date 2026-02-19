"use client";

import { useEffect, useState } from "react";
import { FileText, TrendingUp, CheckCircle, Zap, Clock, Play, ChevronDown, ChevronUp, PenTool, BarChart3, BookOpen, Search, ExternalLink, Copy, Check, MessageSquare } from "lucide-react";
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

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [actions, setActions] = useState<Action[]>([]);

  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});

  const [activeTab, setActiveTab] = useState<'library' | 'actions' | 'pillars' | 'chat'>('library');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [filterType, setFilterType] = useState<'all' | 'blog_post' | 'comparison'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [fixingYaml, setFixingYaml] = useState(false);
  const [yamlFixResult, setYamlFixResult] = useState<{ fixed: number; skipped: number; errors: number } | null>(null);

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
    try {
      const response = await fetch(`${SAMA_API_URL}/api/content/analyze`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        setActions(data.actions || []);
        if (data.content?.length > 0) setContentPieces(data.content);
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
      const response = await fetch(`${SAMA_API_URL}/api/content/execute`, {
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

  const getPriorityColor = (p: string) => {
    if (p === 'critical') return 'bg-red-100 text-red-800 border-red-200';
    if (p === 'high') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (p === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getTypeIcon = (t: string) => {
    if (t === 'blog_post') return <PenTool className="h-4 w-4 text-blue-600" />;
    if (t === 'comparison') return <BarChart3 className="h-4 w-4 text-purple-600" />;
    if (t === 'optimize') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (t === 'publish') return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <BookOpen className="h-4 w-4 text-slate-600" />;
  };

  const getLiveUrl = (cp: ContentPiece) => {
    if (cp.type === 'comparison') {
      const match = cp.title.match(/vs\s+(\w+)/i);
      if (match) return `https://successifier.com/vs/${match[1].toLowerCase()}`;
    } else if (cp.type === 'blog_post') {
      const slug = cp.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return `https://successifier.com/blog/${slug}`;
    }
    return '';
  };

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const fixYamlFrontMatter = async () => {
    setFixingYaml(true);
    setYamlFixResult(null);
    try {
      const response = await fetch('/api/content/fix-frontmatter', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setYamlFixResult({ fixed: data.fixed, skipped: data.skipped, errors: data.errors });
      } else {
        const err = await response.json().catch(() => ({}));
        alert(`YAML-fix misslyckades: ${err.error || response.statusText}`);
      }
    } catch {
      alert('Kunde inte nå API-rutten för YAML-fix.');
    } finally {
      setFixingYaml(false);
    }
  };

  const filteredContent = contentPieces
    .filter(cp => filterStatus === 'all' || cp.status === filterStatus)
    .filter(cp => filterType === 'all' || cp.type === filterType)
    .filter(cp =>
      search === '' ||
      cp.title.toLowerCase().includes(search.toLowerCase()) ||
      (cp.target_keyword || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  const pendingCount = actions.filter(a => a.status === 'pending').length;
  const completedCount = actions.filter(a => a.status === 'completed').length;
  const publishedCount = contentPieces.filter(c => c.status === 'published').length;
  const draftCount = contentPieces.filter(c => c.status === 'draft').length;

  const tabs = [
    { id: 'library' as const, label: 'Library', shortLabel: 'Library', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'actions' as const, label: `Actions${pendingCount > 0 ? ` (${pendingCount})` : ''}`, shortLabel: pendingCount > 0 ? `(${pendingCount})` : 'Actions', icon: <Zap className="h-4 w-4" /> },
    { id: 'pillars' as const, label: 'Pillars', shortLabel: 'Pillars', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'chat' as const, label: 'Chat', shortLabel: 'Chat', icon: <MessageSquare className="h-4 w-4" />, mobileOnly: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Nav */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <FileText className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-bold text-slate-900">Content</span>
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 shadow-sm"
              >
                {analyzing
                  ? <><Clock className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">Analyzing…</span></>
                  : <><Zap className="h-4 w-4" /><span className="hidden sm:inline">Run Analysis</span></>
                }
              </button>
              <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 hidden sm:block">← Dashboard</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-6 items-start">

          {/* ── Left / Main column ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Totalt', value: contentPieces.length, color: 'text-slate-900' },
                { label: 'Publicerade', value: publishedCount, color: 'text-green-600' },
                { label: 'Utkast', value: draftCount, color: 'text-yellow-600' },
                { label: 'Åtgärder', value: pendingCount, color: 'text-blue-600' },
              ].map(s => (
                <div key={s.label} className="rounded-xl border bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">{s.label}</p>
                  <p className={`mt-0.5 text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Tab bar */}
            <div className="flex overflow-x-auto gap-1 rounded-xl bg-white p-1 border shadow-sm scrollbar-none">
              {tabs
                .filter(t => !t.mobileOnly || true) // always render all; control visibility via class
                .map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors shrink-0',
                      tab.id === 'chat' ? 'lg:hidden' : '',
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {tab.icon}
                    <span className="hidden xs:inline sm:inline">{tab.label}</span>
                    {/* On very small screens show only icon for non-chat tabs */}
                    <span className="xs:hidden sm:hidden inline">{tab.id === 'chat' ? 'Chat' : tab.shortLabel}</span>
                  </button>
                ))}
            </div>

            {/* ── TAB: Library ── */}
            {activeTab === 'library' && (
              <div className="space-y-3">
                {/* Search + filters */}
                <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Sök titel eller nyckelord…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full rounded-lg border pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'published', 'draft'] as const).map(s => (
                      <button key={s} onClick={() => setFilterStatus(s)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {s === 'all' ? `Alla (${contentPieces.length})` : s === 'published' ? `Publicerade (${publishedCount})` : `Utkast (${draftCount})`}
                      </button>
                    ))}
                    <div className="w-px bg-slate-200 mx-1 self-stretch" />
                    {(['all', 'blog_post', 'comparison'] as const).map(t => (
                      <button key={t} onClick={() => setFilterType(t)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterType === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {t === 'all' ? 'Alla typer' : t === 'blog_post' ? 'Blogg' : 'Jämförelse'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* List */}
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="border-b px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-700">
                      {filteredContent.length} <span className="text-slate-400 font-normal">/ {contentPieces.length} inlägg</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {yamlFixResult && (
                        <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                          {yamlFixResult.fixed} fixade{yamlFixResult.errors > 0 && ` · ${yamlFixResult.errors} fel`}
                        </span>
                      )}
                      <button
                        onClick={fixYamlFrontMatter}
                        disabled={fixingYaml}
                        title="Reparera felformaterad YAML front matter"
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {fixingYaml ? <Clock className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                        Fix YAML
                      </button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="p-8 text-center text-sm text-slate-400">Laddar…</div>
                  ) : contentPieces.length === 0 ? (
                    <div className="p-10 text-center">
                      <FileText className="mx-auto h-10 w-10 text-slate-200" />
                      <p className="mt-3 text-sm font-medium text-slate-600">Inget innehåll ännu</p>
                      <p className="mt-1 text-xs text-slate-400">Kör analys för att hitta innehållsgap.</p>
                    </div>
                  ) : filteredContent.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">Inga träffar.</div>
                  ) : (
                    <div className="divide-y">
                      {filteredContent.map((cp) => {
                        const liveUrl = getLiveUrl(cp);
                        return (
                          <div key={cp.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 shrink-0">{getTypeIcon(cp.type)}</div>
                              <div className="flex-1 min-w-0">
                                {/* Title + badges */}
                                <div className="flex items-start gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-slate-900 leading-snug">{cp.title}</p>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cp.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                      {cp.status === 'published' ? 'Publicerad' : 'Utkast'}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                      {cp.type === 'blog_post' ? 'Blogg' : cp.type === 'comparison' ? 'Jämförelse' : cp.type}
                                    </span>
                                  </div>
                                </div>

                                {/* Meta row */}
                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                  {cp.target_keyword && (
                                    <span className="text-xs text-slate-500">{cp.target_keyword}</span>
                                  )}
                                  {cp.word_count > 0 && (
                                    <span className="text-xs text-slate-400">{cp.word_count} ord</span>
                                  )}
                                  {cp.created_at && (
                                    <span className="text-xs text-slate-400">{new Date(cp.created_at).toLocaleDateString('sv-SE')}</span>
                                  )}
                                  {liveUrl && (
                                    <div className="flex items-center gap-1 ml-auto">
                                      <a href={liveUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-blue-500 hover:text-blue-700" title="Öppna">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                      <button onClick={() => copyUrl(cp.id, liveUrl)}
                                        className="text-slate-400 hover:text-slate-600" title="Kopiera URL">
                                        {copiedId === cp.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB: Actions ── */}
            {activeTab === 'actions' && (
              <div className="space-y-3">
                {analysis && (
                  <div className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">Content Analysis</h3>
                      {pendingCount > 0 && (
                        <button onClick={executeAll} disabled={executing !== null}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 shrink-0">
                          <Play className="h-3.5 w-3.5" /> Kör alla ({pendingCount})
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Totalt', value: analysis.summary?.total_actions || 0, cls: 'text-slate-900' },
                        { label: 'Gaps', value: analysis.summary?.content_gaps || 0, cls: 'text-orange-600' },
                        { label: 'Inlägg', value: analysis.summary?.content_pieces || 0, cls: 'text-blue-600' },
                        { label: 'Klara', value: completedCount, cls: 'text-green-600' },
                      ].map(s => (
                        <div key={s.label} className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
                          <p className="text-xs text-slate-500">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {actions.length === 0 ? (
                  <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
                    <Zap className="mx-auto h-10 w-10 text-slate-200" />
                    <p className="mt-3 text-sm font-medium text-slate-600">Inga åtgärder ännu</p>
                    <p className="mt-1 text-xs text-slate-400">Klicka "Run Analysis" för att hitta innehållsgap.</p>
                  </div>
                ) : (
                  actions.map((action) => (
                    <div key={action.id} className={`rounded-xl border bg-white shadow-sm transition-all ${action.status === 'completed' ? 'opacity-60' : ''}`}>
                      <div className="p-4">
                        {/* Top row */}
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {action.status === 'completed'
                              ? <CheckCircle className="h-4 w-4 text-green-600" />
                              : getTypeIcon(action.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap mb-1">
                              <p className="text-sm font-medium text-slate-900 leading-snug">{action.title}</p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>
                                {action.priority}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">{action.description}</p>
                          </div>
                          <button onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                            className="shrink-0 rounded p-1 hover:bg-slate-100 text-slate-400">
                            {expandedAction === action.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>

                        {/* Execute button – below title on mobile */}
                        {action.status === 'pending' && (
                          <div className="mt-3 ml-7">
                            <button onClick={() => executeAction(action)} disabled={executing === action.id}
                              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400">
                              {executing === action.id
                                ? <><Clock className="h-3 w-3 animate-spin" /> Kör…</>
                                : <><Play className="h-3 w-3" /> Kör</>}
                            </button>
                          </div>
                        )}

                        {/* Expanded detail */}
                        {expandedAction === action.id && (
                          <div className="mt-3 ml-7 space-y-2">
                            <div className="rounded-lg bg-slate-50 p-3">
                              <p className="text-xs font-medium text-slate-500 mb-1">Rekommenderad åtgärd</p>
                              <p className="text-sm text-slate-700">{action.action}</p>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {action.keyword && <p className="text-xs text-slate-500"><span className="font-medium">Keyword:</span> {action.keyword}</p>}
                              {action.competitor && <p className="text-xs text-slate-500"><span className="font-medium">Competitor:</span> {action.competitor}</p>}
                              {action.pillar && <p className="text-xs text-slate-500"><span className="font-medium">Pillar:</span> {action.pillar}</p>}
                            </div>
                            {executionResults[action.id] && (
                              <div className={`rounded-lg p-3 ${executionResults[action.id].error ? 'bg-red-50' : 'bg-green-50'}`}>
                                <p className="text-xs font-medium mb-1">{executionResults[action.id].error ? 'Fel' : 'Resultat'}</p>
                                {executionResults[action.id].result ? (
                                  <pre className="text-xs text-slate-700 whitespace-pre-wrap overflow-auto max-h-40">{JSON.stringify(executionResults[action.id].result, null, 2)}</pre>
                                ) : (
                                  <p className="text-xs text-slate-600">{executionResults[action.id].meta_description || executionResults[action.id].message || executionResults[action.id].error || 'Klar'}</p>
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

            {/* ── TAB: Pillars ── */}
            {activeTab === 'pillars' && (
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="border-b px-4 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">Content Pillars</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Strategiska innehållsteman för topical authority</p>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { key: 'churn_prevention', title: 'Churn Prevention', desc: 'Detecting and reducing churn', color: 'border-red-200 bg-red-50' },
                    { key: 'health_scoring', title: 'Health Scoring', desc: 'Customer health scoring frameworks', color: 'border-green-200 bg-green-50' },
                    { key: 'cs_automation', title: 'CS Automation', desc: 'Automating workflows and playbooks', color: 'border-blue-200 bg-blue-50' },
                    { key: 'onboarding', title: 'Onboarding', desc: 'Customer onboarding best practices', color: 'border-purple-200 bg-purple-50' },
                    { key: 'nrr_growth', title: 'NRR Growth', desc: 'Net revenue retention strategies', color: 'border-yellow-200 bg-yellow-50' },
                    { key: 'competitor', title: 'Competitor Comparisons', desc: 'vs Gainsight, Totango, ChurnZero', color: 'border-orange-200 bg-orange-50' },
                  ].map(pillar => {
                    const count = contentPieces.filter(cp =>
                      (cp.target_keyword || '').toLowerCase().includes(pillar.key.replace(/_/g, ' ')) ||
                      (cp.title || '').toLowerCase().includes(pillar.key.replace(/_/g, ' '))
                    ).length;
                    return (
                      <div key={pillar.key} className={`rounded-xl border p-4 ${pillar.color}`}>
                        <p className="text-sm font-semibold text-slate-900">{pillar.title}</p>
                        <p className="mt-1 text-xs text-slate-600">{pillar.desc}</p>
                        <p className="mt-2 text-xs font-medium text-slate-500">{count} inlägg</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TAB: Chat (mobile only) ── */}
            {activeTab === 'chat' && (
              <div className="lg:hidden">
                <AgentChat
                  agentName="Content"
                  apiUrl={`${SAMA_API_URL}/api/content`}
                  placeholder="Skapa blogginlägg, jämförelsesidor eller analysera innehållsgap"
                />
              </div>
            )}
          </div>

          {/* ── Right: Chat sidebar (desktop only) ── */}
          <div className="hidden lg:block w-[360px] shrink-0">
            <div className="sticky top-20">
              <AgentChat
                agentName="Content"
                apiUrl={`${SAMA_API_URL}/api/content`}
                placeholder="Skapa blogginlägg, jämförelsesidor eller analysera innehållsgap"
              />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
