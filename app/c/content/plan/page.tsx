"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Plus, Clock, FileText, MessageSquare, Mail, BarChart3,
  Sparkles, Rocket, X, ArrowRight, Calendar as CalendarIcon, Wand2, Lightbulb,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import CreateContentPlanModal from "@/components/CreateContentPlanModal";
import { samaFetch } from "@/lib/api";
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
}

function AddModal({ date, onClose, onAdded }: AddModalProps) {
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
      const res = await samaFetch(`/api/content/plan/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          topic: topic.trim() || undefined,
          target_keyword: keyword.trim() || undefined,
          content_type: contentType,
          priority,
          scheduled_for: isoForDay(date, hour, 0),
          auto_publish_on_schedule: autoPublish,
          draft_now: draftNow,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to add to plan");

      onAdded(data.item);
      // If we drafted right now, jump straight into the editor.
      if (draftNow && data.content_piece_id) {
        router.push(`/c/content/${data.content_piece_id}`);
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
  const { effectiveTenantId } = useSite();
  const { runs: activeRuns } = useActiveRuns();
  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [scheduled, setScheduled] = useState<PlanItem[]>([]);
  const [pieces, setPieces] = useState<PublishedPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDate, setAddDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestAnalysisId, setLatestAnalysisId] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const days = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const start = days[0];
  const end = days[days.length - 1];

  const fetchRange = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/content/plan/calendar?start=${start.toISOString()}&end=${new Date(end.getTime() + 86400_000).toISOString()}`;
      const res = await samaFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setScheduled(Array.isArray(data.scheduled) ? data.scheduled : []);
      setPieces(Array.isArray(data.published_pieces) ? data.published_pieces : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRange(); /* eslint-disable-next-line */ }, [year, month]);

  // While a content_plan run is in flight (e.g. user just clicked "Skapa
  // content-plan" on /c/analysis or in the modal here), keep refetching
  // the calendar so newly-created idea-rows show up without a manual
  // reload. Also refetch once when the run flips to completed.
  const lastContentRunCompletionRef = useRef<string | null>(null);
  const hasRunningContentRun = activeRuns.some(
    (r) => r.agent === "content" && (r.status === "running" || r.status === "pending"),
  );
  useEffect(() => {
    if (!hasRunningContentRun) return;
    const id = setInterval(() => {
      fetchRange();
    }, 5000);
    return () => clearInterval(id);
    // fetchRange is stable enough for this purpose; intentionally not a dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRunningContentRun]);
  useEffect(() => {
    const justCompleted = activeRuns.find(
      (r) => r.agent === "content" && r.status === "completed",
    );
    if (!justCompleted) return;
    if (lastContentRunCompletionRef.current === justCompleted.id) return;
    lastContentRunCompletionRef.current = justCompleted.id;
    fetchRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRuns]);

  // Look up the most recent completed analysis run so the "Skapa plan från
  // analys" button knows which run to pass into CreateContentPlanModal.
  // Goes through /api/analysis/runs (Next.js route) which already merges
  // backend + locally-saved runs, so this works even when the agent
  // backend is paused.
  useEffect(() => {
    if (!effectiveTenantId) return;
    const ctrl = new AbortController();
    fetch(`/api/analysis/runs?limit=20`, {
      headers: { "X-Tenant-ID": effectiveTenantId },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const runs = Array.isArray(data?.runs) ? data.runs : [];
        const completed = runs.find(
          (r: { id?: string; status?: string }) =>
            r?.id && (r.status === "completed" || !r.status),
        );
        if (completed?.id) setLatestAnalysisId(completed.id as string);
      })
      .catch(() => { /* offline / unauth — button stays disabled */ });
    return () => ctrl.abort();
  }, [effectiveTenantId]);

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
    if (it.content_piece_id) {
      router.push(`/c/content/${it.content_piece_id}`);
    } else {
      // No body yet — this is an idea waiting for the user to approve it.
      // Send them straight to the Idéer tab where they can approve/edit/
      // archive it instead of dropping them on the generic content page.
      router.push(`/c/content?tab=ideas`);
    }
  };

  const handlePieceClick = (p: PublishedPiece, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/c/content/${p.id}`);
  };

  const handleDayClick = (d: Date) => {
    setAddDate(d);
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
            {latestAnalysisId ? (
              <button
                onClick={() => setShowPlanModal(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:from-violet-700 hover:to-blue-700"
                title="Skapa hela 90-dagarsplanen från senaste analys"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Skapa plan från analys
              </button>
            ) : (
              <Link
                href="/c/analysis"
                className="inline-flex items-center gap-1.5 rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
                title="Kör en analys först för att kunna skapa en plan"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Kör analys först
              </Link>
            )}
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

        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
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

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(d)}
                  className={`group min-h-[110px] cursor-pointer border-b border-r p-2 transition-colors ${
                    inMonth ? "bg-white hover:bg-blue-50/40" : "bg-slate-50/50 text-slate-400"
                  } ${isToday ? "ring-2 ring-inset ring-blue-300" : ""}`}
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
                    <div className="space-y-1">
                      {bucket.plan.slice(0, 3).map(it => (
                        <button
                          key={it.id}
                          onClick={(e) => handleItemClick(it, e)}
                          title={it.title}
                          className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] ${STATUS_BADGE[it.status] || STATUS_BADGE.idea}`}
                        >
                          {typeIcon(it.content_type)}
                          <span className="truncate">{it.title}</span>
                          {it.auto_publish_on_schedule && (
                            <Rocket className="ml-auto h-2.5 w-2.5 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                      {bucket.published.slice(0, 2).map(p => (
                        <button
                          key={p.id}
                          onClick={(e) => handlePieceClick(p, e)}
                          title={p.title}
                          className="flex w-full items-center gap-1 truncate rounded bg-green-100 px-1.5 py-0.5 text-left text-[11px] text-green-700"
                        >
                          <Rocket className="h-2.5 w-2.5 flex-shrink-0" />
                          <span className="truncate">{p.title}</span>
                        </button>
                      ))}
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
      </main>

      {addDate && (
        <AddModal
          date={addDate}
          onClose={() => setAddDate(null)}
          onAdded={(item) => {
            setScheduled(prev => [...prev, item]);
          }}
        />
      )}

      {showPlanModal && latestAnalysisId && effectiveTenantId && (
        <CreateContentPlanModal
          analysisRunId={latestAnalysisId}
          tenantId={effectiveTenantId}
          onClose={() => setShowPlanModal(false)}
          onSuccess={() => {
            // Plan items land in agent_runs and get inserted asynchronously.
            // Re-poll the calendar so they show up as soon as the background
            // task starts writing rows. The user lands on a "Plan skapas!"
            // success state inside the modal.
            void fetchRange();
          }}
        />
      )}
    </div>
  );
}
