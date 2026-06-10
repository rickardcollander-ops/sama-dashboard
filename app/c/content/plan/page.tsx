"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Plus, Clock, FileText, MessageSquare, Mail, BarChart3,
  Sparkles, Rocket, X, Calendar as CalendarIcon, Wand2, Lightbulb, GripVertical,
  Search, CheckCircle2,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import EditChipModal, { type EditableChipItem } from "@/components/content/EditChipModal";
import { useSite } from "@/lib/hooks/useSite";
import { useActiveRuns } from "@/lib/hooks/useActiveRuns";

interface PlanItem {
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
  // Backend (`/api/content/plan/calendar`) enriches scheduled rows with
  // the linked content_pieces fields so the calendar can show thumbnails
  // and score chips for drafts/approved articles in the plan.
  piece_status?: string | null;
  piece_title?: string | null;
  featured_image_url?: string | null;
  article_score?: number | null;
  slug?: string | null;
}

interface PublishedPiece {
  id: string;
  title: string;
  content_type: string;
  status: string;
  published_at: string | null;
  target_url: string | null;
  external_url: string | null;
  created_at: string | null;
  // Same enrichment as PlanItem: present once migration 044 has been
  // applied so the calendar can render the cover image and score chip.
  featured_image_url?: string | null;
  article_score?: number | null;
  slug?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  idea: "bg-slate-100 text-slate-700",
  drafting: "bg-purple-100 text-purple-700",
  draft: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-slate-100 text-slate-400",
};

function typeIcon(t: string) {
  if (t === "blog_article" || t === "blog_post") return <FileText className="h-3 w-3" />;
  if (t === "linkedin_post") return <MessageSquare className="h-3 w-3" />;
  if (t === "email") return <Mail className="h-3 w-3" />;
  if (t === "comparison") return <BarChart3 className="h-3 w-3" />;
  return <Lightbulb className="h-3 w-3" />;
}

// Build a 6×7 grid for a month. Returns Date[] starting from the first
// Monday on/before the 1st of `month`, ending on the last Sunday on/after
// the last day of `month`.
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  // 0=Sun, 1=Mon ... we want to start on Monday
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - offset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push(d);
  }
  return days;
}

function ymdKey(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

function isoForDay(d: Date, hour = 9, minute = 0): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute));
  return dt.toISOString();
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Add-to-calendar modal ────────────────────────────────────────────────

interface AddModalProps {
  date: Date;
  onClose: () => void;
  onAdded: (item: PlanItem) => void;
  tenantClient: ReturnType<typeof import("@/lib/api").tenantApi>;
}

function AddModal({ date, onClose, onAdded, tenantClient }: AddModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [contentType, setContentType] = useState("blog_article");
  const [priority, setPriority] = useState("medium");
  const [hour, setHour] = useState(9);
  const [autoPublish, setAutoPublish] = useState(false);
  const [draftNow, setDraftNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await tenantClient.post<{ success: boolean; error?: string; item: PlanItem; content_piece_id?: string }>(
        `/api/content/plan/calendar`,
        {
          title: title.trim(),
          topic: topic.trim() || undefined,
          target_keyword: keyword.trim() || undefined,
          content_type: contentType,
          priority,
          scheduled_for: isoForDay(date, hour, 0),
          auto_publish_on_schedule: autoPublish,
          draft_now: draftNow,
        },
      );
      if (!data.success) throw new Error(data.error || "Failed to add to plan");

      onAdded(data.item);
      // If we drafted right now, jump straight into the article view.
      if (draftNow && data.content_piece_id) {
        router.push(`/c/content/article/${data.content_piece_id}`);
        return;
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Schedule content</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {date.toUTCString().slice(0, 16)}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Title</span>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. The 2026 guide to customer health scoring"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">What it's about (optional)</span>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="One-sentence summary"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Type</span>
              <select
                value={contentType}
                onChange={e => setContentType(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="blog_article">Blog article</option>
                <option value="linkedin_post">LinkedIn post</option>
                <option value="email">Email</option>
                <option value="comparison">Comparison page</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Priority</span>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Target keyword (optional)</span>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="customer health score"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Hour (UTC)</span>
              <input
                type="number" min={0} max={23}
                value={hour}
                onChange={e => setHour(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={draftNow}
                onChange={e => setDraftNow(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <div className="text-sm">
                <p className="font-medium text-slate-700">Draft now (writes the article immediately)</p>
                <p className="text-xs text-slate-500">If off, the scheduler drafts it on the day you picked.</p>
              </div>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={e => setAutoPublish(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <div className="text-sm">
                <p className="font-medium text-slate-700">Publish automatically on the scheduled date</p>
                <p className="text-xs text-slate-500">Raises a GitHub PR and flips status to published. Otherwise stays as a draft for you to approve.</p>
              </div>
            </label>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t p-4">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !title.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {submitting ? <Clock className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {draftNow ? "Add + draft now" : "Add to plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar page ────────────────────────────────────────────────────────

export default function ContentCalendarPage() {
  const router = useRouter();
  const { effectiveTenantId, tenantClient } = useSite();
  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [scheduled, setScheduled] = useState<PlanItem[]>([]);
  const [pieces, setPieces] = useState<PublishedPiece[]>([]);
  const [unscheduled, setUnscheduled] = useState<PlanItem[]>([]);
  const [unscheduledLoading, setUnscheduledLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [addDate, setAddDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const activeRuns = useActiveRuns();

  const days = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const start = days[0];
  const end = days[days.length - 1];

  // `background` is set when the 5-second polling tick re-runs this while a
  // content-plan run is in flight. Skipping the loading toggle there keeps
  // the "Loading..." pill in the legend from strobing on every tick — that
  // flash is the bulk of the "laggy" feel reported on this page.
  const fetchRange = async ({ background = false }: { background?: boolean } = {}) => {
    if (!effectiveTenantId) return;
    if (!background) setLoading(true);
    setError(null);
    try {
      const url = `/api/content/plan/calendar?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(new Date(end.getTime() + 86400_000).toISOString())}`;
      const data = await tenantClient.get<{ scheduled?: PlanItem[]; published_pieces?: PublishedPiece[] }>(url);
      setScheduled(Array.isArray(data.scheduled) ? data.scheduled : []);
      setPieces(Array.isArray(data.published_pieces) ? data.published_pieces : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan");
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => { fetchRange(); /* eslint-disable-next-line */ }, [year, month, effectiveTenantId]);

  // Sidebar list of ideas the user hasn't placed on the calendar yet. The
  // backend returns every status='idea' row for the tenant; we filter to
  // those still missing a scheduled_for so the sidebar mirrors what is
  // actually un-placed. Independent of the visible month so dragging from
  // the sidebar onto any month works.
  const fetchUnscheduled = async ({ background = false }: { background?: boolean } = {}) => {
    if (!effectiveTenantId) return;
    if (!background) setUnscheduledLoading(true);
    try {
      const data = await tenantClient.get<{ items?: PlanItem[] }>(
        `/api/content/plan?status=idea`,
      );
      const items = Array.isArray(data.items) ? data.items : [];
      setUnscheduled(items.filter((it) => !it.scheduled_for));
    } catch (e) {
      console.error("Failed to fetch unscheduled ideas:", e);
    } finally {
      if (!background) setUnscheduledLoading(false);
    }
  };

  useEffect(() => { fetchUnscheduled(); /* eslint-disable-next-line */ }, [effectiveTenantId]);

  // While a content_plan run is in flight (e.g. user just clicked "Skapa
  // content-plan" on /c/analysis or in the modal here), keep refetching
  // the calendar so newly-created idea-rows show up without a manual
  // reload. Also refetch once when the run flips to completed.
  const lastContentRunCompletionRef = useRef<string | null>(null);
  const hasRunningContentRun = activeRuns.runs.some(
    (r) => r.agent === "content" && (r.status === "running" || r.status === "pending"),
  );
  useEffect(() => {
    if (!hasRunningContentRun) return;
    const id = setInterval(() => {
      fetchRange({ background: true });
      fetchUnscheduled({ background: true });
    }, 5000);
    return () => clearInterval(id);
    // fetchRange is stable enough for this purpose; intentionally not a dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRunningContentRun]);
  useEffect(() => {
    const justCompleted = activeRuns.runs.find(
      (r) => r.agent === "content" && r.status === "completed",
    );
    if (!justCompleted) return;
    if (lastContentRunCompletionRef.current === justCompleted.id) return;
    lastContentRunCompletionRef.current = justCompleted.id;
    fetchRange({ background: true });
    fetchUnscheduled({ background: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRuns.runs]);


  // "Finished" articles in the plan: drafts and approved pieces that have
  // been written but not yet published. The user is supposed to be able to
  // see these at the top of the calendar with cover image + score chip, the
  // same way the /c/content list renders polished article rows. Backend
  // enriches scheduled rows with the linked content_pieces fields so we
  // don't need a second round-trip here.
  const finishedArticles = useMemo(() => {
    return scheduled
      .filter((it) => {
        if (!it.content_piece_id) return false;
        const s = (it.piece_status || "").toLowerCase();
        // Fall back to plan-item status if backend didn't enrich (e.g.
        // pre-migration schemas) — plan status "draft" still flags a
        // piece that has a body but isn't published yet.
        if (s) return s === "draft" || s === "review" || s === "approved";
        return it.status === "draft";
      })
      .sort((a, b) => {
        const da = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
        const db = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
        return da - db;
      });
  }, [scheduled]);

  // Bucket items by YYYY-MM-DD so each cell can do an O(1) lookup.
  const itemsByDay = useMemo(() => {
    const map = new Map<string, { plan: PlanItem[]; published: PublishedPiece[] }>();
    for (const it of scheduled) {
      if (!it.scheduled_for) continue;
      const k = ymdKey(it.scheduled_for);
      if (!map.has(k)) map.set(k, { plan: [], published: [] });
      map.get(k)!.plan.push(it);
    }
    for (const p of pieces) {
      const when = p.published_at || p.created_at;
      if (!when) continue;
      const k = ymdKey(when);
      if (!map.has(k)) map.set(k, { plan: [], published: [] });
      map.get(k)!.published.push(p);
    }
    return map;
  }, [scheduled, pieces]);

  const goPrev = () => {
    const d = new Date(Date.UTC(year, month - 1, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  };
  const goNext = () => {
    const d = new Date(Date.UTC(year, month + 1, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  };
  const goToday = () => {
    setYear(today.getUTCFullYear());
    setMonth(today.getUTCMonth());
  };

  const handleItemClick = (it: PlanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(it);
  };

  const handlePieceClick = (p: PublishedPiece, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/c/content/article/${p.id}`);
  };

  const handleDayClick = (d: Date) => {
    setAddDate(d);
  };

  // ── Drag & drop chips between days ─────────────────────────────────────
  const handleDragStart = (it: PlanItem, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggingId(it.id);
    e.dataTransfer.effectAllowed = "move";
    // Some browsers require setData to actually fire drop events.
    try { e.dataTransfer.setData("text/plain", it.id); } catch { /* noop */ }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetKey(null);
  };

  const handleDayDragOver = (d: Date, e: React.DragEvent) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const k = ymdKey(d);
    if (dropTargetKey !== k) setDropTargetKey(k);
  };

  const handleDayDragLeave = (d: Date) => {
    if (dropTargetKey === ymdKey(d)) setDropTargetKey(null);
  };

  const handleDayDrop = async (d: Date, e: React.DragEvent) => {
    e.preventDefault();
    const id = draggingId || e.dataTransfer.getData("text/plain");
    setDropTargetKey(null);
    setDraggingId(null);
    if (!id) return;

    const fromScheduled = scheduled.find((it) => it.id === id);
    const fromUnscheduled = !fromScheduled
      ? unscheduled.find((it) => it.id === id)
      : null;
    const item = fromScheduled || fromUnscheduled;
    if (!item) return;
    if (item.scheduled_for && ymdKey(item.scheduled_for) === ymdKey(d)) return;

    // Preserve the original time-of-day; default to 09:00 UTC.
    const orig = item.scheduled_for ? new Date(item.scheduled_for) : null;
    const hh = orig ? orig.getUTCHours() : 9;
    const mm = orig ? orig.getUTCMinutes() : 0;
    const newIso = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm),
    ).toISOString();

    // Optimistic update so the chip moves immediately.
    const previousScheduled = scheduled;
    const previousUnscheduled = unscheduled;
    if (fromScheduled) {
      setScheduled((prev) =>
        prev.map((p) => (p.id === id ? { ...p, scheduled_for: newIso } : p)),
      );
    } else if (fromUnscheduled) {
      setUnscheduled((prev) => prev.filter((p) => p.id !== id));
      setScheduled((prev) => [...prev, { ...fromUnscheduled, scheduled_for: newIso }]);
    }
    setReschedulingId(id);
    setError(null);
    try {
      const data = await tenantClient.patch<{ success: boolean; error?: string; item?: PlanItem }>(
        `/api/content/plan/${id}`,
        { scheduled_for: newIso },
      );
      if (!data.success) throw new Error(data.error || "Kunde inte flytta");
      if (data.item) {
        setScheduled((prev) => prev.map((p) => (p.id === id ? { ...p, ...data.item! } : p)));
      }
    } catch (err) {
      setScheduled(previousScheduled);
      setUnscheduled(previousUnscheduled);
      setError(err instanceof Error ? err.message : "Kunde inte flytta idén");
    } finally {
      setReschedulingId(null);
    }
  };

  const todayKey = ymdKey(today);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              <CalendarIcon className="h-7 w-7 text-blue-600" /> Content Plan
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Click any day to schedule an article. Drafted on the date you pick — auto-published if you check the box.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/c/content" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              ← Back to content
            </Link>
            <button onClick={goToday} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Today
            </button>
            <div className="flex items-center rounded-md border border-slate-300 bg-white">
              <button onClick={goPrev} className="rounded-l-md p-1.5 text-slate-600 hover:bg-slate-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-medium text-slate-900">{MONTH_NAMES[month]} {year}</span>
              <button onClick={goNext} className="rounded-r-md p-1.5 text-slate-600 hover:bg-slate-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {finishedArticles.length > 0 && (
          <section className="mb-6 rounded-lg border bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">Färdiga artiklar</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {finishedArticles.length}
                </span>
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">
                Skrivna men inte publicerade än — klicka för att granska.
              </p>
            </div>
            <ul className="divide-y">
              {finishedArticles.map((it) => (
                <FinishedArticleRow
                  key={it.id}
                  item={it}
                  onEdit={() => setEditingItem(it)}
                />
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <div className="min-w-[640px]">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} className="px-3 py-2">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {days.map((d, idx) => {
              const inMonth = d.getUTCMonth() === month;
              const key = ymdKey(d);
              const bucket = itemsByDay.get(key);
              const isToday = key === todayKey;
              const isPast = key < todayKey;
              const isDropTarget = dropTargetKey === key && draggingId !== null;

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(d)}
                  onDragOver={(e) => handleDayDragOver(d, e)}
                  onDragLeave={() => handleDayDragLeave(d)}
                  onDrop={(e) => handleDayDrop(d, e)}
                  className={`group min-h-[140px] cursor-pointer border-b border-r p-2 transition-colors ${
                    inMonth ? "bg-white hover:bg-blue-50/40" : "bg-slate-50/50 text-slate-400"
                  } ${isToday ? "ring-2 ring-inset ring-blue-300" : ""} ${
                    isDropTarget ? "bg-blue-100/70 ring-2 ring-inset ring-blue-500" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-xs font-medium ${isToday ? "rounded-full bg-blue-600 px-1.5 py-0.5 text-white" : "text-slate-600"}`}>
                      {d.getUTCDate()}
                    </span>
                    {inMonth && !isPast && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setAddDate(d); }}
                        className="rounded p-0.5 text-slate-400 opacity-0 hover:bg-blue-100 hover:text-blue-700 group-hover:opacity-100"
                        title="Schedule content"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {bucket && (
                    <div className="space-y-1.5">
                      {bucket.plan.slice(0, 3).map(it => {
                        const isDragging = draggingId === it.id;
                        const isMoving = reschedulingId === it.id;
                        const thumb = it.featured_image_url;
                        return (
                        <div
                          key={it.id}
                          draggable
                          onDragStart={(e) => handleDragStart(it, e)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => handleItemClick(it, e)}
                          title={`${it.title}\n(drag to reschedule)`}
                          className={`group/chip flex w-full cursor-grab items-center gap-1 truncate rounded px-1.5 py-1 text-left text-[11px] active:cursor-grabbing ${
                            STATUS_BADGE[it.status] || STATUS_BADGE.idea
                          } ${isDragging ? "opacity-40" : ""} ${isMoving ? "animate-pulse" : ""}`}
                        >
                          <GripVertical className="h-2.5 w-2.5 flex-shrink-0 opacity-0 group-hover/chip:opacity-60" />
                          {thumb ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={thumb}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-3.5 w-3.5 flex-shrink-0 rounded-sm object-cover"
                            />
                          ) : (
                            typeIcon(it.content_type)
                          )}
                          <span className="truncate">{it.title}</span>
                          {typeof it.article_score === "number" && (
                            <span className="ml-auto flex-shrink-0 rounded-full bg-white/70 px-1 text-[9px] font-medium text-slate-600">
                              {it.article_score}
                            </span>
                          )}
                          {it.auto_publish_on_schedule && (
                            <Rocket className={`${typeof it.article_score === "number" ? "" : "ml-auto"} h-2.5 w-2.5 flex-shrink-0`} />
                          )}
                        </div>
                        );
                      })}
                      {bucket.published.slice(0, 2).map(p => {
                        const thumb = p.featured_image_url;
                        return (
                        <button
                          key={p.id}
                          onClick={(e) => handlePieceClick(p, e)}
                          title={p.title}
                          className="flex w-full items-center gap-1 truncate rounded bg-green-100 px-1.5 py-1 text-left text-[11px] text-green-700"
                        >
                          {thumb ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={thumb}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-3.5 w-3.5 flex-shrink-0 rounded-sm object-cover"
                            />
                          ) : (
                            <Rocket className="h-2.5 w-2.5 flex-shrink-0" />
                          )}
                          <span className="truncate">{p.title}</span>
                          {typeof p.article_score === "number" && (
                            <span className="ml-auto flex-shrink-0 rounded-full bg-white/70 px-1 text-[9px] font-medium text-green-800">
                              {p.article_score}
                            </span>
                          )}
                        </button>
                        );
                      })}
                      {bucket.plan.length + bucket.published.length > 5 && (
                        <p className="px-1 text-[10px] text-slate-400">
                          +{bucket.plan.length + bucket.published.length - 5} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-300" /> Idea
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" /> Draft
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" /> Published
          </span>
          <span className="inline-flex items-center gap-1">
            <Rocket className="h-3 w-3 text-slate-400" /> Auto-publish on date
          </span>
          {loading && (
            <span className="inline-flex items-center gap-1 text-blue-600">
              <Clock className="h-3 w-3 animate-spin" /> Loading...
            </span>
          )}
        </div>

        {/* Hint when empty */}
        {!loading && scheduled.length === 0 && pieces.length === 0 && (
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">No scheduled content this month</h3>
            <p className="mt-1 text-sm text-slate-500">
              Click a day to schedule an article, or head to <Link href="/c/content" className="font-medium text-blue-600 hover:underline">/c/content</Link> to generate ideas.
            </p>
          </div>
        )}
          </div>

          {/* Sidebar: ideas the user hasn't placed on the calendar yet. Drag
              one onto a day cell to schedule it. */}
          <aside className="w-full lg:sticky lg:top-6 lg:w-72 lg:flex-shrink-0">
            <div className="rounded-lg border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Unscheduled ideas
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Drag an idea onto a day in the calendar.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {unscheduled.length}
                </span>
              </div>

              <div className="max-h-[70vh] space-y-1.5 overflow-y-auto p-3">
                {unscheduledLoading && unscheduled.length === 0 && (
                  <div className="flex items-center justify-center py-6 text-xs text-slate-400">
                    <Clock className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Loading...
                  </div>
                )}
                {!unscheduledLoading && unscheduled.length === 0 && (
                  <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
                    No unscheduled ideas. Create a plan from an analysis, or schedule directly by clicking on a day.
                  </div>
                )}
                {unscheduled.map((it) => {
                  const isDragging = draggingId === it.id;
                  const isMoving = reschedulingId === it.id;
                  return (
                    <div
                      key={it.id}
                      draggable
                      onDragStart={(e) => handleDragStart(it, e)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setEditingItem(it)}
                      title={`${it.title}\n(drag onto a day to schedule)`}
                      className={`group/sidechip flex cursor-grab items-start gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-xs hover:border-blue-300 hover:bg-blue-50/40 active:cursor-grabbing ${
                        isDragging ? "opacity-40" : ""
                      } ${isMoving ? "animate-pulse" : ""}`}
                    >
                      <GripVertical className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-300 group-hover/sidechip:text-slate-500" />
                      <span className="mt-0.5 flex-shrink-0 text-slate-500">
                        {typeIcon(it.content_type)}
                      </span>
                      <span className="line-clamp-2 flex-1 text-slate-700">
                        {it.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {addDate && (
        <AddModal
          date={addDate}
          onClose={() => setAddDate(null)}
          onAdded={(item) => {
            setScheduled(prev => [...prev, item]);
          }}
          tenantClient={tenantClient}
        />
      )}

      <EditChipModal
        open={!!editingItem}
        item={editingItem as EditableChipItem | null}
        tenantClient={tenantClient}
        onClose={() => setEditingItem(null)}
        onSaved={(updated) => {
          setScheduled((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
          );
          setEditingItem((cur) => (cur && cur.id === updated.id ? { ...cur, ...updated } : cur));
        }}
        onDeleted={(id) => {
          setScheduled((prev) => prev.filter((p) => p.id !== id));
        }}
      />
    </div>
  );
}

// ── Finished-article row ────────────────────────────────────────────────
// Matches the row layout on /c/content (cover image + score chip + meta) so
// articles that have been written but not yet published get the same
// polished treatment when shown at the top of the calendar.

function FinishedArticleRow({
  item,
  onEdit,
}: {
  item: PlanItem;
  onEdit: () => void;
}) {
  const pieceId = item.content_piece_id;
  const articleHref = pieceId ? `/c/content/article/${pieceId}` : null;
  const score = typeof item.article_score === "number" ? item.article_score : null;
  const pieceStatus = (item.piece_status || item.status || "").toLowerCase();

  return (
    <li className="flex flex-col gap-3 p-4 hover:bg-slate-50/60 sm:flex-row sm:items-start sm:gap-4">
      {item.featured_image_url ? (
        articleHref ? (
          <Link
            href={articleHref}
            className="hidden shrink-0 overflow-hidden rounded-lg border border-slate-200 transition-colors hover:border-orange-300 sm:block"
            style={{ width: 96 }}
            title="Öppna artikelvy"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.featured_image_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-16 w-24 object-cover"
            />
          </Link>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.featured_image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="hidden h-16 w-24 shrink-0 rounded-lg border border-slate-200 object-cover sm:block"
          />
        )
      ) : (
        <div
          className="hidden h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-300 sm:flex"
          aria-hidden
        >
          <FileText className="h-5 w-5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {articleHref ? (
            <Link
              href={articleHref}
              className="truncate font-semibold text-slate-900 hover:text-orange-700"
            >
              {item.piece_title || item.title}
            </Link>
          ) : (
            <span className="truncate font-semibold text-slate-900">
              {item.piece_title || item.title}
            </span>
          )}
          {pieceStatus && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                STATUS_BADGE[pieceStatus] || STATUS_BADGE.draft
              }`}
            >
              {pieceStatus}
            </span>
          )}
          {item.auto_publish_on_schedule && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
              <Rocket className="h-3 w-3" />
              auto-publish
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            {typeIcon(item.content_type)}
            {item.content_type.replace(/_/g, " ")}
          </span>
          {item.target_keyword && (
            <span className="inline-flex items-center gap-1">
              <Search className="h-3 w-3" />
              {item.target_keyword}
            </span>
          )}
          {score !== null && articleHref && (
            <Link
              href={articleHref}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                score >= 85
                  ? "bg-green-50 text-green-700"
                  : score >= 65
                  ? "bg-lime-50 text-lime-700"
                  : score >= 40
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
              }`}
              title="Öppna artikelvy"
            >
              <Sparkles className="h-3 w-3" />
              Score {score}/100
            </Link>
          )}
          {item.scheduled_for && (
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {new Date(item.scheduled_for).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {articleHref && (
          <Link
            href={articleHref}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Visa
          </Link>
        )}
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          title="Redigera plan-rad"
        >
          <Wand2 className="h-3 w-3" />
        </button>
      </div>
    </li>
  );
}
