"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Sparkles, RotateCcw, Wand2, Clock, CheckCircle, AlertCircle,
  Eye, Columns, Code, Lightbulb, Rocket, ShieldCheck, Megaphone, ArrowRight,
} from "lucide-react";

const _RAW_SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || "";
const SAMA_API_URL = /^https?:\/\//.test(_RAW_SAMA_API) ? _RAW_SAMA_API : "/api/sama";

interface ContentPiece {
  id: string;
  title: string;
  content: string;
  content_type: string;
  status: string;
  word_count: number;
  target_keyword: string;
  meta_title: string;
  meta_description: string;
  validation_score?: number;
  validation_notes?: string[];
  external_url?: string;
  target_url?: string;
  created_at?: string;
}

interface ValidationDetails {
  score: number;
  notes: string[];
  details?: Record<string, unknown>;
}

interface LineageStep {
  label: string;
  date?: string;
  active: boolean;
  icon: React.ReactNode;
  hint?: string;
}

interface PlanLineage {
  source?: string;
  status?: string;
  created_at?: string;
}

type Toast = { type: "success" | "error" | "info"; text: string } | null;
type EditorView = "edit" | "split" | "preview";

// Default min score the backend uses when no per-tenant override exists.
const DEFAULT_MIN_SCORE = 70;

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  ai_generated: "AI generated",
  analysis_gap: "Analysis gap",
  competitor_gap: "Competitor gap",
};

/** Tiny markdown → HTML renderer.
 *  Covers headings, bold, italic, code, links, lists, blockquotes, paragraphs.
 *  Escapes HTML first so user input can't inject tags. Good enough for a
 *  preview pane — we don't need a full CommonMark implementation here.
 */
function renderMarkdown(md: string): string {
  if (!md) return "";
  const escape = (s: string) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false, inOl = false, inCode = false;
  const closeLists = () => { if (inUl) { out.push("</ul>"); inUl = false; } if (inOl) { out.push("</ol>"); inOl = false; } };

  for (let raw of lines) {
    if (/^```/.test(raw)) {
      if (inCode) { out.push("</code></pre>"); inCode = false; }
      else { closeLists(); out.push('<pre class="rounded bg-slate-100 p-3 text-xs overflow-x-auto"><code>'); inCode = true; }
      continue;
    }
    if (inCode) { out.push(escape(raw)); continue; }

    let line = escape(raw);

    // Inline: **bold**, *italic*, `code`, [link](url)
    line = line.replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 text-xs">$1</code>');
    line = line.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    line = line.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    line = line.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">$1</a>');

    if (/^#{1,6}\s/.test(raw)) {
      closeLists();
      const level = (raw.match(/^#+/) || [""])[0].length;
      const text = line.replace(/^#+\s*/, "");
      const cls = level === 1 ? "text-2xl font-bold mt-6 mb-3" :
                  level === 2 ? "text-xl font-semibold mt-5 mb-2" :
                  level === 3 ? "text-lg font-semibold mt-4 mb-2" :
                                "font-semibold mt-3 mb-2";
      out.push(`<h${level} class="${cls}">${text}</h${level}>`);
      continue;
    }

    if (/^\s*[-*+]\s/.test(raw)) {
      if (!inUl) { closeLists(); out.push('<ul class="list-disc pl-6 my-2 space-y-1">'); inUl = true; }
      out.push(`<li>${line.replace(/^\s*[-*+]\s+/, "")}</li>`);
      continue;
    }

    if (/^\s*\d+\.\s/.test(raw)) {
      if (!inOl) { closeLists(); out.push('<ol class="list-decimal pl-6 my-2 space-y-1">'); inOl = true; }
      out.push(`<li>${line.replace(/^\s*\d+\.\s+/, "")}</li>`);
      continue;
    }

    if (/^\s*>\s/.test(raw)) {
      closeLists();
      out.push(`<blockquote class="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-3">${line.replace(/^\s*>\s+/, "")}</blockquote>`);
      continue;
    }

    if (line.trim() === "") { closeLists(); continue; }

    closeLists();
    out.push(`<p class="my-2 leading-relaxed">${line}</p>`);
  }

  if (inCode) out.push("</code></pre>");
  closeLists();
  return out.join("\n");
}

export default function ArticleEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [piece, setPiece] = useState<ContentPiece | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aiBusy, setAiBusy] = useState<"" | "edit" | "rewrite" | "brand_voice">("");
  const [toast, setToast] = useState<Toast>(null);

  // Editable fields
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [status, setStatus] = useState("draft");

  // AI controls
  const [editInstruction, setEditInstruction] = useState("");
  const [rewriteBrief, setRewriteBrief] = useState("");
  const [lastChange, setLastChange] = useState<string>("");

  // View mode for the body
  const [viewMode, setViewMode] = useState<EditorView>("edit");

  // Validation panel
  const [validation, setValidation] = useState<ValidationDetails | null>(null);
  const [validating, setValidating] = useState(false);

  // Lineage
  const [lineage, setLineage] = useState<PlanLineage | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Loaders ────────────────────────────────────────────────────────────

  const loadPiece = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const p = data.piece as ContentPiece | null;
      if (!p) {
        setToast({ type: "error", text: "Article not found" });
        return null;
      }
      setPiece(p);
      setTitle(p.title || "");
      setContent(p.content || "");
      setMetaDescription(p.meta_description || "");
      setTargetKeyword(p.target_keyword || "");
      setStatus(p.status || "draft");
      if (Array.isArray(p.validation_notes) || typeof p.validation_score === "number") {
        setValidation({
          score: p.validation_score ?? 0,
          notes: Array.isArray(p.validation_notes) ? p.validation_notes : [],
        });
      }
      return p;
    } catch (e) {
      setToast({ type: "error", text: e instanceof Error ? e.message : "Failed to load article" });
      return null;
    }
  };

  const runValidation = async () => {
    if (!id) return;
    setValidating(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}/validate`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setValidation({ score: data.score, notes: data.notes || [], details: data.details });
    } catch {
      /* non-fatal */
    } finally {
      setValidating(false);
    }
  };

  const loadLineage = async () => {
    if (!id) return;
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}/lineage`);
      if (!res.ok) return;
      const data = await res.json();
      const plan = data.plan_item;
      if (plan) {
        setLineage({
          source: plan.source,
          status: plan.status,
          created_at: plan.created_at,
        });
      }
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const p = await loadPiece();
      if (!cancelled && p) {
        // Run validation on mount unless we already have a recent score from
        // the piece row itself (avoid double-billing the heuristic check).
        if (typeof p.validation_score !== "number") {
          await runValidation();
        }
        await loadLineage();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const wordCount = useMemo(() => (content || "").trim().split(/\s+/).filter(Boolean).length, [content]);

  const dirty = piece && (
    title !== piece.title ||
    content !== piece.content ||
    metaDescription !== piece.meta_description ||
    targetKeyword !== piece.target_keyword ||
    status !== piece.status
  );

  const isPublished = status === "published" || piece?.status === "published";
  const canPublish = !isPublished && (validation?.score ?? 0) >= DEFAULT_MIN_SCORE && !dirty;

  // ── Actions ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, content,
          meta_description: metaDescription,
          target_keyword: targetKeyword,
          status,
          word_count: wordCount,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.piece) setPiece(data.piece);
      else { const r2 = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}`); if (r2.ok) setPiece((await r2.json()).piece); }
      setToast({ type: "success", text: "Saved" });
      // Re-validate after a save so the score reflects the saved state.
      runValidation();
    } catch (e) {
      setToast({ type: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      if (!data.success) throw new Error(data.error || "Publish failed");
      setStatus("published");
      setPiece(prev => prev ? { ...prev, status: "published", external_url: data.external_url, target_url: data.external_url } : prev);
      const url = data.external_url || data.pr_url;
      setToast({
        type: "success",
        text: data.pr_url
          ? `Published — PR opened: ${data.pr_url}`
          : url ? `Published — ${url}` : "Published",
      });
    } catch (e) {
      setToast({ type: "error", text: e instanceof Error ? e.message : "Publish failed" });
    } finally {
      setPublishing(false);
    }
  };

  const getSelection = (): string => {
    const ta = textareaRef.current;
    if (!ta) return "";
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (end > start) return content.slice(start, end);
    return "";
  };

  const runAIEdit = async (overrideInstruction?: string, label?: string) => {
    const instruction = (overrideInstruction ?? editInstruction).trim();
    if (!id || !instruction) return;
    const selection = getSelection();
    setAiBusy(label === "brand_voice" ? "brand_voice" : "edit");
    setLastChange("");
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}/ai-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, selection: selection || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "AI edit failed");
      setContent(data.content || "");
      setLastChange(data.summary_of_changes || `Applied edit (${data.scope || "whole article"})`);
      setToast({ type: "success", text: `AI edit applied — ${data.scope || "whole article"}` });
      runValidation();
    } catch (e) {
      setToast({ type: "error", text: e instanceof Error ? e.message : "AI edit failed" });
    } finally {
      setAiBusy("");
    }
  };

  const runApplyBrandVoice = async () => {
    // The agent already exposes brand-voice via GET /api/content/brand-voice;
    // we let the AI editor pull the voice itself by phrasing the instruction
    // canonically. No need to round-trip the dictionary through the browser.
    await runAIEdit(
      "Rewrite to match our brand voice exactly: educational, confident, focused on B2B SaaS customer success leaders. " +
      "Lean on metrics ('reduce churn', 'boost NRR', 'health score'). Avoid hype words. Keep paragraphs short. " +
      "Preserve overall structure and length.",
      "brand_voice",
    );
  };

  const runAIRewrite = async () => {
    if (!id || !rewriteBrief.trim()) return;
    setAiBusy("rewrite");
    setLastChange("");
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}/ai-rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: rewriteBrief,
          target_keyword: targetKeyword || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "AI rewrite failed");
      setTitle(data.title || title);
      setContent(data.content || "");
      setMetaDescription(data.meta_description || metaDescription);
      setLastChange(`Rewrote from scratch (~${data.word_count || wordCount} words)`);
      setToast({ type: "success", text: "Article rewritten" });
      runValidation();
    } catch (e) {
      setToast({ type: "error", text: e instanceof Error ? e.message : "AI rewrite failed" });
    } finally {
      setAiBusy("");
    }
  };

  // ── Lineage steps ──────────────────────────────────────────────────────

  const lineageSteps: LineageStep[] = useMemo(() => {
    const steps: LineageStep[] = [];
    if (lineage) {
      steps.push({
        label: `Idea — ${SOURCE_LABEL[lineage.source || "manual"] || "Idea"}`,
        date: lineage.created_at,
        active: true,
        icon: <Lightbulb className="h-3.5 w-3.5" />,
      });
    }
    steps.push({
      label: "Draft",
      date: piece?.created_at,
      active: !isPublished,
      icon: <Wand2 className="h-3.5 w-3.5" />,
    });
    steps.push({
      label: "Published",
      date: isPublished ? new Date().toISOString() : undefined,
      active: isPublished,
      icon: <Rocket className="h-3.5 w-3.5" />,
      hint: isPublished ? piece?.external_url || piece?.target_url : undefined,
    });
    return steps;
  }, [lineage, piece, isPublished]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-lg border bg-white p-12 text-center text-slate-500">Loading article...</div>
      </div>
    );
  }

  if (!piece) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-lg border bg-white p-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Article not found</h2>
          <p className="mt-2 text-sm text-slate-500">It may have been deleted, or your tenant doesn&apos;t have access.</p>
          <Link href="/content" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            <ArrowLeft className="h-4 w-4" /> Back to content
          </Link>
        </div>
      </div>
    );
  }

  const score = validation?.score ?? 0;
  const scoreColor =
    score >= 85 ? "text-green-600" :
    score >= DEFAULT_MIN_SCORE ? "text-blue-600" :
    score >= 50 ? "text-amber-600" : "text-red-600";
  const scoreRingBg =
    score >= 85 ? "bg-green-50 ring-green-200" :
    score >= DEFAULT_MIN_SCORE ? "bg-blue-50 ring-blue-200" :
    score >= 50 ? "bg-amber-50 ring-amber-200" : "bg-red-50 ring-red-200";

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 lg:flex-row">
          {/* ── Editor column ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <Link href="/content" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" /> Back to content
              </Link>
              <div className="flex items-center gap-2">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
                <button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {saving ? <Clock className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing || !canPublish}
                  title={
                    isPublished ? "Already published" :
                    dirty ? "Save changes first" :
                    score < DEFAULT_MIN_SCORE ? `Score ${score}/100 — needs ${DEFAULT_MIN_SCORE}+ to publish` :
                    "Raise PR + mark published"
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-green-300"
                >
                  {publishing ? <Clock className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {publishing ? "Publishing..." : isPublished ? "Published" : "Approve & Publish"}
                </button>
              </div>
            </div>

            {/* Lineage strip */}
            <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              {lineageSteps.map((step, idx) => (
                <span key={idx} className="inline-flex items-center gap-1">
                  {idx > 0 && <ArrowRight className="h-3 w-3 text-slate-300" />}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                    step.active
                      ? idx === lineageSteps.length - 1 && isPublished
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {step.icon}{step.label}
                  </span>
                  {step.date && <span className="text-slate-400">{new Date(step.date).toLocaleDateString()}</span>}
                  {step.hint && (
                    <a href={step.hint} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">view</a>
                  )}
                </span>
              ))}
            </div>

            {toast && (
              <div className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                toast.type === "success" ? "border-green-200 bg-green-50 text-green-800" :
                toast.type === "error" ? "border-red-200 bg-red-50 text-red-800" :
                "border-blue-200 bg-blue-50 text-blue-800"
              }`}>
                {toast.type === "success" ? <CheckCircle className="mt-0.5 h-4 w-4" /> :
                 toast.type === "error" ? <AlertCircle className="mt-0.5 h-4 w-4" /> :
                 <Sparkles className="mt-0.5 h-4 w-4" />}
                <span>{toast.text}</span>
              </div>
            )}

            <div className="rounded-lg border bg-white shadow-sm">
              <div className="border-b p-5 space-y-3">
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Article title"
                  className="w-full bg-transparent text-2xl font-semibold text-slate-900 focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>{piece.content_type.replace(/_/g, " ")}</span>
                  <span>•</span>
                  <span>{wordCount} words</span>
                  {piece.created_at && (<><span>•</span><span>{new Date(piece.created_at).toLocaleDateString()}</span></>)}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Target keyword</span>
                    <input
                      value={targetKeyword}
                      onChange={e => setTargetKeyword(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Meta description ({metaDescription.length}/160)</span>
                    <input
                      value={metaDescription}
                      onChange={e => setMetaDescription(e.target.value)}
                      maxLength={200}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2">
                <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  {([
                    ["edit", "Edit", <Code key="i" className="h-3 w-3" />],
                    ["split", "Split", <Columns key="i" className="h-3 w-3" />],
                    ["preview", "Preview", <Eye key="i" className="h-3 w-3" />],
                  ] as const).map(([key, label, icon]) => (
                    <button
                      key={key}
                      onClick={() => setViewMode(key)}
                      className={`inline-flex items-center gap-1 rounded px-2.5 py-1 transition-colors ${
                        viewMode === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {icon}{label}
                    </button>
                  ))}
                </div>
                {lastChange && (
                  <p className="text-xs text-slate-500"><Sparkles className="mr-1 inline h-3 w-3 text-purple-500" />{lastChange}</p>
                )}
              </div>

              <div className="p-5">
                {viewMode === "edit" && (
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Write the article here in markdown..."
                    className="h-[60vh] w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
                {viewMode === "preview" && (
                  <div
                    className="prose prose-slate h-[60vh] max-w-none overflow-y-auto rounded-md border border-slate-200 bg-white p-4 text-sm"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                )}
                {viewMode === "split" && (
                  <div className="grid h-[60vh] grid-cols-2 gap-3">
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="Markdown..."
                      className="resize-none rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div
                      className="overflow-y-auto rounded-md border border-slate-200 bg-white p-4 text-sm"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── AI panel + validation ─────────────────────────────────── */}
          <aside className="w-full lg:w-[380px] flex-shrink-0">
            <div className="sticky top-6 space-y-4">
              {/* Validation score */}
              <div className={`rounded-lg border p-4 ring-1 ${scoreRingBg}`}>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-slate-700" /> SEO score
                  </h3>
                  <button
                    onClick={runValidation}
                    disabled={validating}
                    className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  >
                    {validating ? "Checking..." : "Re-check"}
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-white ${scoreColor}`}>
                    <span className="text-xl font-bold">{score}</span>
                  </div>
                  <div className="flex-1 text-xs text-slate-600">
                    {score >= DEFAULT_MIN_SCORE ? (
                      <p className="text-green-700">Above the {DEFAULT_MIN_SCORE} threshold — ready to publish.</p>
                    ) : (
                      <p>Needs {DEFAULT_MIN_SCORE - score} more to clear the {DEFAULT_MIN_SCORE} publish threshold.</p>
                    )}
                  </div>
                </div>
                {validation?.notes && validation.notes.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-slate-600">
                    {validation.notes.map((n, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* AI Edit */}
              <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-purple-900">
                  <Sparkles className="h-4 w-4" /> Edit with AI
                </h3>
                <p className="mt-1 text-xs text-purple-700">Highlight a passage to scope the edit, or leave it deselected to edit the whole article.</p>
                <textarea
                  value={editInstruction}
                  onChange={e => setEditInstruction(e.target.value)}
                  placeholder='e.g. "Make the introduction punchier and add a stat about churn"'
                  rows={3}
                  className="mt-3 w-full rounded-md border border-purple-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => runAIEdit()}
                    disabled={aiBusy !== "" || !editInstruction.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300"
                  >
                    {aiBusy === "edit" ? <Clock className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {aiBusy === "edit" ? "Editing..." : "Apply edit"}
                  </button>
                  <button
                    onClick={runApplyBrandVoice}
                    disabled={aiBusy !== ""}
                    title="Re-tone the article to match the brand voice (no instruction needed)"
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-purple-300 bg-white px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                  >
                    {aiBusy === "brand_voice" ? <Clock className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                    Brand voice
                  </button>
                </div>
              </div>

              {/* AI Rewrite */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <RotateCcw className="h-4 w-4" /> Rewrite from scratch
                </h3>
                <p className="mt-1 text-xs text-amber-700">Throws away the current draft and writes a fresh article from your brief.</p>
                <textarea
                  value={rewriteBrief}
                  onChange={e => setRewriteBrief(e.target.value)}
                  placeholder='e.g. "B2B SaaS guide on health scoring for CS teams, 1500 words, with a checklist at the end"'
                  rows={4}
                  className="mt-3 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  onClick={runAIRewrite}
                  disabled={aiBusy !== "" || !rewriteBrief.trim()}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-amber-300"
                >
                  {aiBusy === "rewrite" ? <Clock className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {aiBusy === "rewrite" ? "Rewriting..." : "Rewrite article"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
