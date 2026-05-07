"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Clock, ArrowRight, Plus, Trash2, FileText, MessageSquare, Mail, BarChart3, Lightbulb, RefreshCw,
  Wand2, Search, Crosshair, UserSquare2,
} from "lucide-react";

const _RAW_SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || "";
const SAMA_API_URL = /^https?:\/\//.test(_RAW_SAMA_API) ? _RAW_SAMA_API : "/api/sama";

export interface PlanItem {
  id: string;
  title: string;
  topic: string;
  content_type: string;
  target_keyword: string;
  pillar: string;
  reason: string;
  priority: string;
  status: string;
  source: string;
  content_piece_id: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

const STATUS_BADGE: Record<string, string> = {
  idea: "bg-slate-100 text-slate-700",
  drafting: "bg-purple-100 text-purple-700",
  draft: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-slate-100 text-slate-400",
};

interface SourceMeta { label: string; cls: string; icon: React.ReactNode }
const SOURCE_META: Record<string, SourceMeta> = {
  manual:         { label: "Manual",      cls: "bg-slate-100 text-slate-600",     icon: <UserSquare2 className="h-3 w-3" /> },
  ai_generated:   { label: "AI",          cls: "bg-purple-100 text-purple-700",   icon: <Wand2 className="h-3 w-3" /> },
  analysis_gap:   { label: "Gap",         cls: "bg-amber-100 text-amber-700",     icon: <Search className="h-3 w-3" /> },
  competitor_gap: { label: "Competitor",  cls: "bg-rose-100 text-rose-700",       icon: <Crosshair className="h-3 w-3" /> },
};

type SourceFilter = "all" | "ai_generated" | "analysis_gap" | "competitor_gap" | "manual";

function typeIcon(t: string) {
  if (t === "blog_article" || t === "blog_post") return <FileText className="h-4 w-4 text-blue-600" />;
  if (t === "linkedin_post") return <MessageSquare className="h-4 w-4 text-sky-600" />;
  if (t === "email") return <Mail className="h-4 w-4 text-amber-600" />;
  if (t === "comparison") return <BarChart3 className="h-4 w-4 text-purple-600" />;
  return <Lightbulb className="h-4 w-4 text-slate-500" />;
}

interface Props {
  /** Override the API base if the parent already resolved one. */
  apiUrl?: string;
}

export default function ContentPlanTab({ apiUrl }: Props) {
  const base = apiUrl || SAMA_API_URL;
  const router = useRouter();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(6);
  const [statusFilter, setStatusFilter] = useState<"all" | "idea" | "draft" | "published">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const fetchItems = async () => {
    try {
      const res = await fetch(`${base}/api/content/plan`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load content plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Counts for the source filter chips — visible at a glance so the user
  // doesn't have to filter just to see "do I have any analysis gaps?"
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length, manual: 0, ai_generated: 0, analysis_gap: 0, competitor_gap: 0 };
    for (const it of items) {
      const s = it.source || "manual";
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [items]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${base}/api/content/plan/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, replace: false }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to generate ideas");
      const fresh: PlanItem[] = Array.isArray(data.items) ? data.items : [];
      setItems(prev => [...fresh, ...prev]);
      if (data.skipped) {
        setError(`${fresh.length} ideas added (${data.skipped} duplicates skipped)`);
        setTimeout(() => setError(null), 4000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate ideas");
    } finally {
      setGenerating(false);
    }
  };

  const handleClick = async (item: PlanItem) => {
    if (item.content_piece_id) {
      router.push(`/content/${item.content_piece_id}`);
      return;
    }
    setDrafting(item.id);
    setError(null);
    try {
      const res = await fetch(`${base}/api/content/plan/${item.id}/draft`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to draft article");
      const pieceId = data.content_piece_id;
      if (!pieceId) throw new Error("Backend did not return a content_piece_id");
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: "draft", content_piece_id: pieceId } : p));
      router.push(`/content/${pieceId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to draft article");
    } finally {
      setDrafting(null);
    }
  };

  const handleDelete = async (item: PlanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove "${item.title}" from the plan?`)) return;
    try {
      await fetch(`${base}/api/content/plan/${item.id}`, { method: "DELETE" });
      setItems(prev => prev.filter(p => p.id !== item.id));
    } catch {
      /* best-effort */
    }
  };

  const filtered = items.filter(it => {
    if (statusFilter !== "all" && it.status !== statusFilter) return false;
    if (sourceFilter !== "all" && (it.source || "manual") !== sourceFilter) return false;
    return true;
  });

  const SourceChip = ({ value, label }: { value: SourceFilter; label: string }) => {
    const active = sourceFilter === value;
    const meta = value === "all" ? null : SOURCE_META[value];
    const count = sourceCounts[value] ?? 0;
    return (
      <button
        onClick={() => setSourceFilter(value)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          active
            ? "border-blue-500 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        {meta?.icon}
        {label}
        <span className={`rounded-full px-1.5 py-0 text-[10px] ${active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{count}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">What to write next</h3>
            <p className="mt-1 text-sm text-slate-500">
              Persistent backlog of content ideas — fed automatically by analysis runs and your manual generates. Click a card to draft it into a full article.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="idea">Ideas</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
            </select>
            <input
              type="number"
              min={1}
              max={12}
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              title="How many ideas to generate"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {generating ? <Clock className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating..." : "Generate ideas"}
            </button>
            <button
              onClick={fetchItems}
              title="Refresh"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Source filter chips */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Source</span>
          <SourceChip value="all" label="All" />
          <SourceChip value="ai_generated" label="AI" />
          <SourceChip value="analysis_gap" label="Gap" />
          <SourceChip value="competitor_gap" label="Competitor" />
          <SourceChip value="manual" label="Manual" />
        </div>

        {error && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">{error}</div>
        )}

        <div className="divide-y">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading content plan...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Lightbulb className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {items.length === 0 ? "No ideas yet" : "Nothing matches that filter"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {items.length === 0 ? (
                  <>Click <span className="font-medium">Generate ideas</span> to populate the plan, or click <span className="font-medium">Analyze</span> in the page header to surface gaps from your existing content.</>
                ) : (
                  <>Try clearing the filters above.</>
                )}
              </p>
            </div>
          ) : (
            filtered.map(item => {
              const isDrafting = drafting === item.id;
              const opensEditor = !!item.content_piece_id;
              const sourceMeta = SOURCE_META[item.source || "manual"] || SOURCE_META.manual;
              return (
                <div
                  key={item.id}
                  onClick={() => !isDrafting && handleClick(item)}
                  className={`group flex cursor-pointer items-start gap-3 p-4 transition-colors ${
                    isDrafting ? "bg-purple-50/50" : "hover:bg-slate-50"
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter") handleClick(item); }}
                >
                  <div className="mt-1 flex-shrink-0">{typeIcon(item.content_type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate font-medium text-slate-900">{item.title}</h4>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceMeta.cls}`}>
                        {sourceMeta.icon}{sourceMeta.label}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[item.priority] || PRIORITY_BADGE.medium}`}>
                        {item.priority}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[item.status] || STATUS_BADGE.idea}`}>
                        {item.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {item.content_type.replace(/_/g, " ")}
                      </span>
                      {item.pillar && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">{item.pillar}</span>
                      )}
                    </div>
                    {item.topic && <p className="mt-1 text-sm text-slate-600 line-clamp-2">{item.topic}</p>}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                      {item.target_keyword && <span>Keyword: {item.target_keyword}</span>}
                      {item.reason && <span className="italic">{item.reason}</span>}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => handleDelete(item, e)}
                      className="rounded p-1.5 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 group-hover:bg-blue-50">
                      {isDrafting ? (
                        <><Clock className="h-3 w-3 animate-spin" /> Drafting...</>
                      ) : opensEditor ? (
                        <>Open editor <ArrowRight className="h-3 w-3" /></>
                      ) : (
                        <>Draft <Plus className="h-3 w-3" /></>
                      )}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
