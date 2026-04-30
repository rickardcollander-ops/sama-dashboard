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
  status: "running" | "completed" | "failed";
}
