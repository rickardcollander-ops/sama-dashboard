"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit3, Loader2, Globe, Download } from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import MarkdownArticle from "@/components/content/MarkdownArticle";
import ArticleSidebar, { ArticleData } from "@/components/content/ArticleSidebar";

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
        // Try the agent route first; if it doesn't return article_data
        // (older pieces), fall back to a direct Supabase select so the page
        // still renders the markdown body.
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
              "id, title, slug, content, meta_description, meta_title, target_keyword, word_count, status, featured_image_url, featured_image_alt, article_score, article_data, created_at, published_at"
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
    return () => { cancelled = true; };
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

  const markdown = piece.content || piece.body || piece.markdown || "";
  const articleData: ArticleData = piece.article_data || {};
  const score = piece.article_score ?? articleData.score?.score ?? 0;
  const dateStr = piece.published_at || piece.created_at || null;

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
      <CustomerNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          {/* Main column */}
          <div>
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3 mb-8">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.back()}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Tillbaka"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Link
                  href={`/c/content?edit=${piece.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 text-sm font-medium"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Link>
              </div>
              {dateStr && (
                <div className="text-xs uppercase tracking-wider text-slate-400">
                  {new Date(dateStr).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </div>
              )}
            </div>

            <h1 className="text-4xl font-bold text-slate-900 mb-6">{piece.title}</h1>

            {piece.featured_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={piece.featured_image_url}
                alt={piece.featured_image_alt || ""}
                className="w-full rounded-2xl border border-slate-200 mb-8 object-cover"
                style={{ aspectRatio: "16/9" }}
              />
            )}

            <MarkdownArticle markdown={markdown} />
          </div>

          {/* Sidebar */}
          <div className="lg:sticky lg:top-8 lg:self-start space-y-4">
            <ArticleSidebar
              score={score}
              articleData={articleData}
              slug={piece.slug}
              metaDescription={piece.meta_description}
              featuredImageUrl={piece.featured_image_url}
              publishedDate={dateStr}
            />
            <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
              <Link
                href={`/c/content?publish=${piece.id}`}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white py-3 text-sm font-medium"
              >
                <Globe className="h-4 w-4" />
                Connect Website
              </Link>
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 py-3 text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                Export Article
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
