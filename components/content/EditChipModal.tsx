"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Wand2, Sparkles, Loader2, Check, Trash2, ArrowRight, Calendar as CalendarIcon,
  Rocket, AlertCircle,
} from "lucide-react";
import type { tenantApi } from "@/lib/api";

export interface EditableChipItem {
  id: string;
  title: string;
  topic?: string;
  content_type: string;
  target_keyword?: string;
  pillar?: string;
  priority: string;
  status: string;
  source: string;
  content_piece_id: string | null;
  scheduled_for: string | null;
  auto_publish_on_schedule: boolean;
}

type RefineField = "title" | "topic";

interface RefineIntent {
  id: string;
  label: string;
  description: string;
}

const TITLE_INTENTS: RefineIntent[] = [
  { id: "punchier", label: "Punchier", description: "Sharper, more clickable title" },
  { id: "seo", label: "SEO-optimise", description: "Weave in keywords naturally" },
  { id: "shorten", label: "Shorten", description: "Tighter phrasing" },
  { id: "tone", label: "Adjust tone", description: "More on-brand tone" },
  { id: "grammar", label: "Polish", description: "Tidy up the language" },
];

const TOPIC_INTENTS: RefineIntent[] = [
  { id: "expand", label: "Expand", description: "Add an extra sentence with edge" },
  { id: "shorten", label: "Shorten", description: "Compress to the essentials" },
  { id: "tone", label: "Adjust tone", description: "More on-brand tone" },
  { id: "seo", label: "SEO-optimise", description: "Weave in keywords naturally" },
  { id: "grammar", label: "Polish", description: "Tidy up the language" },
];

const PRIORITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CONTENT_TYPE_OPTIONS = [
  { value: "blog_article", label: "Blog article" },
  { value: "linkedin_post", label: "LinkedIn post" },
  { value: "email", label: "Email" },
  { value: "comparison", label: "Comparison page" },
];

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  item: EditableChipItem | null;
  tenantClient: ReturnType<typeof tenantApi>;
  onClose: () => void;
  onSaved: (item: EditableChipItem) => void;
  onDeleted: (id: string) => void;
  onApproved?: (item: EditableChipItem, contentPieceId: string) => void;
}

export default function EditChipModal({
  open,
  item,
  tenantClient,
  onClose,
  onSaved,
  onDeleted,
  onApproved,
}: Props) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [contentType, setContentType] = useState("blog_article");
  const [priority, setPriority] = useState("medium");
  const [scheduledDate, setScheduledDate] = useState("");
  const [autoPublish, setAutoPublish] = useState(false);

  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI refine state — separate per field so the user can preview/keep
  // the title rewrite without losing an unrelated topic rewrite.
  const [refineField, setRefineField] = useState<RefineField | null>(null);
  const [refineIntent, setRefineIntent] = useState<string>("punchier");
  const [refining, setRefining] = useState(false);
  const [refinedTitle, setRefinedTitle] = useState<string | null>(null);
  const [refinedTopic, setRefinedTopic] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    setTitle(item.title || "");
    setTopic(item.topic || "");
    setKeyword(item.target_keyword || "");
    setContentType(item.content_type || "blog_article");
    setPriority(item.priority || "medium");
    setScheduledDate(toDateInputValue(item.scheduled_for));
    setAutoPublish(!!item.auto_publish_on_schedule);
    setError(null);
    setRefineField(null);
    setRefinedTitle(null);
    setRefinedTopic(null);
  }, [open, item]);

  if (!open || !item) return null;

  const isIdea = item.status === "idea";
  const hasPiece = !!item.content_piece_id;

  const buildPatch = () => {
    const patch: Record<string, unknown> = {};
    if (title.trim() !== (item.title || "")) patch.title = title.trim();
    if (topic.trim() !== (item.topic || "")) patch.topic = topic.trim();
    if (keyword.trim() !== (item.target_keyword || "")) {
      patch.target_keyword = keyword.trim();
    }
    if (contentType !== item.content_type) patch.content_type = contentType;
    if (priority !== item.priority) patch.priority = priority;
    const currentDate = toDateInputValue(item.scheduled_for);
    if (scheduledDate && scheduledDate !== currentDate) {
      // Preserve original time-of-day if we have one, else default to 09:00 UTC.
      const orig = item.scheduled_for ? new Date(item.scheduled_for) : null;
      const hh = orig ? orig.getUTCHours() : 9;
      const mm = orig ? orig.getUTCMinutes() : 0;
      const [y, m, d] = scheduledDate.split("-").map(Number);
      patch.scheduled_for = new Date(Date.UTC(y, m - 1, d, hh, mm)).toISOString();
    }
    if (autoPublish !== item.auto_publish_on_schedule) {
      patch.auto_publish_on_schedule = autoPublish;
    }
    return patch;
  };

  const handleSave = async (closeAfter = true) => {
    if (!title.trim()) {
      setError("Titel kan inte vara tom.");
      return;
    }
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      if (closeAfter) onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await tenantClient.patch<{ success: boolean; error?: string; item?: EditableChipItem }>(
        `/api/content/plan/${item.id}`,
        patch,
      );
      if (!data.success) throw new Error(data.error || "Kunde inte spara");
      const merged: EditableChipItem = data.item ?? { ...item, ...(patch as Partial<EditableChipItem>) };
      onSaved(merged);
      if (closeAfter) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!isIdea) {
      // Already drafted — just open the editor.
      if (item.content_piece_id) {
        router.push(`/c/content/${item.content_piece_id}`);
      }
      return;
    }
    // Persist edits first so the draft is generated from the latest title/topic.
    if (Object.keys(buildPatch()).length > 0) {
      await handleSave(false);
    }
    setApproving(true);
    setError(null);
    try {
      const data = await tenantClient.post<{ success: boolean; error?: string; content_piece_id?: string }>(
        `/api/content/plan/${item.id}/draft`,
      );
      if (!data.success) throw new Error(data.error || "Could not approve");
      const pieceId = data.content_piece_id;
      const updated: EditableChipItem = {
        ...item,
        title: title.trim() || item.title,
        topic: topic.trim() || item.topic,
        status: "draft",
        content_piece_id: pieceId ?? item.content_piece_id,
      };
      onSaved(updated);
      onApproved?.(updated, pieceId ?? "");
      onClose();
      if (pieceId) router.push(`/c/content/${pieceId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setApproving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove "${item.title}" from the plan?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await tenantClient.delete(`/api/content/plan/${item.id}`);
      onDeleted(item.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
      setDeleting(false);
    }
  };

  const handleRefine = async (field: RefineField, intent: string) => {
    const text = (field === "title" ? title : topic).trim();
    if (!text) {
      setError("There's no text to rewrite.");
      return;
    }
    setRefineField(field);
    setRefineIntent(intent);
    setRefining(true);
    setError(null);
    try {
      const data = await tenantClient.post<{ refined_text?: string; error?: string }>(
        `/api/content/plan/${item.id}/refine`,
        {
          text,
          intent,
          field,
          target_keyword: keyword.trim() || undefined,
        },
      );
      const refined = (data.refined_text || "").trim();
      if (!refined) throw new Error("AI returned no text");
      if (field === "title") setRefinedTitle(refined);
      else setRefinedTopic(refined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rewrite the text");
    } finally {
      setRefining(false);
    }
  };

  const acceptRefine = (field: RefineField) => {
    if (field === "title" && refinedTitle) {
      setTitle(refinedTitle);
      setRefinedTitle(null);
    } else if (field === "topic" && refinedTopic) {
      setTopic(refinedTopic);
      setRefinedTopic(null);
    }
    setRefineField(null);
  };

  const discardRefine = (field: RefineField) => {
    if (field === "title") setRefinedTitle(null);
    else setRefinedTopic(null);
    setRefineField(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="flex w-full max-w-2xl max-h-[92vh] flex-col rounded-2xl border bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b px-6 py-4">
            <div className="min-w-0 pr-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Wand2 className="h-5 w-5 text-purple-500" />
                Edit idea
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Status: <span className="font-medium text-slate-700">{item.status}</span>
                {item.scheduled_for && (
                  <>
                    {" · "}scheduled {new Date(item.scheduled_for).toLocaleDateString()}
                  </>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Title + AI refine */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Title</label>
                <button
                  onClick={() => setRefineField(refineField === "title" ? null : "title")}
                  className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 hover:bg-purple-100"
                >
                  <Sparkles className="h-3 w-3" />
                  Rewrite with AI
                </button>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {refineField === "title" && (
                <RefinePanel
                  intents={TITLE_INTENTS}
                  intent={refineIntent}
                  setIntent={setRefineIntent}
                  refining={refining}
                  refined={refinedTitle}
                  onRun={() => handleRefine("title", refineIntent)}
                  onAccept={() => acceptRefine("title")}
                  onDiscard={() => discardRefine("title")}
                />
              )}
            </div>

            {/* Topic + AI refine */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">
                  What it's about
                </label>
                <button
                  onClick={() => setRefineField(refineField === "topic" ? null : "topic")}
                  className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 hover:bg-purple-100"
                >
                  <Sparkles className="h-3 w-3" />
                  Rewrite with AI
                </button>
              </div>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                placeholder="One or two sentences about the content"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {refineField === "topic" && (
                <RefinePanel
                  intents={TOPIC_INTENTS}
                  intent={refineIntent}
                  setIntent={setRefineIntent}
                  refining={refining}
                  refined={refinedTopic}
                  onRun={() => handleRefine("topic", refineIntent)}
                  onAccept={() => acceptRefine("topic")}
                  onDiscard={() => discardRefine("topic")}
                />
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Keyword</span>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="customer health score"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Type</span>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {CONTENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" /> Scheduled date
                  </span>
                </span>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <div className="text-sm">
                <p className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Rocket className="h-3.5 w-3.5 text-blue-600" />
                  Publish automatically on the scheduled date
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Otherwise it stays as a draft for manual approval.
                </p>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50/50 px-6 py-3">
            <button
              onClick={handleDelete}
              disabled={deleting || saving || approving}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onClose}
                disabled={saving || approving}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving || approving}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
              <button
                onClick={handleApprove}
                disabled={saving || approving}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                title={isIdea ? "Approve the idea and write a draft" : "Open in the editor"}
              >
                {approving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isIdea ? (
                  <ArrowRight className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {isIdea
                  ? approving
                    ? "Writing draft..."
                    : "Approve → draft"
                  : hasPiece
                    ? "Open editor"
                    : "Next step"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface RefinePanelProps {
  intents: RefineIntent[];
  intent: string;
  setIntent: (v: string) => void;
  refining: boolean;
  refined: string | null;
  onRun: () => void;
  onAccept: () => void;
  onDiscard: () => void;
}

function RefinePanel({
  intents, intent, setIntent, refining, refined, onRun, onAccept, onDiscard,
}: RefinePanelProps) {
  return (
    <div className="mt-2 rounded-md border border-purple-200 bg-purple-50/50 p-3">
      <div className="flex flex-wrap gap-1.5">
        {intents.map((it) => {
          const active = intent === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setIntent(it.id)}
              title={it.description}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                active
                  ? "border-purple-400 bg-purple-100 text-purple-800"
                  : "border-purple-200 bg-white text-purple-700 hover:bg-purple-100"
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={onRun}
          disabled={refining}
          className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:bg-purple-300"
        >
          {refining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {refining ? "Rewriting..." : refined ? "Try again" : "Rewrite"}
        </button>
        {refined && (
          <>
            <button
              onClick={onAccept}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <Check className="h-3 w-3" /> Use
            </button>
            <button
              onClick={onDiscard}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Discard
            </button>
          </>
        )}
      </div>
      {refined && (
        <div className="mt-2 rounded border border-purple-200 bg-white p-2 text-sm text-slate-800">
          {refined}
        </div>
      )}
    </div>
  );
}
