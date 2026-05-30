"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText, Plus, Loader2, Calendar, Hash, CheckCircle,
  PenTool, Search, X, Sparkles, Save, AlertCircle,
  Maximize2, Minimize2, Send, Eye,
  ArrowRight, Archive, ShieldCheck, BarChart2, Target,
  CalendarPlus, Lightbulb, MessageSquare, Mail, Trash2, Edit3,
} from "lucide-react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import PublishDialog from "@/components/PublishDialog";
import PiecePerformance from "@/components/content/PiecePerformance";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { useActiveRuns } from "@/lib/hooks/useActiveRuns";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { IS_DEMO, demoContentPieces } from "@/lib/demo-data";
import AutoApproveToggle from "@/components/content/AutoApproveToggle";
import AutopilotSettings from "@/components/content/AutopilotSettings";

interface ContentTopicSuggestion {
  topic: string;
  type: string;
  reason: string;
}

interface ContentPiece {
  id: string;
  title: string;
  type?: string;
  // Backend column name (`content_pieces.content_type`). Older code wrote
  // `type` optimistically; we now read both so the type pill renders
  // correctly regardless of source.
  content_type?: string;
  status: string;
  word_count: number;
  target_keyword: string;
  created_at?: string;
  // Premium article fields (populated by the structured writer; older
  // pieces have these as null and the UI degrades gracefully).
  slug?: string | null;
  featured_image_url?: string | null;
  article_score?: number | null;
  // Publish date pinned on the linked content_plan_items row. The pieces
  // endpoint may not enrich this, so fetchContent backfills it from the plan
  // calendar — without it an approved piece looks unscheduled and the
  // auto-publish bridge (which requires scheduled_for) never picks it up.
  scheduled_for?: string | null;
  // Sprint 2 (K-3 / K-6) — backreferences to the surface that motivated the
  // piece, so the article card can show "Skapad från lucka …" / "Skapad
  // utifrån strategi-topic …".
  source_gap_id?: string | null;
  source_gap_title?: string | null;
  source_strategy_topic?: string | null;
}

// A row in content_plan_items with status='idea' — i.e. an unwritten
// suggestion that the analysis surfaced. The body is produced only when
// the user approves the idea (POST /api/content/plan/{id}/draft).
interface PlanIdea {
  id: string;
  title: string;
  topic?: string | null;
  content_type: string;
  target_keyword?: string | null;
  pillar?: string | null;
  reason?: string | null;
  priority?: string | null;
  status: string;
  source?: string | null;
  scheduled_for: string | null;
  parent_plan_item_id?: string | null;
  metadata?: {
    gap_type?: string;
    platform?: string;
    parent_article_title?: string;
    angle?: string;
  } | null;
}

function ContentShellSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="h-8 w-40 rounded-lg bg-slate-200 animate-pulse" />
            <div className="mt-2 h-4 w-64 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="hidden sm:flex gap-2">
            <div className="h-10 w-32 rounded-lg bg-slate-200 animate-pulse" />
            <div className="h-10 w-32 rounded-lg bg-slate-200 animate-pulse" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
              <div className="mt-3 h-7 w-16 rounded bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border bg-white shadow-sm animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}

export default function CustomerContentPage() {
  return (
    <Suspense fallback={<ContentShellSkeleton />}>
      <CustomerContentInner />
    </Suspense>
  );
}

function CustomerContentInner() {
  const { t } = useLanguage();
  const { user, loading: userLoading } = useUser();
  const { tenantClient, effectiveTenantId, activeSite } = useSite();
  const { runs: activeRuns } = useActiveRuns();
  const searchParams = useSearchParams();
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tabs across the top of the content list. "ideas" surfaces plan items
  // that haven't been drafted yet (status='idea' on content_plan_items),
  // because the new plan-creator stops at idea-rows and lets the user
  // approve them one at a time. Default lands on Ideas when at least one
  // is waiting; otherwise we drop the user back into "to_review" as
  // before.
  const [filter, setFilter] = useState<"ideas" | "to_review" | "scheduled" | "published" | "archived">("to_review");
  const [ideas, setIdeas] = useState<PlanIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  // Plan items currently being drafted in the background. The
  // /plan/{id}/draft endpoint returns immediately now, so we track
  // pending draft IDs here and poll the lists until the new piece
  // surfaces (cascade can take 30-90s once social children are
  // included). Cap the polling window so a silently-dropped task
  // doesn't keep us hammering the API forever.
  const [draftingIds, setDraftingIds] = useState<Set<string>>(new Set());
  const [editingIdea, setEditingIdea] = useState<PlanIdea | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editKeyword, setEditKeyword] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [ideaToast, setIdeaToast] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"linkedin" | "blogg" | "epost">("linkedin");
  const [modalTopic, setModalTopic] = useState("");
  const [modalGenerating, setModalGenerating] = useState(false);
  const [modalContent, setModalContent] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalFullscreen, setModalFullscreen] = useState(false);
  // Sprint 2 (K-1 / K-4) — pre-fill state when arriving from a gap on
  // Insikter or a topic on Strategi.
  const [sourceGap, setSourceGap] = useState<{ id: string; title: string } | null>(null);
  const [sourceStrategyTopic, setSourceStrategyTopic] = useState<string | null>(null);
  const [cmsDialog, setCmsDialog] = useState<{ piece: ContentPiece; body: string } | null>(null);
  const [loadingBodyId, setLoadingBodyId] = useState<string | null>(null);
  const [viewDialog, setViewDialog] = useState<{ piece: ContentPiece; body: string } | null>(null);
  const [loadingViewId, setLoadingViewId] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [expandedPerf, setExpandedPerf] = useState<Set<string>>(new Set());
  // Calendar scheduling: when set, the date-picker dialog is open for this
  // piece. Saving creates a content_plan_items row that links to the piece
  // so it shows up in /c/content/plan.
  const [schedulingPiece, setSchedulingPiece] = useState<ContentPiece | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  // Mirrors user_sites.settings.content_autopilot.auto_publish — same row
  // the cron reads. Derived directly from useSite() so toggling the
  // AutoApproveToggle (which writes to the same row) updates this in place.
  const autoPublish =
    ((activeSite?.settings as Record<string, unknown> | undefined)?.content_autopilot as
      | { auto_publish?: boolean }
      | undefined)?.auto_publish === true;

  const TYPE_LABELS: Record<string, string> = {
    linkedin_post: t.content.typeLinkedin,
    linkedin: t.content.typeLinkedin,
    blog_post: t.content.typeBlog,
    blog: t.content.typeBlog,
    blogg: t.content.typeBlog,
    email: t.content.typeEmail,
    epost: t.content.typeEmail,
    faq: t.content.typeFaq,
    faq_page: t.content.typeFaq,
    landing_page: t.content.typeLanding,
    landing: t.content.typeLanding,
    comparison: t.content.typeComparison,
    product_page: t.content.typeProduct,
    guide: t.content.typeGuide,
    case_study: t.content.typeCase,
  };

  const formatTypeLabel = (type: string | undefined): string => {
    if (!type) return t.content.typeFallback;
    return TYPE_LABELS[type.toLowerCase()] || type;
  };

  const nextStatusLabel = (s: string) => {
    if (s === "draft" || s === "review") return t.content.actionApprove;
    if (s === "approved") return t.content.actionMarkPublished;
    return null;
  };

  useEffect(() => {
    if (user && effectiveTenantId) fetchContent();
  }, [user, effectiveTenantId]);

  // While a content_plan run is in flight (e.g. user just clicked
  // "Skapa content-plan" on /c/analysis and navigated here), keep
  // refetching ideas so the new rows appear without a manual reload.
  // Also do one final fetch right when the run flips to completed.
  const lastContentRunCompletionRef = useRef<string | null>(null);
  const hasRunningContentRun = activeRuns.some(
    (r) => r.agent === "content" && (r.status === "running" || r.status === "pending"),
  );
  useEffect(() => {
    if (!user || !effectiveTenantId) return;
    if (!hasRunningContentRun) return;
    const id = setInterval(() => {
      fetchIdeas({ background: true });
    }, 5000);
    return () => clearInterval(id);
    // fetchIdeas is stable enough for this purpose; intentionally not a dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveTenantId, hasRunningContentRun]);
  useEffect(() => {
    const justCompleted = activeRuns.find(
      (r) => r.agent === "content" && r.status === "completed",
    );
    if (!justCompleted) return;
    if (lastContentRunCompletionRef.current === justCompleted.id) return;
    lastContentRunCompletionRef.current = justCompleted.id;
    if (user && effectiveTenantId) fetchIdeas({ background: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRuns, user, effectiveTenantId]);

  // Sprint 2 (K-1 / K-4) — when arriving with ?gap=… or ?topic=…, open the
  // modal pre-filled with the brief from the originating surface.
  useEffect(() => {
    const gap = searchParams.get("gap");
    const gapTitle = searchParams.get("gap_title");
    const topic = searchParams.get("topic");
    const strategyTopic = searchParams.get("strategy_topic");
    if (gap && gapTitle) {
      setSourceGap({ id: gap, title: gapTitle });
    }
    if (strategyTopic) {
      setSourceStrategyTopic(strategyTopic);
    }
    if (gap || topic || strategyTopic) {
      setShowModal(true);
      setModalType("blogg");
      setModalTopic(topic || gapTitle || strategyTopic || "");
    }
    // /c/content?tab=ideas — landed here after creating a content plan.
    const tab = searchParams.get("tab");
    if (tab === "ideas") {
      setFilter("ideas");
      setAutoSwitchedToIdeas(true);
    }
  }, [searchParams]);

useEffect(() => {
    if (!user || !effectiveTenantId) return;
    setPendingApprovalsCount(0);
    (async () => {
      try {
        const res = await fetch("/api/approvals?status=pending", {
          headers: { "X-Tenant-ID": effectiveTenantId },
        });
        if (res.ok) {
          const data = (await res.json()) as { approvals?: unknown[] };
          setPendingApprovalsCount(data.approvals?.length ?? 0);
        }
      } catch {
        /* silent — banner just won't show */
      }
    })();
  }, [user, effectiveTenantId]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const [triggering, setTriggering] = useState(false);
  // Surfaced when the plan-calendar fetch fails — pieces show up unscheduled
  // and the auto-publish bridge won't pick them up, so the user needs to
  // know rather than silently see empty "Schemalagda" tab.
  const [scheduleBackfillError, setScheduleBackfillError] = useState<string | null>(null);

  const triggerAutopilot = async () => {
    if (!activeSite || triggering) return;
    setTriggering(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/autopilot/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: activeSite.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setIdeaToast("Autopilot startad — nya idéer kommer dyka upp inom någon minut");
      setTimeout(() => setIdeaToast(null), 6000);
      // Kick off polling on next render via the ideas useEffect tied to
      // hasRunningContentRun; meanwhile, refresh now so the user sees
      // something happens immediately if the backend was already fast.
      void fetchIdeas({ background: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte starta autopilot");
    } finally {
      setTriggering(false);
    }
  };

  const fetchContent = async ({ background = false }: { background?: boolean } = {}) => {
    if (!user) return;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const client = tenantClient;
      // Fetch pieces and the plan calendar together. The calendar carries the
      // scheduled_for date per linked piece, which the pieces endpoint doesn't
      // reliably include — we merge it in so the "Schemalagda" tab can show
      // the real publish date instead of nothing.
      const now = Date.now();
      const calStart = new Date(now - 180 * 86_400_000).toISOString();
      const calEnd = new Date(now + 180 * 86_400_000).toISOString();
      const piecesPromise = client.get<{ pieces?: ContentPiece[] }>("/api/content/pieces");
      const calPromise = client
        .get<{ scheduled?: { content_piece_id?: string | null; scheduled_for?: string | null }[] }>(
          `/api/content/plan/calendar?start=${encodeURIComponent(calStart)}&end=${encodeURIComponent(calEnd)}`,
        )
        .then((d) => {
          setScheduleBackfillError(null);
          return d;
        })
        .catch((err: unknown) => {
          // Surface the failure — without the calendar backfill the
          // "Schemalagda" tab looks empty and the auto-publish bridge
          // (which needs scheduled_for) won't pick the pieces up. Better
          // to show a banner than to pretend everything is fine.
          const msg = err instanceof Error ? err.message : "okänt fel";
          setScheduleBackfillError(`Kunde inte ladda schemainfo: ${msg}`);
          return { scheduled: [] as { content_piece_id?: string | null; scheduled_for?: string | null }[] };
        });
      const [piecesData, calData] = await Promise.all([piecesPromise, calPromise]);
      const pcs = piecesData.pieces || [];
      const scheduledByPiece = new Map<string, string>();
      for (const r of calData.scheduled || []) {
        if (r.content_piece_id && r.scheduled_for && !scheduledByPiece.has(r.content_piece_id)) {
          scheduledByPiece.set(r.content_piece_id, r.scheduled_for);
        }
      }
      const enriched =
        scheduledByPiece.size > 0
          ? pcs.map((p) =>
              p.scheduled_for ? p : { ...p, scheduled_for: scheduledByPiece.get(p.id) ?? null },
            )
          : pcs;
      setPieces(enriched.length > 0 ? enriched : IS_DEMO ? demoContentPieces : []);
    } catch (err: any) {
      console.error("Failed to fetch content:", err);
      if (IS_DEMO) {
        setPieces(demoContentPieces);
      } else if (!background) {
        setError(t.content.errorFetch);
      }
    }
    if (!background) setLoading(false);
    fetchIdeas({ background });
  };

  // `background` is set when the 5-second polling tick re-runs this while a
  // content run is in flight. Skipping the loader toggle there keeps the
  // ideas list from flashing a spinner on every tick.
  const fetchIdeas = async ({ background = false }: { background?: boolean } = {}) => {
    if (!user) return;
    if (!background) setIdeasLoading(true);
    try {
      const client = tenantClient;
      const data = await client.get<{ items?: PlanIdea[] }>(
        "/api/content/plan?status=idea",
      );
      const sorted = (data.items || []).slice().sort((a, b) => {
        const ta = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Infinity;
        const tb = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Infinity;
        return ta - tb;
      });
      setIdeas(sorted);
    } catch (err) {
      console.error("Failed to fetch ideas:", err);
      setIdeas([]);
    }
    if (!background) setIdeasLoading(false);
  };

  // The first time we land on the page with ideas waiting, default the
  // user into the Ideas tab. Don't override an explicit user choice.
  const [autoSwitchedToIdeas, setAutoSwitchedToIdeas] = useState(false);
  useEffect(() => {
    if (autoSwitchedToIdeas) return;
    if (ideas.length > 0 && filter === "to_review") {
      setFilter("ideas");
      setAutoSwitchedToIdeas(true);
    }
  }, [ideas.length, filter, autoSwitchedToIdeas]);

  // After approving the last idea, the Ideas tab is empty but the freshly
  // drafted pieces land on "Att granska". Move the user there so they can
  // see their work instead of staring at an empty list.
  useEffect(() => {
    if (filter !== "ideas") return;
    if (ideas.length > 0) return;
    if (draftingIds.size === 0) return;
    setFilter("to_review");
  }, [filter, ideas.length, draftingIds]);

  const approveIdea = async (idea: PlanIdea) => {
    if (!user) return;
    setApprovingId(idea.id);
    try {
      const client = tenantClient;
      // Backend now returns immediately ({status: "drafting"}) and runs
      // the LLM call (article + social cascade) in a background task.
      // The previous synchronous flow blocked for 30-90s, regularly
      // exceeding the proxy timeout and leaving the spinner stuck.
      await client.post(
        `/api/content/plan/${idea.id}/draft`,
        {},
        { headers: { "X-Sama-Intent": "user-action" } },
      );
      // Drop the idea from the local list right away — its plan_item
      // status is now 'drafting', which fetchIdeas (status=idea) won't
      // return anyway. The polling effect below picks up the finished
      // piece in /content/pieces when the cascade completes.
      setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
      setDraftingIds((prev) => {
        const next = new Set(prev);
        next.add(idea.id);
        return next;
      });
      setIdeaToast(`"${idea.title}" ${t.content.ideaApproved}`);
      setTimeout(() => setIdeaToast(null), 6000);
    } catch (err: any) {
      setError(`${err?.message || "Could not approve the idea"}`);
    } finally {
      setApprovingId(null);
    }
  };

  // While there are ideas drafting in the background, refresh the lists
  // every 5s so the new piece surfaces without a manual reload. Cap the
  // window at 3 minutes per approve to bound the polling — a cascade
  // that hasn't finished by then has almost certainly failed silently.
  useEffect(() => {
    if (!user || !effectiveTenantId) return;
    if (draftingIds.size === 0) return;
    const tick = setInterval(() => {
      fetchIdeas({ background: true });
      fetchContent({ background: true });
    }, 5000);
    const stop = setTimeout(() => {
      setDraftingIds(new Set());
    }, 180_000);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
    // fetchIdeas/fetchContent are stable closures over user; safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveTenantId, draftingIds]);

  const archiveIdea = async (idea: PlanIdea) => {
    if (!user) return;
    try {
      const client = tenantClient;
      await client.patch(`/api/content/plan/${idea.id}`, { status: "archived" });
      setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
      setIdeaToast(`"${idea.title}" ${t.content.ideaArchived}`);
      setTimeout(() => setIdeaToast(null), 4000);
    } catch (err: any) {
      setError(`${err?.message || "Kunde inte arkivera"}`);
    }
  };

  const openEditIdea = (idea: PlanIdea) => {
    setEditingIdea(idea);
    setEditTitle(idea.title);
    setEditTopic(idea.topic || "");
    setEditKeyword(idea.target_keyword || "");
    if (idea.scheduled_for) {
      // Convert ISO → datetime-local string in user's local timezone.
      const d = new Date(idea.scheduled_for);
      const pad = (n: number) => String(n).padStart(2, "0");
      setEditDate(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
    } else {
      setEditDate("");
    }
  };

  const closeEditIdea = () => {
    setEditingIdea(null);
    setEditSaving(false);
  };

  const submitEditIdea = async () => {
    if (!editingIdea || !user) return;
    setEditSaving(true);
    try {
      const client = tenantClient;
      const body: Record<string, unknown> = {
        title: editTitle.trim() || editingIdea.title,
        topic: editTopic.trim() || null,
        target_keyword: editKeyword.trim() || null,
      };
      if (editDate) {
        body.scheduled_for = new Date(editDate).toISOString();
      }
      await client.patch(`/api/content/plan/${editingIdea.id}`, body);
      setIdeaToast(`"${body.title}" ${t.content.ideaUpdated}`);
      setTimeout(() => setIdeaToast(null), 4000);
      closeEditIdea();
      await fetchIdeas();
    } catch (err: any) {
      setError(`${err?.message || "Kunde inte spara"}`);
      setEditSaving(false);
    }
  };

  const generateInModal = async () => {
    if (!user || !modalTopic.trim()) return;
    setModalGenerating(true);
    setModalContent("");
    try {
      const client = tenantClient;
      const result = await client.post<{
        title?: string;
        body?: string;
        content?: string;
        suggestions?: string[];
      }>(
        "/api/content/generate",
        { type: modalType, topic: modalTopic },
        { headers: { "X-Sama-Intent": "user-action" } },
      );
      const generated = result.body || result.content || "";
      if (!generated) {
        const detail = result.suggestions?.[0] || "The AI returned no content.";
        setError(`Could not generate: ${detail}`);
      } else {
        setModalContent(generated);
      }
    } catch (err: any) {
      setError(`Could not generate: ${err?.message || err}`);
    }
    setModalGenerating(false);
  };

  const saveModalDraft = async () => {
    if (!user || !modalContent) return;
    setModalSaving(true);
    // Backend column is `content_type` — the previous "type" field was
    // silently dropped, so every saved piece defaulted to blog_article.
    const dbType =
      modalType === "blogg" ? "blog_post" : modalType === "epost" ? "email" : "linkedin_post";
    try {
      const client = tenantClient;
      await client.post("/api/content/pieces", {
        title: modalTopic,
        content_type: dbType,
        content: modalContent,
        status: "draft",
        word_count: modalContent.split(/\s+/).filter(Boolean).length,
        source_gap_id: sourceGap?.id ?? null,
        source_gap_title: sourceGap?.title ?? null,
        source_strategy_topic: sourceStrategyTopic ?? null,
      });
    } catch {
      // Optimistic
    }
    // Add optimistically to the list
    setPieces((prev) => [
      {
        id: `local-${Date.now()}`,
        title: modalTopic,
        content_type: dbType,
        type: dbType,
        status: "draft",
        word_count: modalContent.split(/\s+/).filter(Boolean).length,
        target_keyword: "",
        created_at: new Date().toISOString(),
        source_gap_id: sourceGap?.id ?? null,
        source_gap_title: sourceGap?.title ?? null,
        source_strategy_topic: sourceStrategyTopic ?? null,
      },
      ...prev,
    ]);
    setModalSaving(false);
    setShowModal(false);
    setModalTopic("");
    setModalContent("");
    setSourceGap(null);
    setSourceStrategyTopic(null);
    // Pull the canonical row from the server so the local-* placeholder is
    // replaced with a real piece.
    fetchContent();
  };

  // One pass over `pieces` for all the counts + total words. With ~200
  // drafts the previous code did six full scans on every render — and
  // every keystroke in the modal/toast inputs forced a re-render of this
  // top-level component, so the perceived input lag was real.
  const counts = useMemo(() => {
    let draft = 0, review = 0, approved = 0, published = 0, archived = 0, words = 0;
    for (const p of pieces) {
      if (p.status === "draft") draft++;
      else if (p.status === "review") review++;
      else if (p.status === "approved") approved++;
      else if (p.status === "published") published++;
      else if (p.status === "archived") archived++;
      words += p.word_count || 0;
    }
    return { draft, review, approved, published, archived, words };
  }, [pieces]);
  const draftCount = counts.draft;
  const reviewCount = counts.review;
  const approvedCount = counts.approved;
  const publishedCount = counts.published;
  const archivedCount = counts.archived;
  const totalWords = counts.words;

  const filtered = useMemo(() => {
    const list = pieces.filter((p) => {
      if (filter === "to_review") return p.status === "draft" || p.status === "review";
      if (filter === "scheduled") return p.status === "approved";
      return p.status === filter;
    });
    // In the "Schemalagda" tab, surface pieces that actually have a date first
    // (chronological); unscheduled approved pieces sink to the bottom — they
    // still need a date before the auto-publish bridge will touch them.
    if (filter === "scheduled") {
      return list.slice().sort((a, b) => {
        const ta = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Infinity;
        const tb = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Infinity;
        return ta - tb;
      });
    }
    return list;
  }, [pieces, filter]);

  // Workflow arrow button. Stops at "approved" — the next step is
  // scheduling and/or publishing, which has its own dedicated buttons
  // (Schemalägg, Publicera till sajten, Publicera via GitHub). Mapping
  // approved → published here would surface a third "publish" action
  // next to those two, which is what made the row feel illogical.
  const STATUS_FLOW: Record<string, string> = {
    draft: "approved",
    review: "approved",
  };

  const updateStatus = async (pieceId: string, newStatus: string) => {
    if (!user) return;
    setUpdatingStatus(pieceId);
    // Optimistic update
    setPieces((prev) =>
      prev.map((p) => (p.id === pieceId ? { ...p, status: newStatus } : p))
    );
    try {
      const client = tenantClient;
      if (!pieceId.startsWith("local-")) {
        await client.patch(`/api/content/pieces/${pieceId}`, { status: newStatus });
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      setError(`Kunde inte uppdatera status: ${err?.message || err}`);
      // Re-fetch to revert on error
      fetchContent();
    }
    setUpdatingStatus(null);
  };

  const archivePiece = async (pieceId: string) => {
    await updateStatus(pieceId, "archived");
  };

  const deletePiece = async (pieceId: string) => {
    if (!user) return;
    if (!confirm("Delete this content permanently? This cannot be undone.")) return;
    setUpdatingStatus(pieceId);
    setPieces((prev) => prev.filter((p) => p.id !== pieceId));
    try {
      const client = tenantClient;
      if (!pieceId.startsWith("local-")) {
        await client.delete(`/api/content/pieces/${pieceId}`);
      }
    } catch (err: any) {
      console.error("Failed to delete piece:", err);
      setError(`Could not delete: ${err?.message || err}`);
      fetchContent();
    }
    setUpdatingStatus(null);
  };

  const emptyArchive = async () => {
    if (!user) return;
    if (!confirm("Empty the archive? All archived material will be permanently deleted and cannot be restored.")) return;
    try {
      const client = tenantClient;
      // Hard-delete archived rows in both tables in parallel: pieces
      // (the visible "Arkiverade"-tab) and plan items (archived ideas
      // that lingered on the calendar).
      await Promise.all([
        client.delete(`/api/content/pieces/archived`),
        client.delete(`/api/content/plan/archived`),
      ]);
      setPieces((prev) => prev.filter((p) => p.status !== "archived"));
      setIdeaToast("The archive is empty.");
      setTimeout(() => setIdeaToast(null), 4000);
    } catch (err: any) {
      console.error("Failed to empty archive:", err);
      setError(`Could not empty archive: ${err?.message || err}`);
      fetchContent();
    }
  };

  // Default the date picker to "tomorrow at 09:00 local" when the dialog
  // opens, and reset all transient state on close.
  const openScheduleDialog = (piece: ContentPiece) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setScheduleDate(local);
    setScheduleError(null);
    setSchedulingPiece(piece);
  };

  const closeScheduleDialog = () => {
    setSchedulingPiece(null);
    setScheduleDate("");
    setScheduleError(null);
    setScheduleSaving(false);
  };

  const submitSchedule = async () => {
    if (!schedulingPiece || !scheduleDate) return;
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      // POST through tenantClient (proxy validates session and tenant).
      const client = tenantClient;
      const dbType =
        schedulingPiece.content_type ||
        schedulingPiece.type ||
        "blog_article";
      // Local datetime-local input → UTC ISO so the backend stores tz-aware.
      const scheduledIso = new Date(scheduleDate).toISOString();
      const res = await client.post<{ success: boolean; error?: string }>(
        "/api/content/plan",
        {
          title: schedulingPiece.title,
          content_type: dbType,
          target_keyword: schedulingPiece.target_keyword || undefined,
          content_piece_id: schedulingPiece.id.startsWith("local-")
            ? undefined
            : schedulingPiece.id,
          source: "manual",
          status: "draft",
          scheduled_for: scheduledIso,
        },
      );
      if (res && res.success === false) {
        throw new Error(res.error || "Could not schedule");
      }
      setScheduleSuccess(
        `"${schedulingPiece.title}" was added to the plan on ${new Date(
          scheduledIso,
        ).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`,
      );
      closeScheduleDialog();
      setTimeout(() => setScheduleSuccess(null), 6000);
      // The backend may have updated an existing plan row (the one created
      // from the originating idea) rather than inserting a new one — refetch
      // so the calendar/ideas lists show the new scheduled_for.
      fetchContent();
    } catch (e: any) {
      setScheduleError(e?.message || "Could not schedule");
    } finally {
      setScheduleSaving(false);
    }
  };

  // Sprint 3 (C-6 / SET-4) — "Skicka via mail" handoff.
  const sendByMail = async (piece: ContentPiece) => {
    if (!user) return;
    setLoadingBodyId(piece.id);
    let body = "";
    let recipient = "";
    let recipientName = "";
    try {
      const client = tenantClient;
      const data = await client.get<{ piece?: { body?: string; content?: string; markdown?: string } }>(
        `/api/content/pieces/${piece.id}`,
      );
      body = data.piece?.body || data.piece?.content || data.piece?.markdown || "";
    } catch {
      // fall through with empty body
    }
    try {
      const sb = (await import("@/lib/supabase-browser")).getSupabaseBrowser();
      const { data } = await sb
        .from("user_settings")
        .select("settings")
        .eq("user_id", user.id)
        .maybeSingle();
      recipient = data?.settings?.publish_email_recipient || "";
      recipientName = data?.settings?.publish_email_recipient_name || "";
    } catch {
      // settings not configured — open mailto with empty `to`
    }
    setLoadingBodyId(null);
    const subject = recipientName
      ? `Hi ${recipientName} — draft: ${piece.title}`
      : `Draft: ${piece.title}`;
    const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body || `Hi!\n\nHere's a draft: ${piece.title}`)}`;
    const a = document.createElement("a");
    a.href = mailto;
    a.rel = "noopener";
    a.target = "_self";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const openCmsDialog = async (piece: ContentPiece) => {
    if (!user) return;
    setLoadingBodyId(piece.id);
    let body = "";
    try {
      const client = tenantClient;
      const data = await client.get<{ piece?: { body?: string; content?: string; markdown?: string } }>(
        `/api/content/pieces/${piece.id}`,
      );
      body = data.piece?.body || data.piece?.content || data.piece?.markdown || "";
    } catch {
      // fall through with empty body
    }
    setLoadingBodyId(null);
    setCmsDialog({ piece, body: body || `# ${piece.title}\n\n` });
  };

  const openViewDialog = async (piece: ContentPiece) => {
    if (!user) return;
    setLoadingViewId(piece.id);
    let body = "";
    try {
      const client = tenantClient;
      const data = await client.get<{ piece?: { body?: string; content?: string; markdown?: string } }>(
        `/api/content/pieces/${piece.id}`,
      );
      body = data.piece?.body || data.piece?.content || data.piece?.markdown || "";
    } catch {
      // fall through with empty body
    }
    setLoadingViewId(null);
    setViewDialog({ piece, body });
  };

  if (userLoading) {
    // Same skeleton as the Suspense fallback — keeps the page chrome stable
    // from first paint through auth resolving so layout doesn't shift.
    return <ContentShellSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <FileText className="h-7 w-7 text-purple-500" />
              Content
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t.content.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/c/content/plan"
              className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              title="Show the plan with scheduled articles and posts."
            >
              <Calendar className="h-4 w-4" />
              {t.content.viewCalendar}
            </Link>
            <button
              onClick={triggerAutopilot}
              disabled={!activeSite || triggering}
              className="flex items-center gap-2 rounded-lg bg-white border border-blue-200 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 shadow-sm transition-colors disabled:opacity-50"
              title="Kör autopilot omedelbart med sajtens sparade inställningar."
            >
              {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Kör autopilot nu
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 shadow-sm transition-colors"
              title="Write your own topic and let SAMA generate a draft."
            >
              <Plus className="h-4 w-4" />
              {t.content.createNew}
            </button>
          </div>
        </div>

        <AutopilotSettings />

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-purple-500" />
              <span className="text-sm text-slate-500">{t.content.statTotal}</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">{pieces.length}</span>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <span className="text-sm text-slate-500">{t.content.statPublished}</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">{publishedCount}</span>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Hash className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-slate-500">{t.content.statWords}</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">{(totalWords ?? 0).toLocaleString()}</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError("")} className="ml-auto text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {scheduleBackfillError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">
              {scheduleBackfillError}. &quot;Schemalagda&quot;-fliken visar inte rätt utan denna data.
            </span>
            <button
              onClick={() => fetchContent()}
              className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium hover:bg-amber-200"
            >
              Försök igen
            </button>
            <button
              onClick={() => setScheduleBackfillError(null)}
              className="text-amber-500 hover:text-amber-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Pending approvals banner (C4) */}
        {pendingApprovalsCount > 0 && (
          <Link
            href="/c/approvals"
            className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm transition-colors hover:bg-emerald-100"
          >
            <span className="rounded-lg bg-emerald-500 p-1.5">
              <ShieldCheck className="h-4 w-4 text-white" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-emerald-900">
                {pendingApprovalsCount === 1
                  ? t.content.pendingApproval1
                  : `${pendingApprovalsCount} ${t.content.pendingApprovals}`}
              </p>
              <p className="text-xs text-emerald-700">
                {t.content.pendingApprovalHint}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
              {t.content.reviewAction}
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        )}

        {/* AI Suggestions — anchor `#ideas` so deep links from Hem / Next
            Steps (K-12) land here. */}
        <div id="ideas" />
        {user && (
          <SuggestionsPanel<ContentTopicSuggestion>
            title={t.content.suggestionsTitle}
            description={t.content.suggestionsDesc}
            accent="purple"
            importButtonLabel={t.content.importToContent}
            importLabel={t.content.importLabel}
            fetchSuggestions={async () => {
              const client = tenantClient;
              const res = await client.post<{ topics?: ContentTopicSuggestion[] }>(
                "/api/content/suggest-topics",
                {},
                { headers: { "X-Sama-Intent": "user-action" } },
              );
              return res.topics || [];
            }}
            renderItem={(item) => (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-purple-700 uppercase">
                    {formatTypeLabel(item.type)}
                  </span>
                </div>
                <p className="font-semibold text-slate-900 text-sm">{item.topic}</p>
                {item.reason && (
                  <p className="text-xs text-slate-600 mt-1">
                    <span className="font-medium text-slate-700">Why: </span>
                    {item.reason}
                  </p>
                )}
              </div>
            )}
            importItem={async (item) => {
              const client = tenantClient;
              const saved = await client.post<{
                success: boolean;
                error?: string;
                piece?: ContentPiece & { content_type?: string };
              }>("/api/content/pieces", {
                title: item.topic,
                content_type: item.type,
                content: `# ${item.topic}\n\n_Content is generated by the Content agent — use "Refine with AI" to edit the draft._`,
                status: "draft",
              });
              if (saved && saved.success === false) {
                throw new Error(saved.error || "Kunde inte spara utkast");
              }
              if (saved.piece) {
                setPieces((prev) => [saved.piece as ContentPiece, ...prev]);
              }
              // Background fill-in: generate the body and PATCH the piece
              // when it returns.
              const pieceId = saved.piece?.id;
              if (pieceId) {
                (async () => {
                  try {
                    const gen = await client.post<{
                      title?: string;
                      body?: string;
                      suggestions?: string[];
                    }>(
                      "/api/content/generate",
                      { type: item.type, topic: item.topic },
                      { headers: { "X-Sama-Intent": "user-action" } },
                    );
                    const body = gen.body || "";
                    if (!body) return;
                    await client.patch(`/api/content/pieces/${pieceId}`, {
                      content: body,
                      word_count: body.split(/\s+/).filter(Boolean).length,
                    });
                    fetchContent();
                  } catch {
                    /* silent — stub remains, user can edit/refine */
                  }
                })();
              }
              return `"${item.topic}" was saved as a draft — content is being filled in in the background.`;
            }}
          />
        )}

        {/* Filters — "Ideas" comes first because that's where freshly-
            generated suggestions land before any AI tokens have been
            spent. Once approved an idea moves into "Att granska" as a
            real draft. */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: "ideas" as const, label: t.content.tabIdeas, count: ideas.length },
            { key: "to_review" as const, label: t.content.tabToReview, count: draftCount + reviewCount },
            { key: "scheduled" as const, label: t.content.tabScheduled, count: approvedCount },
            { key: "published" as const, label: t.content.tabPublished, count: publishedCount },
            { key: "archived" as const, label: t.content.tabArchived, count: archivedCount },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-purple-100 text-purple-700 border border-purple-200"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Archive controls — visible only on the "Arkiverade" tab so the
            destructive bulk action stays out of normal workflows. Hides
            itself when the archive is already empty. */}
        {filter === "archived" && archivedCount > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-100 bg-red-50/40 px-4 py-3">
            <div className="text-sm text-slate-700">
              <span className="font-medium">{archivedCount}</span> archived — archived material isn't shown in the plan.
            </div>
            <button
              onClick={emptyArchive}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
              title="Permanently delete everything archived"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Empty archive
            </button>
          </div>
        )}

        {filter === "ideas" && user && <AutoApproveToggle />}

        {/* Ideas list — only when this tab is active. Ideas have no body
            yet; the user picks ones to draft. */}
        {filter === "ideas" ? (
          ideasLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : ideas.length === 0 ? (
            <div className="rounded-xl border bg-white p-12 shadow-sm text-center">
              <Lightbulb className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-700 max-w-md mx-auto">
                {t.content.emptyIdeas}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {t.content.emptyIdeasHint}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...ideas]
                .sort((a, b) => {
                  // Scheduled ideas first (chronological); unscheduled sink to
                  // the bottom. Without this the backend's order floats
                  // unscheduled rows to the top so the list looks unplanned.
                  const ta = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Infinity;
                  const tb = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Infinity;
                  return ta - tb;
                })
                .map((idea) => {
                const isSocial = (idea.content_type || "").startsWith("social_");
                const platform = idea.metadata?.platform || idea.content_type?.replace(/^social_/, "");
                const Icon = isSocial
                  ? (platform === "linkedin"
                    ? MessageSquare
                    : platform === "x"
                    ? MessageSquare
                    : platform === "instagram"
                    ? MessageSquare
                    : platform === "facebook"
                    ? MessageSquare
                    : Mail)
                  : FileText;
                const typeLabel = isSocial
                  ? `${(platform || "social").charAt(0).toUpperCase()}${(platform || "").slice(1)} post`
                  : formatTypeLabel(idea.content_type);
                const sched = idea.scheduled_for ? new Date(idea.scheduled_for) : null;
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const draftEst = sched ? new Date(sched.getTime() - 2 * 24 * 60 * 60 * 1000) : null;
                return (
                  <div
                    key={idea.id}
                    className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/40 to-white p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Lightbulb className="h-4 w-4 flex-shrink-0 text-amber-500" />
                          <h3 className="font-semibold text-slate-900 truncate">{idea.title}</h3>
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                            <Icon className="h-3 w-3" />
                            {typeLabel}
                          </span>
                        </div>
                        {idea.topic && (
                          <p className="mt-1 text-sm text-slate-600">
                            {idea.topic}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {sched ? (
                            <>
                              {draftEst && draftEst > today && (
                                <span className="inline-flex items-center gap-1">
                                  <PenTool className="h-3 w-3" />
                                  {`${t.content.ideaDraftedAround} ${draftEst.toLocaleDateString(undefined, { dateStyle: "medium" })}`}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                {autoPublish ? <Sparkles className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                                {autoPublish
                                  ? `${t.content.ideaAutoPublish} ${sched.toLocaleDateString(undefined, { dateStyle: "medium" })}`
                                  : `${t.content.ideaScheduledOn} ${sched.toLocaleDateString(undefined, { dateStyle: "medium" })}`}
                              </span>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {t.content.ideaUnscheduled}
                            </span>
                          )}
                          {idea.target_keyword && (
                            <span className="inline-flex items-center gap-1">
                              <Search className="h-3 w-3" />
                              {idea.target_keyword}
                            </span>
                          )}
                          {idea.metadata?.gap_type && !isSocial && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                              <Target className="h-3 w-3" />
                              {t.content.ideaSourceGap}: {idea.metadata.gap_type}
                            </span>
                          )}
                          {isSocial && idea.metadata?.parent_article_title && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                              {t.content.ideaSourceSocial}: {idea.metadata.parent_article_title}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {!isSocial && (
                          <button
                            onClick={() => approveIdea(idea)}
                            disabled={approvingId === idea.id}
                            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                          >
                            {approvingId === idea.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            {approvingId === idea.id
                              ? t.content.ideaApproving
                              : t.content.ideaApprove}
                          </button>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditIdea(idea)}
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 transition-colors"
                            title={t.content.ideaEdit}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => archiveIdea(idea)}
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title={t.content.ideaArchive}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : null}

        {/* Content List */}
        {filter !== "ideas" && (loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 shadow-sm text-center">
            <PenTool className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-700 max-w-md mx-auto">
              {t.content.emptyTitle}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {t.content.emptyHint}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((piece) => (
              <div
                key={piece.id}
                className="rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {piece.featured_image_url ? (
                    <Link
                      href={`/c/content/article/${piece.id}`}
                      className="hidden sm:block shrink-0 rounded-lg overflow-hidden border border-slate-200 hover:border-orange-300 transition-colors"
                      style={{ width: 96 }}
                      title="Open article view"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={piece.featured_image_url}
                        alt=""
                        className="w-24 h-16 object-cover"
                      />
                    </Link>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {typeof piece.article_score === "number" ? (
                        <Link
                          href={`/c/content/article/${piece.id}`}
                          className="font-semibold text-slate-900 truncate hover:text-orange-700"
                        >
                          {piece.title}
                        </Link>
                      ) : (piece.content_type === "linkedin_post" || piece.content_type === "email" || piece.type === "linkedin_post" || piece.type === "email") ? (
                        <button
                          onClick={() => openViewDialog(piece)}
                          disabled={loadingViewId === piece.id}
                          className="font-semibold text-slate-900 truncate hover:text-purple-700 text-left disabled:opacity-50"
                        >
                          {loadingViewId === piece.id ? (
                            <span className="flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin inline" /> {piece.title}</span>
                          ) : piece.title}
                        </button>
                      ) : (
                        <h3 className="font-semibold text-slate-900 truncate">{piece.title}</h3>
                      )}
                      <StatusBadge status={piece.status} />
                    </div>
                    {/* Sprint 2 (K-3 / K-6) — provenance line. */}
                    {(piece.source_gap_id || piece.source_strategy_topic) && (
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {piece.source_gap_id && (
                          <Link
                            href="/c/analysis"
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800 hover:bg-amber-100"
                          >
                            <Target className="h-3 w-3" />
                            {t.content.createdFromGap}{piece.source_gap_title ? `: ${piece.source_gap_title}` : ""}
                          </Link>
                        )}
                        {piece.source_strategy_topic && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                            Topic: {piece.source_strategy_topic}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {formatTypeLabel(piece.content_type || piece.type)}
                      </span>
                      {piece.word_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {(piece.word_count ?? 0).toLocaleString()} {t.content.words}
                        </span>
                      )}
                      {piece.target_keyword && (
                        <span className="flex items-center gap-1">
                          <Search className="h-3 w-3" />
                          {piece.target_keyword}
                        </span>
                      )}
                      {typeof piece.article_score === "number" && (
                        <Link
                          href={`/c/content/article/${piece.id}`}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            piece.article_score >= 85
                              ? "bg-green-50 text-green-700"
                              : piece.article_score >= 65
                              ? "bg-lime-50 text-lime-700"
                              : piece.article_score >= 40
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                          }`}
                          title="Open article view"
                        >
                          <Sparkles className="h-3 w-3" />
                          Score {piece.article_score}/100
                        </Link>
                      )}
                      {/* Publish date — only meaningful before a piece is
                          published. A scheduled date drives the auto-publish
                          bridge; an approved piece without one is flagged so
                          the user knows to schedule it. */}
                      {(piece.status === "approved" || piece.status === "scheduled") &&
                        (piece.scheduled_for ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                            <Calendar className="h-3 w-3" />
                            {t.content.ideaScheduledOn}{" "}
                            {new Date(piece.scheduled_for).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                            <Calendar className="h-3 w-3" />
                            {t.content.ideaUnscheduled}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {/* Workflow transition */}
                    {STATUS_FLOW[piece.status] && (
                      <button
                        onClick={() => updateStatus(piece.id, STATUS_FLOW[piece.status])}
                        disabled={updatingStatus === piece.id}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        title={nextStatusLabel(piece.status) || ""}
                      >
                        {updatingStatus === piece.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5" />
                        )}
                        {nextStatusLabel(piece.status)}
                      </button>
                    )}

                    {/* Schedule onto the calendar. Only shown once a piece
                        is approved — scheduling a draft used to do nothing
                        visible (the piece stayed in "Att granska" because
                        the Schemalagda tab filters by status="approved")
                        and on top of that crashed with a duplicate-key
                        error against uniq_content_plan_keyword_per_tenant.
                        Restricting it to approved pieces makes the row
                        Send → Approve → Schedule → Publish readable
                        left-to-right. */}
                    {piece.status === "approved" && (
                      <button
                        onClick={() => openScheduleDialog(piece)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        title={t.content.scheduleAction}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        {t.content.scheduleAction}
                      </button>
                    )}

                    {/* Toggle performance (C6) */}
                    {(piece.status === "approved" || piece.status === "published") && (
                      <button
                        onClick={() =>
                          setExpandedPerf((prev) => {
                            const next = new Set(prev);
                            if (next.has(piece.id)) next.delete(piece.id);
                            else next.add(piece.id);
                            return next;
                          })
                        }
                        className={`rounded-lg border p-1.5 transition-colors ${
                          expandedPerf.has(piece.id)
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                        title="Show outcomes"
                      >
                        <BarChart2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Archive (active pieces) or permanent delete (already-archived). */}
                    {piece.status === "archived" ? (
                      <button
                        onClick={() => deletePiece(piece.id)}
                        disabled={updatingStatus === piece.id}
                        className="rounded-lg border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        title="Delete permanently"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : piece.status !== "published" ? (
                      <button
                        onClick={() => archivePiece(piece.id)}
                        disabled={updatingStatus === piece.id}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 transition-colors"
                        title="Archive"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    ) : null}

                    {/* Sprint 3 (C-6) — explicit publishing actions */}
                    {(piece.status === "approved" || piece.status === "published") && (
                      <>
                        <button
                          onClick={() => openCmsDialog(piece)}
                          disabled={loadingBodyId === piece.id}
                          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                          title="Publish to WordPress, Webflow, Ghost, Notion or webhook"
                        >
                          {loadingBodyId === piece.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          {t.content.publishToSite}
                        </button>
                        <button
                          onClick={() => sendByMail(piece)}
                          disabled={loadingBodyId === piece.id}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                          title="Send by email to the recipient from Settings"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {t.content.sendByMail}
                        </button>
                      </>
                    )}

                  </div>
                </div>

                {/* Performance expansion (C6) */}
                {expandedPerf.has(piece.id) && user && (
                  <div className="mt-4 border-t pt-4">
                    <PiecePerformance tenantId={user.id} pieceId={piece.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Idea edit dialog — title, angle, keyword, scheduled date. */}
        {editingIdea && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40"
              onClick={closeEditIdea}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-2xl border bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Edit3 className="h-5 w-5 text-purple-500" />
                    {t.content.ideaEdit}
                  </h3>
                  <button
                    onClick={closeEditIdea}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3 p-5">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">
                      {t.content.ideaEditTitle}
                    </span>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">
                      {t.content.ideaEditTopic}
                    </span>
                    <textarea
                      value={editTopic}
                      onChange={(e) => setEditTopic(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">
                        {t.content.ideaEditKeyword}
                      </span>
                      <input
                        type="text"
                        value={editKeyword}
                        onChange={(e) => setEditKeyword(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">
                        {t.content.ideaEditDate}
                      </span>
                      <input
                        type="datetime-local"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                  <button
                    onClick={closeEditIdea}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t.suggestionsPanel.cancel}
                  </button>
                  <button
                    onClick={submitEditIdea}
                    disabled={editSaving || !editTitle.trim()}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {editSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {editSaving ? t.content.ideaEditSaving : t.content.ideaEditSave}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Idea action toast (approve / archive / update). */}
        {ideaToast && (
          <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 transform rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>{ideaToast}</span>
            </div>
          </div>
        )}

        {/* Schedule dialog: drop a draft onto the calendar */}
        {schedulingPiece && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40"
              onClick={closeScheduleDialog}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-2xl border bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <CalendarPlus className="h-5 w-5 text-purple-500" />
                    {t.content.scheduleDialogTitle}
                  </h3>
                  <button
                    onClick={closeScheduleDialog}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-4 p-5">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">
                      {schedulingPiece.title}
                    </span>
                  </p>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">
                      {t.content.scheduleWhen}
                    </span>
                    <input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </label>
                  <p className="text-xs text-slate-500">{t.content.scheduleHint}</p>
                  {scheduleError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {scheduleError}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                  <button
                    onClick={closeScheduleDialog}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t.suggestionsPanel.cancel}
                  </button>
                  <button
                    onClick={submitSchedule}
                    disabled={scheduleSaving || !scheduleDate}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {scheduleSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarPlus className="h-4 w-4" />
                    )}
                    {scheduleSaving
                      ? t.content.scheduleSaving
                      : t.content.scheduleSave}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Confirmation banner after a successful schedule */}
        {scheduleSuccess && (
          <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 transform rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>{scheduleSuccess}</span>
              <Link
                href="/c/content/plan"
                className="ml-2 inline-flex items-center gap-1 font-semibold text-emerald-700 underline hover:text-emerald-900"
              >
                {t.content.viewCalendar}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* CMS publish dialog */}
        {cmsDialog && (
          <PublishDialog
            open
            onClose={() => setCmsDialog(null)}
            onPublished={() => {
              setPieces((prev) =>
                prev.map((p) =>
                  p.id === cmsDialog.piece.id ? { ...p, status: "published" } : p,
                ),
              );
              setCmsDialog(null);
            }}
            title={cmsDialog.piece.title}
            body={cmsDialog.body}
            pieceId={cmsDialog.piece.id}
            defaultTags={cmsDialog.piece.target_keyword ? [cmsDialog.piece.target_keyword] : []}
          />
        )}

        {/* Generate Modal */}
        {showModal && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => { setShowModal(false); setModalContent(""); setModalTopic(""); setModalFullscreen(false); setSourceGap(null); setSourceStrategyTopic(null); }} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className={`w-full rounded-2xl border bg-white shadow-2xl overflow-y-auto transition-all ${modalFullscreen ? "max-w-6xl h-[90vh]" : "max-w-lg max-h-[90vh]"}`}>
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    {t.content.modalTitle}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setModalFullscreen(!modalFullscreen)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      title={modalFullscreen ? "Minimise" : "Fullscreen"}
                    >
                      {modalFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => { setShowModal(false); setModalContent(""); setModalTopic(""); setModalFullscreen(false); setSourceGap(null); setSourceStrategyTopic(null); }}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  {/* Sprint 2 (K-1 / K-4) — show the originating surface inside the modal. */}
                  {(sourceGap || sourceStrategyTopic) && (
                    <div
                      className={`rounded-lg border p-3 text-xs ${
                        sourceGap
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-emerald-200 bg-emerald-50 text-emerald-900"
                      }`}
                    >
                      {sourceGap ? (
                        <>
                          <strong>{t.content.gapPrefix}</strong> {sourceGap.title}
                        </>
                      ) : (
                        <>
                          <strong>{t.content.strategyTopicPrefix}</strong> {sourceStrategyTopic}
                        </>
                      )}
                    </div>
                  )}
                  {/* Type selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t.content.modalFormat}</label>
                    <div className="flex gap-2">
                      {(["linkedin", "blogg", "epost"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setModalType(type)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            modalType === type
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {type === "linkedin" ? "LinkedIn" : type === "blogg" ? "Blogg" : "E-post"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Topic */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t.content.modalTopic}</label>
                    <input
                      type="text"
                      value={modalTopic}
                      onChange={(e) => setModalTopic(e.target.value)}
                      placeholder={t.content.modalTopicPlaceholder}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  {/* Generate button */}
                  <button
                    onClick={generateInModal}
                    disabled={modalGenerating || !modalTopic.trim()}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300 shadow-sm transition-colors w-full justify-center"
                  >
                    {modalGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {modalGenerating ? t.content.generating : t.content.modalGenerate}
                  </button>

                  {/* Generated content */}
                  {modalContent && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t.content.modalContent}</label>
                        <textarea
                          value={modalContent}
                          onChange={(e) => setModalContent(e.target.value)}
                          rows={10}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y font-mono"
                        />
                      </div>
                      <button
                        onClick={saveModalDraft}
                        disabled={modalSaving}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300 shadow-sm transition-colors w-full justify-center"
                      >
                        {modalSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {t.content.modalSave}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* View LinkedIn/Email content dialog */}
        {viewDialog && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setViewDialog(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl border bg-white shadow-2xl flex flex-col">
                <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
                  <h3 className="text-lg font-semibold text-slate-900 truncate pr-4">
                    {viewDialog.piece.title}
                  </h3>
                  <button
                    onClick={() => setViewDialog(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex-shrink-0"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                  {viewDialog.body ? (
                    <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans leading-relaxed">
                      {viewDialog.body}
                    </pre>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Inget innehåll hittades.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config: Record<string, { styles: string; Icon: any; label: string }> = {
    draft: {
      styles: "bg-slate-50 text-slate-700 border-slate-200",
      Icon: PenTool,
      label: t.content.statusDraft,
    },
    review: {
      styles: "bg-amber-50 text-amber-700 border-amber-200",
      Icon: Eye,
      label: t.content.statusReview,
    },
    approved: {
      styles: "bg-blue-50 text-blue-700 border-blue-200",
      Icon: CheckCircle,
      label: t.content.statusApproved,
    },
    published: {
      styles: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Icon: CheckCircle,
      label: t.content.statusPublished,
    },
    archived: {
      styles: "bg-slate-50 text-slate-500 border-slate-200",
      Icon: Archive,
      label: t.content.statusArchived,
    },
  };
  const c = config[status] || config.draft;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${c.styles}`}>
      <c.Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}
