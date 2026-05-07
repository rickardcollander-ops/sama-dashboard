"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Sparkles, RotateCcw, Wand2, Clock, CheckCircle, AlertCircle,
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
  created_at?: string;
}

type Toast = { type: "success" | "error" | "info"; text: string } | null;

export default function ArticleEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [piece, setPiece] = useState<ContentPiece | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState<"" | "edit" | "rewrite">("");
  const [toast, setToast] = useState<Toast>(null);

  // Editable fields (kept separate so we can dirty-check before save)
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [status, setStatus] = useState("draft");

  // AI controls
  const [editInstruction, setEditInstruction] = useState("");
  const [rewriteBrief, setRewriteBrief] = useState("");
  const [lastChange, setLastChange] = useState<string>("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const p = data.piece as ContentPiece | null;
        if (!p) {
          setToast({ type: "error", text: "Article not found" });
        } else {
          setPiece(p);
          setTitle(p.title || "");
          setContent(p.content || "");
          setMetaDescription(p.meta_description || "");
          setTargetKeyword(p.target_keyword || "");
          setStatus(p.status || "draft");
        }
      } catch (e) {
        setToast({ type: "error", text: e instanceof Error ? e.message : "Failed to load article" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Auto-clear toasts.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
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
      if (data.piece) {
        setPiece(data.piece);
      } else {
        // Backend returned without piece — refresh from server.
        const r2 = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}`);
        if (r2.ok) setPiece((await r2.json()).piece);
      }
      setToast({ type: "success", text: "Saved" });
    } catch (e) {
      setToast({ type: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
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

  const runAIEdit = async () => {
    if (!id || !editInstruction.trim()) return;
    const selection = getSelection();
    setAiBusy("edit");
    setLastChange("");
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/pieces/${id}/ai-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: editInstruction, selection: selection || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "AI edit failed");
      setContent(data.content || "");
      setLastChange(data.summary_of_changes || `Applied edit (${data.scope || "whole article"})`);
      setToast({ type: "success", text: `AI edit applied — ${data.scope || "whole article"}` });
    } catch (e) {
      setToast({ type: "error", text: e instanceof Error ? e.message : "AI edit failed" });
    } finally {
      setAiBusy("");
    }
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
    } catch (e) {
      setToast({ type: "error", text: e instanceof Error ? e.message : "AI rewrite failed" });
    } finally {
      setAiBusy("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-lg border bg-white p-12 text-center text-slate-500">
          Loading article...
        </div>
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
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {saving ? <Clock className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
                </button>
              </div>
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
                  {piece.created_at && (
                    <>
                      <span>•</span>
                      <span>{new Date(piece.created_at).toLocaleDateString()}</span>
                    </>
                  )}
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
              <div className="p-5">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Write the article here in markdown..."
                  className="h-[60vh] w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {lastChange && (
                  <p className="mt-2 text-xs text-slate-500"><Sparkles className="mr-1 inline h-3 w-3 text-purple-500" />{lastChange}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── AI panel ──────────────────────────────────────────────── */}
          <aside className="w-full lg:w-[380px] flex-shrink-0">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-purple-900">
                  <Sparkles className="h-4 w-4" /> Edit with AI
                </h3>
                <p className="mt-1 text-xs text-purple-700">
                  Highlight a passage to scope the edit, or leave it deselected to edit the whole article.
                </p>
                <textarea
                  value={editInstruction}
                  onChange={e => setEditInstruction(e.target.value)}
                  placeholder='e.g. "Make the introduction punchier and add a stat about churn"'
                  rows={3}
                  className="mt-3 w-full rounded-md border border-purple-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  onClick={runAIEdit}
                  disabled={aiBusy !== "" || !editInstruction.trim()}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300"
                >
                  {aiBusy === "edit" ? <Clock className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {aiBusy === "edit" ? "Editing..." : "Apply AI edit"}
                </button>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <RotateCcw className="h-4 w-4" /> Rewrite from scratch
                </h3>
                <p className="mt-1 text-xs text-amber-700">
                  Throws away the current draft and writes a fresh article from your brief.
                </p>
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
                  onMouseDown={e => e.preventDefault()}
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
