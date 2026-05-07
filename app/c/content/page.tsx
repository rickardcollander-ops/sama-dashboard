"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText, Plus, Loader2, Calendar, Hash, CheckCircle,
  PenTool, Search, X, Sparkles, Save, AlertCircle,
  Maximize2, Minimize2, ExternalLink, Code2, Send, Eye,
  ArrowRight, Archive, ShieldCheck, BarChart2, Wand2, Target,
} from "lucide-react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import PublishDialog from "@/components/PublishDialog";
import PiecePerformance from "@/components/content/PiecePerformance";
import RefineDialog from "@/components/content/RefineDialog";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { tenantApi } from "@/lib/api";
import { IS_DEMO, demoContentPieces } from "@/lib/demo-data";

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
  // Sprint 2 (K-3 / K-6) — backreferences to the surface that motivated the
  // piece, so the article card can show "Skapad från lucka …" / "Skapad
  // utifrån strategi-topic …".
  source_gap_id?: string | null;
  source_gap_title?: string | null;
  source_strategy_topic?: string | null;
}

export default function CustomerContentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
          <CustomerNav />
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        </div>
      }
    >
      <CustomerContentInner />
    </Suspense>
  );
}

function CustomerContentInner() {
  const { t } = useLanguage();
  const { user, loading: userLoading } = useUser();
  const { tenantClient, effectiveTenantId } = useSite();
  const searchParams = useSearchParams();
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sprint 1 (C-5) — collapsed status tabs to four logical buckets:
  // "to_review" covers both draft and review (everything pre-approval),
  // "scheduled" maps to approved, plus published and archived.
  const [filter, setFilter] = useState<"to_review" | "scheduled" | "published" | "archived">("to_review");
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
  const [ghConnected, setGhConnected] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ id: string; pr_url: string } | null>(null);
  const [publishError, setPublishError] = useState<{ id: string; message: string } | null>(null);
  const [cmsDialog, setCmsDialog] = useState<{ piece: ContentPiece; body: string } | null>(null);
  const [loadingBodyId, setLoadingBodyId] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [expandedPerf, setExpandedPerf] = useState<Set<string>>(new Set());
  const [refineId, setRefineId] = useState<string | null>(null);

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
    if (s === "draft") return t.content.actionSendReview;
    if (s === "review") return t.content.actionApprove;
    if (s === "approved") return t.content.actionMarkPublished;
    return null;
  };

  useEffect(() => {
    if (user && effectiveTenantId) fetchContent();
  }, [user, effectiveTenantId]);

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
  }, [searchParams]);

  useEffect(() => {
    if (user) checkGitHubStatus();
  }, [user]);

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

  const checkGitHubStatus = async () => {
    if (!user) return;
    try {
      const client = tenantClient;
      const data = await client.get<{ connected: boolean }>("/api/integrations/github/status");
      setGhConnected(data.connected);
    } catch {
      setGhConnected(false);
    }
  };

  const handlePublish = async (pieceId: string) => {
    if (!user) return;
    setPublishingId(pieceId);
    setPublishResult(null);
    setPublishError(null);
    try {
      const client = tenantClient;
      const result = await client.post<{ pr_url: string; branch: string; file_path: string }>(
        "/api/integrations/github/publish",
        { content_id: pieceId }
      );
      setPublishResult({ id: pieceId, pr_url: result.pr_url });
      // Update piece status locally
      setPieces((prev) =>
        prev.map((p) => (p.id === pieceId ? { ...p, status: "published" } : p))
      );
    } catch (err: any) {
      setPublishError({ id: pieceId, message: err?.message || "Kunde inte publicera" });
    }
    setPublishingId(null);
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchContent = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const client = tenantClient;
      const data = await client.get<{ pieces?: ContentPiece[] }>("/api/content/pieces");
      const pcs = data.pieces || [];
      setPieces(pcs.length > 0 ? pcs : IS_DEMO ? demoContentPieces : []);
    } catch (err: any) {
      console.error("Failed to fetch content:", err);
      if (IS_DEMO) {
        setPieces(demoContentPieces);
      } else {
        setError(t.content.errorFetch);
      }
    }
    setLoading(false);
  };

  const generateContent = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const client = tenantClient;
      const gen = await client.post<{
        title?: string;
        body?: string;
        content?: string;
        suggestions?: string[];
      }>(
        "/api/content/generate",
        { type: "linkedin_post" },
        { headers: { "X-Sama-Intent": "user-action" } },
      );
      const body = gen.body || gen.content || "";
      if (!body) {
        const detail = gen.suggestions?.[0] || "Inget innehåll returnerades från AI:n.";
        throw new Error(detail);
      }
      const title = gen.title || "Nytt LinkedIn-utkast";
      await client.post("/api/content/pieces", {
        title,
        content_type: "linkedin_post",
        content: body,
        status: "draft",
        word_count: body.split(/\s+/).filter(Boolean).length,
      });
      await fetchContent();
    } catch (err: any) {
      console.error("Failed to trigger content generation:", err);
      setError(`Kunde inte generera content: ${err?.message || err}`);
    }
    setGenerating(false);
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
        const detail = result.suggestions?.[0] || "AI:n returnerade inget innehåll.";
        setError(`Kunde inte generera: ${detail}`);
      } else {
        setModalContent(generated);
      }
    } catch (err: any) {
      setError(`Kunde inte generera: ${err?.message || err}`);
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

  const filtered = pieces.filter((p) => {
    if (filter === "to_review") return p.status === "draft" || p.status === "review";
    if (filter === "scheduled") return p.status === "approved";
    return p.status === filter;
  });

  const countByStatus = (status: string) => pieces.filter((p) => p.status === status).length;
  const draftCount = countByStatus("draft");
  const reviewCount = countByStatus("review");
  const approvedCount = countByStatus("approved");
  const publishedCount = countByStatus("published");
  const archivedCount = countByStatus("archived");
  const totalWords = pieces.reduce((sum, p) => sum + (p.word_count || 0), 0);

  const STATUS_FLOW: Record<string, string> = {
    draft: "review",
    review: "approved",
    approved: "published",
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
        .single();
      recipient = data?.settings?.publish_email_recipient || "";
      recipientName = data?.settings?.publish_email_recipient_name || "";
    } catch {
      // settings not configured — open mailto with empty `to`
    }
    setLoadingBodyId(null);
    const subject = recipientName
      ? `Hej ${recipientName} — utkast: ${piece.title}`
      : `Utkast: ${piece.title}`;
    const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body || `Hej!\n\nHär kommer ett utkast: ${piece.title}`)}`;
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

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <FileText className="h-7 w-7 text-purple-500" />
              Content
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t.content.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 shadow-sm transition-colors"
              title="Skriv eget ämne och låt SAMA generera ett utkast."
            >
              <Plus className="h-4 w-4" />
              {t.content.createNew}
            </button>
            <button
              onClick={() => {
                document
                  .getElementById("ideas")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex items-center gap-2 rounded-lg bg-white border border-purple-200 px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-50 shadow-sm transition-colors"
              title="Visa AI-förslag baserat på er strategi och era luckor i Insikter."
            >
              <Sparkles className="h-4 w-4" />
              {t.content.getIdeas}
            </button>
            <button
              onClick={generateContent}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-slate-100 border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:text-slate-400 shadow-sm transition-colors"
              title="Skapar ett LinkedIn-utkast direkt från er profil."
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {generating ? t.content.generating : t.content.autoGenerate}
            </button>
          </div>
        </div>

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
                    <span className="font-medium text-slate-700">Varför: </span>
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
                content: `# ${item.topic}\n\n_Innehållet genereras av Content-agenten — använd "Förbättra med AI" för att bearbeta utkastet._`,
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
              return `"${item.topic}" sparades som utkast — innehållet fylls på i bakgrunden.`;
            }}
          />
        )}

        {/* Filters — Sprint 1 (C-5): four logical buckets instead of six. */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
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

        {/* Content List */}
        {loading ? (
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
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">{piece.title}</h3>
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
                      {piece.created_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(piece.created_at).toLocaleDateString()}
                        </span>
                      )}
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

                    {/* Refine with AI (C5) — for unpublished drafts */}
                    {piece.status !== "published" && piece.status !== "archived" && (
                      <button
                        onClick={() => setRefineId(piece.id)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-purple-600 hover:bg-purple-50 transition-colors"
                        title="Förbättra med AI"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
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
                        title="Visa utfall"
                      >
                        <BarChart2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Archive */}
                    {piece.status !== "archived" && piece.status !== "published" && (
                      <button
                        onClick={() => archivePiece(piece.id)}
                        disabled={updatingStatus === piece.id}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 transition-colors"
                        title="Arkivera"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Sprint 3 (C-6) — explicit publishing actions */}
                    {(piece.status === "approved" || piece.status === "published") && (
                      <>
                        <button
                          onClick={() => openCmsDialog(piece)}
                          disabled={loadingBodyId === piece.id}
                          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                          title="Publicera till WordPress, Webflow, Ghost, Notion eller webhook"
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
                          title="Skicka via mail till mottagaren från Inställningar"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {t.content.sendByMail}
                        </button>
                      </>
                    )}

                    {/* Publish to GitHub (only for approved/published) */}
                    {(piece.status === "approved" || piece.status === "published") && (
                      ghConnected ? (
                        publishingId === piece.id ? (
                          <span className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.content.publishing}
                          </span>
                        ) : publishResult?.id === piece.id ? (
                          <a
                            href={publishResult.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            {t.content.prCreated}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <button
                            onClick={() => handlePublish(piece.id)}
                            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {t.content.publishViaGitHub}
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-slate-400" title="Anslut GitHub i Inställningar för att publicera">
                          <Code2 className="h-3.5 w-3.5 inline mr-1" />
                          {t.content.connectGitHub}
                        </span>
                      )
                    )}
                    {publishError?.id === piece.id && (
                      <span className="text-xs text-red-600">{publishError.message}</span>
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
        )}

        {/* Refine dialog (C5) */}
        {refineId && user && (
          <RefineDialog
            open
            onClose={() => setRefineId(null)}
            tenantId={user.id}
            pieceId={refineId}
            onSaved={() => fetchContent()}
          />
        )}

        {/* CMS publish dialog */}
        {cmsDialog && (
          <PublishDialog
            open
            onClose={() => setCmsDialog(null)}
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
                      title={modalFullscreen ? "Minimera" : "Helskärm"}
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
