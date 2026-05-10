"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowUp, Download, Edit3, Globe, Loader2 } from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import ArticleHero from "@/components/content/ArticleHero";
import ArticleTOC from "@/components/content/ArticleTOC";
import KeyTakeawaysGrid from "@/components/content/KeyTakeawaysGrid";
import ArticleSection from "@/components/content/ArticleSection";
import ArticleFAQ from "@/components/content/ArticleFAQ";
import ArticleSidebar, { ArticleData } from "@/components/content/ArticleSidebar";
import MarkdownArticle from "@/components/content/MarkdownArticle";
import ReadingProgress from "@/components/content/ReadingProgress";

interface PieceFull {
  id: string;
  title: string;
  slug?: string | null;
  content?: string | null;
  body?: string | null;
  markdown?: string | null;
  meta_description?: string | null;
  meta_title?: string | null;
  target_keyword?: string | null;
  word_count?: number | null;
  content_type?: string | null;
  status?: string | null;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  article_score?: number | null;
  article_data?: ArticleData | null;
  created_at?: string | null;
  published_at?: string | null;
}

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<LoadingShell />}>
      <ArticleInner id={id} />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerNav />
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    </div>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/90 text-white shadow-lg hover:bg-slate-900 transition-colors"
      aria-label="Back to top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

function ArticleInner({ id }: { id: string }) {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { tenantClient, effectiveTenantId } = useSite();
  const [piece, setPiece] = useState<PieceFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push("/c/login");
      return;
    }
    if (!effectiveTenantId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let data: PieceFull | null = null;
        try {
          const res = await tenantClient.get<{ piece?: PieceFull }>(
            `/api/content/pieces/${id}`,
          );
          data = res.piece ?? null;
        } catch {
          data = null;
        }
        if (!data || !data.article_data) {
          const sb = (await import("@/lib/supabase-browser")).getSupabaseBrowser();
          const { data: row, error: sbErr } = await sb
            .from("content_pieces")
            .select(
              "id, title, slug, content, content_type, meta_description, meta_title, target_keyword, word_count, status, featured_image_url, featured_image_alt, article_score, article_data, created_at, published_at"
            )
            .eq("id", id)
            .maybeSingle();
          if (sbErr) throw sbErr;
          if (row) data = { ...(data ?? {}), ...row } as PieceFull;
        }
        if (!cancelled) {
          if (!data) setError("Artikel hittades inte.");
          else setPiece(data);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Kunde inte ladda artikel.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, effectiveTenantId, user, userLoading, tenantClient, router]);

  if (loading || userLoading) return <LoadingShell />;

  if (error || !piece) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="text-slate-700 mb-4">{error || "Artikel hittades inte."}</div>
          <Link href="/c/content" className="text-orange-600 hover:underline">
            Tillbaka till innehåll
          </Link>
        </div>
      </div>
    );
  }

  const articleData: ArticleData = piece.article_data || {};
  const hasStructured = Array.isArray(articleData.sections) && articleData.sections.length > 0;
  const score = piece.article_score ?? articleData.score?.score ?? 0;
  const dateStr = piece.published_at || piece.created_at || null;
  const markdown = piece.content || piece.body || piece.markdown || "";
  const intro = (articleData as any).intro_md as string | undefined;

  const handleExport = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${piece.slug || piece.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <ReadingProgress />
      <CustomerNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top toolbar — always visible above the grid */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900 transition-colors"
              aria-label="Tillbaka"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link
              href={`/c/content?edit=${piece.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-medium shadow-sm"
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/c/content?publish=${piece.id}`}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-medium"
            >
              <Globe className="h-4 w-4" />
              Connect Website
            </Link>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 text-sm font-medium"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-10">
          {/* Article column */}
          <div className="min-w-0">
            <ArticleHero
              title={piece.title}
              date={dateStr}
              primaryKeyword={articleData.primary_keyword || piece.target_keyword || undefined}
              wordCount={
                articleData.score?.metrics?.word_count ?? piece.word_count ?? undefined
              }
              score={typeof piece.article_score === "number" ? piece.article_score : undefined}
              contentType={piece.content_type || undefined}
            />

            {piece.featured_image_url && (
              <figure className="mb-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={piece.featured_image_url}
                  alt={piece.featured_image_alt || piece.title}
                  className="w-full rounded-3xl border border-slate-200 object-cover shadow-sm"
                  style={{ aspectRatio: "16/9" }}
                />
              </figure>
            )}

            {/* Structured rendering when article_data is available;
                otherwise fall back to the merged markdown body for legacy pieces. */}
            {hasStructured ? (
              <>
                {intro && (
                  <div className="prose prose-slate prose-lg max-w-none prose-p:text-slate-700 prose-p:leading-relaxed mb-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
                  </div>
                )}
                {articleData.table_of_contents && articleData.table_of_contents.length > 0 && (
                  <ArticleTOC items={articleData.table_of_contents as any} />
                )}
                {articleData.key_takeaways && articleData.key_takeaways.length > 0 && (
                  <KeyTakeawaysGrid items={articleData.key_takeaways as any} />
                )}
                {(articleData.sections as any[]).map((section, i) => (
                  <ArticleSection key={section.id || i} section={section} />
                ))}
                {articleData.faq && articleData.faq.length > 0 && (
                  <ArticleFAQ items={articleData.faq as any} />
                )}
              </>
            ) : (
              <MarkdownArticle markdown={markdown} />
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:sticky lg:top-6 lg:self-start space-y-4 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pb-6">
            <ArticleSidebar
              score={score}
              articleData={articleData}
              slug={piece.slug}
              metaDescription={piece.meta_description}
              featuredImageUrl={piece.featured_image_url}
              publishedDate={dateStr}
            />
          </div>
        </div>
      </div>
      <BackToTop />
    </div>
  );
}
