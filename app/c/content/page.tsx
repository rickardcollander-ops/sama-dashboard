"use client";

import { useState, useEffect } from "react";
import {
  FileText, Plus, Loader2, Calendar, Hash, CheckCircle,
  Clock, PenTool, Search, X, Sparkles, Save, AlertCircle,
  Maximize2, Minimize2, ExternalLink, Code2, Send,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { tenantApi } from "@/lib/api";
import { IS_DEMO, demoContentPieces } from "@/lib/demo-data";

interface ContentPiece {
  id: string;
  title: string;
  type: string;
  status: string;
  word_count: number;
  target_keyword: string;
  created_at?: string;
}

export default function CustomerContentPage() {
  const { user, loading: userLoading } = useUser();
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"linkedin" | "blogg" | "epost">("linkedin");
  const [modalTopic, setModalTopic] = useState("");
  const [modalGenerating, setModalGenerating] = useState(false);
  const [modalContent, setModalContent] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalFullscreen, setModalFullscreen] = useState(false);
  const [ghConnected, setGhConnected] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ id: string; pr_url: string } | null>(null);
  const [publishError, setPublishError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    if (user) fetchContent();
  }, [user]);

  useEffect(() => {
    if (user) checkGitHubStatus();
  }, [user]);

  const checkGitHubStatus = async () => {
    if (!user) return;
    try {
      const client = tenantApi(user.id);
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
      const client = tenantApi(user.id);
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
      setPublishError({ id: pieceId, message: err?.message || "Could not publish" });
    }
    setPublishingId(null);
  };

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const fetchContent = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const client = tenantApi(user.id);
      const data = await client.get<{ pieces?: ContentPiece[] }>("/api/content/pieces");
      const pcs = data.pieces || [];
      setPieces(pcs.length > 0 ? pcs : IS_DEMO ? demoContentPieces : []);
    } catch (err: any) {
      console.error("Failed to fetch content:", err);
      if (IS_DEMO) {
        setPieces(demoContentPieces);
      } else {
        setError("Could not load content. The content agent may not have generated anything yet.");
      }
    }
    setLoading(false);
  };

  const generateContent = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const client = tenantApi(user.id);
      await client.post("/api/content/generate", { type: "linkedin_post" });
      // Refresh after a delay to let generation start
      setTimeout(() => fetchContent(), 3000);
    } catch (err: any) {
      console.error("Failed to trigger content generation:", err);
      setError(`Could not generate content: ${err?.message || err}`);
    }
    setGenerating(false);
  };

  const generateInModal = async () => {
    if (!user || !modalTopic.trim()) return;
    setModalGenerating(true);
    setModalContent("");
    try {
      const client = tenantApi(user.id);
      const result = await client.post<{ content?: string }>("/api/content/generate", {
        type: modalType,
        topic: modalTopic,
      });
      setModalContent(result.content || `# ${modalTopic}\n\nGenererat innehåll för ${modalType}...`);
    } catch (err: any) {
      setError(`Could not generate: ${err?.message || err}`);
      // Fallback placeholder
      const templates: Record<string, string> = {
        linkedin: `Did you know that ${modalTopic}? Here are three insights that might change your perspective.\n\n1. First insight\n2. Second insight\n3. Third insight\n\nWhat do you think? Share your thoughts in the comments!`,
        blogg: `# ${modalTopic}\n\nIn this article we explore ${modalTopic} and what it means for your business.\n\n## Background\n\nLorem ipsum...\n\n## Conclusion\n\nIn summary...`,
        epost: `Subject: ${modalTopic}\n\nHi,\n\nI wanted to share something interesting about ${modalTopic}.\n\n[Main content]\n\nBest regards`,
      };
      setModalContent(templates[modalType] || `Generated content about ${modalTopic}`);
    }
    setModalGenerating(false);
  };

  const saveModalDraft = async () => {
    if (!user || !modalContent) return;
    setModalSaving(true);
    try {
      const client = tenantApi(user.id);
      await client.post("/api/content/pieces", {
        title: modalTopic,
        type: modalType,
        content: modalContent,
        status: "draft",
      });
    } catch {
      // Optimistic
    }
    // Add optimistically to the list
    setPieces((prev) => [
      {
        id: `local-${Date.now()}`,
        title: modalTopic,
        type: modalType === "blogg" ? "blog_post" : modalType === "epost" ? "email" : "linkedin_post",
        status: "draft",
        word_count: modalContent.split(/\s+/).filter(Boolean).length,
        target_keyword: "",
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setModalSaving(false);
    setShowModal(false);
    setModalTopic("");
    setModalContent("");
  };

  const filtered = pieces.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const draftCount = pieces.filter((p) => p.status === "draft").length;
  const publishedCount = pieces.filter((p) => p.status === "published").length;
  const totalWords = pieces.reduce((sum, p) => sum + (p.word_count || 0), 0);

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
              AI-generated blog posts, landing pages, and more
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 shadow-sm transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Generate New
            </button>
            <button
              onClick={generateContent}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-slate-100 border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:text-slate-400 shadow-sm transition-colors"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {generating ? "Generating..." : "Auto-generate"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-purple-500" />
              <span className="text-sm text-slate-500">Total Pieces</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">{pieces.length}</span>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <span className="text-sm text-slate-500">Published</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">{publishedCount}</span>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Hash className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-slate-500">Total Words</span>
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

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(["all", "draft", "published"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-purple-100 text-purple-700 border border-purple-200"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f === "all" ? `All (${pieces.length})` : f === "draft" ? `Drafts (${draftCount})` : `Published (${publishedCount})`}
            </button>
          ))}
        </div>

        {/* Content List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-white p-16 shadow-sm text-center">
            <PenTool className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">No content yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;Generate Content&quot; to create your first piece.
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
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {piece.type || "blog_post"}
                      </span>
                      {piece.word_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {(piece.word_count ?? 0).toLocaleString()} words
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
                    {piece.status !== "published" && (
                      ghConnected ? (
                        publishingId === piece.id ? (
                          <span className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing...
                          </span>
                        ) : publishResult?.id === piece.id ? (
                          <a
                            href={publishResult.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            PR Created!
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <button
                            onClick={() => handlePublish(piece.id)}
                            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Publish
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-slate-400" title="Connect GitHub in Settings to publish">
                          <Code2 className="h-3.5 w-3.5 inline mr-1" />
                          Connect GitHub
                        </span>
                      )
                    )}
                    {publishError?.id === piece.id && (
                      <span className="text-xs text-red-600">{publishError.message}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generate Modal */}
        {showModal && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => { setShowModal(false); setModalContent(""); setModalTopic(""); setModalFullscreen(false); }} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className={`w-full rounded-2xl border bg-white shadow-2xl overflow-y-auto transition-all ${modalFullscreen ? "max-w-6xl h-[90vh]" : "max-w-lg max-h-[90vh]"}`}>
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    Generate New Content
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setModalFullscreen(!modalFullscreen)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      title={modalFullscreen ? "Minimize" : "Fullscreen"}
                    >
                      {modalFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => { setShowModal(false); setModalContent(""); setModalTopic(""); setModalFullscreen(false); }}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  {/* Type selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                    <div className="flex gap-2">
                      {(["linkedin", "blogg", "epost"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setModalType(t)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            modalType === t
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {t === "linkedin" ? "LinkedIn" : t === "blogg" ? "Blog" : "Email"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Topic */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Topic</label>
                    <input
                      type="text"
                      value={modalTopic}
                      onChange={(e) => setModalTopic(e.target.value)}
                      placeholder="E.g. AI-driven marketing for B2B..."
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
                    {modalGenerating ? "Generating..." : "Generate"}
                  </button>

                  {/* Generated content */}
                  {modalContent && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Generated Content</label>
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
                        Save as Draft
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
  const styles =
    status === "published"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  const Icon = status === "published" ? CheckCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}
