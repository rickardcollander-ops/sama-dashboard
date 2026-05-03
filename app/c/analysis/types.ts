/**
 * Shared types for the SEO + GEO unified analysis (P2.9).
 *
 * The analysis takes a list of queries and runs each one across:
 *  - SerpAPI (top 10 + AI Overview + featured snippet)
 *  - 1..N AI engines (ChatGPT, Claude, Perplexity, Gemini, Google AIO, Copilot)
 *
 * For each query we capture both SEO and GEO signals, then bucket them into
 * gap categories with concrete CTAs.
 */

export type AIPlatform =
  | "chatgpt"
  | "claude"
  | "perplexity"
  | "gemini"
  | "google_aio"
  | "copilot";

export const AI_PLATFORM_LABELS: Record<AIPlatform, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  google_aio: "Google AIO",
  copilot: "Copilot",
};

export type GapCategory =
  | "seo_winner_geo_loser"
  | "geo_winner_seo_loser"
  | "both_losers"
  | "both_winners"
  | "competitor_dominates";

export const GAP_LABELS: Record<GapCategory, { title: string; cta: string; tone: "amber" | "rose" | "slate" | "emerald" | "red" }> = {
  seo_winner_geo_loser: {
    title: "SEO winner, GEO loser",
    cta: "Generate brand-citation content",
    tone: "amber",
  },
  geo_winner_seo_loser: {
    title: "GEO winner, SEO loser",
    cta: "Build pillar content + backlinks",
    tone: "rose",
  },
  both_losers: {
    title: "Both losers",
    cta: "Draft new content angle",
    tone: "slate",
  },
  both_winners: {
    title: "Both winners",
    cta: "Hold position — monitor monthly",
    tone: "emerald",
  },
  competitor_dominates: {
    title: "Competitor dominates",
    cta: "Counter-position content",
    tone: "red",
  },
};

export interface AIPlatformResult {
  platform: AIPlatform;
  /** Whether the brand was mentioned anywhere in the AI response. */
  mentioned: boolean;
  /** If mentioned: at what ordinal position in the response (1 = first mention). */
  rank: number | null;
  /** Whether the AI cited the brand domain as a source. */
  cited_as_source: boolean;
  sentiment: "positive" | "neutral" | "negative" | null;
  competitors_mentioned: string[];
}

export interface QueryResult {
  query: string;
  /** Brand's Google rank for this query (1..100, or null if not in top 100). */
  seo_rank: number | null;
  /** How many of the top 10 Google results are competitors. */
  seo_competitors_in_top10: number;
  /** Per-AI-platform results. */
  ai_results: AIPlatformResult[];
  /** Gap category derived from SEO + GEO signals. */
  gap: GapCategory;
}

export interface AnalysisOverview {
  /** Across all queries × all platforms, what % did we get mentioned in. */
  overall_mention_rate: number;
  /** Across all queries, what % did we rank in top 10 on Google. */
  seo_top10_coverage: number;
  /** Number of queries where we appear somewhere (SEO or any AI). */
  queries_with_presence: number;
  total_queries: number;
  /** Top opportunities: gaps with high traffic potential. */
  top_opportunities: { query: string; reason: string }[];
}

export interface AnalysisRun {
  id: string;
  created_at: string;
  brand_name: string;
  domain: string;
  platforms: AIPlatform[];
  query_results: QueryResult[];
  overview: AnalysisOverview;
  site_audit?: SiteAudit | null;
  status: "running" | "completed" | "failed";
  /** "mock" when the dashboard could not reach the live agent backend. */
  _source?: "mock" | "live";
  /** Human-readable explanation when _source === "mock". */
  _mock_reason?: string;
}

/* ── Site audit (full SEO/GEO/technical/links report) ───────────────────── */

export type AuditSeverity = "high" | "medium" | "low";
export type AuditCategory = "technical" | "geo" | "content" | "links";

export interface AuditIssue {
  severity: AuditSeverity;
  category: AuditCategory;
  title: string;
  detail: string;
}

export interface AuditScores {
  overall: number;
  technical: number;
  geo: number;
  content: number;
  links: number;
  details: {
    pages_ok?: number;
    pages_total?: number;
    robots_present?: boolean;
    sitemap_present?: boolean;
    sitemap_url_count?: number;
    with_canonical?: number;
    with_viewport?: number;
    with_lang?: number;
    with_og?: number;
    with_schema?: number;
    with_faq_or_article_schema?: number;
    with_proper_h1?: number;
    with_good_title?: number;
    with_good_meta?: number;
    long_enough_pages?: number;
    avg_word_count?: number;
    alt_coverage?: number;
    avg_internal_links?: number;
    broken_link_rate?: number;
  };
}

export interface AuditPageReport {
  url: string;
  status_code: number | null;
  response_time_ms: number | null;
  title: string | null;
  title_length: number;
  meta_description: string | null;
  meta_description_length: number;
  h1_count: number;
  h1_text: string | null;
  h2_count: number;
  h3_count: number;
  word_count: number;
  canonical: string | null;
  has_viewport: boolean;
  has_lang: boolean;
  has_og_tags: boolean;
  has_twitter_card: boolean;
  schema_types: string[];
  image_count: number;
  images_missing_alt: number;
  internal_links: number;
  external_links: number;
  issues: string[];
  page_score: number;
}

export interface SiteAudit {
  domain: string;
  pages_crawled: number;
  robots_txt: { present: boolean; sitemap_url: string | null; size: number };
  sitemap: { present: boolean; url: string | null; url_count: number; urls: string[] };
  scores: AuditScores;
  issues: AuditIssue[];
  broken_links: {
    checked: number;
    broken_count: number;
    broken: { url: string; status: number }[];
  };
  pages: AuditPageReport[];
}
