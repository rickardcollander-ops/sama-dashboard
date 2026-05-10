"use client";

import { Check, AlertCircle, FileText, Hash, Image as ImageIcon, Link2, ExternalLink, Calendar } from "lucide-react";
import ScoreGauge from "./ScoreGauge";

export interface ArticleScoreRule {
  key: string;
  label: string;
  ok: boolean;
  weight: number;
  earned: number;
}

export interface ArticleData {
  primary_keyword?: string;
  secondary_keywords?: string[];
  table_of_contents?: { id: string; label: string }[];
  key_takeaways?: { point: string; details: string }[];
  sections?: any[];
  faq?: { q: string; a: string }[];
  featured_image?: { url?: string; alt?: string; source?: string } | null;
  score?: {
    score: number;
    rules: ArticleScoreRule[];
    suggestions: string[];
    metrics: {
      word_count: number;
      h2_count: number;
      internal_links: number;
      external_links: number;
      image_count: number;
      meta_description_length: number;
      keyword_density_pct: number;
    };
  };
  stats?: {
    internal_links_inserted?: number;
    external_links_inserted?: number;
    image_count?: number;
    generated_at?: string;
  };
}

interface Props {
  score: number;
  articleData: ArticleData;
  slug?: string | null;
  metaDescription?: string | null;
  featuredImageUrl?: string | null;
  publishedDate?: string | null;
}

function StatRow({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string | number; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-2 text-slate-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1.5 text-slate-900 font-medium tabular-nums">
        <span>{value}</span>
        {ok !== undefined && (
          <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-500" : "bg-amber-500"}`} />
        )}
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

export default function ArticleSidebar({
  score,
  articleData,
  slug,
  metaDescription,
  featuredImageUrl,
  publishedDate,
}: Props) {
  const metrics = articleData.score?.metrics;
  const rules = articleData.score?.rules ?? [];
  const suggestions = articleData.score?.suggestions ?? [];
  const allOk = suggestions.length === 0;

  return (
    <aside className="w-full max-w-sm space-y-4 text-slate-900">
      {/* Score gauge */}
      <Card className="text-center">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Article Score</div>
        <div className="flex justify-center">
          <ScoreGauge score={score} />
        </div>
        <details className="mt-3 text-left">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-800 select-none">
            Score factors
          </summary>
          <ul className="mt-2 space-y-1">
            {rules.map((r) => (
              <li key={r.key} className="flex items-start gap-2 text-xs">
                {r.ok ? (
                  <Check className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                )}
                <span className="text-slate-700">{r.label}</span>
                <span className="ml-auto text-slate-400 tabular-nums">{r.earned}/{r.weight}</span>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      {/* Optimisation suggestions */}
      <Card>
        <div className="text-sm font-semibold mb-1">Optimization Suggestions</div>
        <div className="text-xs text-slate-500 mb-3">Optional tips to help improve your score</div>
        {allOk ? (
          <div className="rounded-xl bg-green-50 border border-green-100 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700">
              <Check className="h-4 w-4" /> Article Optimized
            </div>
            <div className="text-xs text-green-700/80 mt-1">
              Your article is well-optimized for search engines. No further actions are needed.
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm rounded-lg bg-amber-50 border border-amber-100 p-2.5">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-slate-700">{s}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Article data */}
      <Card>
        <div className="text-sm font-semibold mb-1">Article Data</div>
        <div className="text-xs text-slate-500 mb-3">Key metrics and performance indicators</div>
        {articleData.primary_keyword && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 mb-3">
            <div className="text-sm text-slate-900">{articleData.primary_keyword}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Search Vol: — Difficulty: —</div>
          </div>
        )}
        <StatRow
          icon={<FileText className="h-4 w-4 text-slate-400" />}
          label="Word Count"
          value={(metrics?.word_count ?? 0).toLocaleString()}
          ok={metrics ? metrics.word_count >= 1500 : undefined}
        />
        <StatRow
          icon={<Hash className="h-4 w-4 text-slate-400" />}
          label="Number of Keywords"
          value={(articleData.secondary_keywords?.length ?? 0) + (articleData.primary_keyword ? 1 : 0)}
          ok={(articleData.secondary_keywords?.length ?? 0) >= 5}
        />
        <StatRow
          icon={<ImageIcon className="h-4 w-4 text-slate-400" />}
          label="Images"
          value={metrics?.image_count ?? 0}
          ok={(metrics?.image_count ?? 0) >= 3}
        />
        <StatRow
          icon={<Link2 className="h-4 w-4 text-slate-400" />}
          label="Internal Links"
          value={metrics?.internal_links ?? 0}
          ok={(metrics?.internal_links ?? 0) >= 5}
        />
        <StatRow
          icon={<ExternalLink className="h-4 w-4 text-slate-400" />}
          label="External Links"
          value={metrics?.external_links ?? 0}
          ok={(metrics?.external_links ?? 0) >= 3}
        />
      </Card>

      {/* Slug */}
      {slug && (
        <Card>
          <div className="text-sm font-semibold mb-1">Slug</div>
          <div className="text-xs text-slate-500 mb-2">The optimized article URL</div>
          <code className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 truncate">
            {slug}
          </code>
        </Card>
      )}

      {/* Meta description */}
      {metaDescription && (
        <Card>
          <div className="text-sm font-semibold mb-1">Meta Description</div>
          <div className="text-xs text-slate-500 mb-2">Article description for search engines</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {metaDescription}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5 text-right">
            {metaDescription.length}/160 characters
          </div>
        </Card>
      )}

      {/* Featured image */}
      {featuredImageUrl && (
        <Card>
          <div className="text-sm font-semibold mb-1">Featured Image</div>
          <div className="text-xs text-slate-500 mb-2">Main image displayed for the article</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={featuredImageUrl}
            alt={articleData.featured_image?.alt || ""}
            className="w-full rounded-lg border border-slate-200 object-cover"
            style={{ aspectRatio: "16/10" }}
          />
        </Card>
      )}

      {publishedDate && (
        <div className="flex items-center gap-2 text-sm text-slate-600 px-1">
          <Calendar className="h-4 w-4" />
          <span>{new Date(publishedDate).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric",
          })}</span>
        </div>
      )}
    </aside>
  );
}
