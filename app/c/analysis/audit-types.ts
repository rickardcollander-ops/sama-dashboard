/**
 * Types for the full-domain site audit (SEO + GEO + technical + link health).
 *
 * The backend (sama-agent /api/site-audit/*) crawls the domain, parses each
 * page, scores five categories 0–100, and returns a structured report. The
 * dashboard renders gauges, per-page tables, and recommendation lists from it.
 */

export type AuditSeverity = "critical" | "warning" | "info" | "success";
export type AuditCategory = "technical" | "on_page" | "geo" | "links" | "performance";
export type AuditPriority = "high" | "medium" | "low";
/** Buckets recommendations get grouped into in the dashboard. */
export type RecommendationGroup = "quick_win" | "strategic" | "technical_debt" | "monitoring";
export type KeywordIntent = "informational" | "commercial" | "transactional" | "navigational";
export type KeywordDifficulty = "low" | "medium" | "high";
/** "low" / "medium" / "high" for the impact/effort fields on a recommendation. */
export type ImpactEffort = "low" | "medium" | "high";

export interface SiteAuditScores {
  overall: number;
  technical_seo: number;
  on_page_seo: number;
  geo_readiness: number;
  link_health: number;
  performance: number;
}

export interface SiteAuditMetaFileInfo {
  url?: string;
  status?: number;
  error?: string | null;
  fallback_from?: string;
  attempts?: SiteAuditMetaFileInfo[];
}

export interface SiteAuditSummary {
  pages_analyzed: number;
  pages_loaded?: number;
  pages_failed?: number;
  reachable?: boolean;
  total_pages_discovered: number;
  has_robots_txt: boolean;
  has_sitemap_xml: boolean;
  has_llms_txt: boolean;
  https: boolean;
  avg_response_ms: number;
  total_links_checked: number;
  broken_links_count: number;
  audit_duration_ms: number;
  meta_files?: {
    robots_txt?: SiteAuditMetaFileInfo;
    sitemap_xml?: SiteAuditMetaFileInfo;
    llms_txt?: SiteAuditMetaFileInfo;
  };
}

export interface SiteAuditPage {
  url: string;
  status_code: number;
  response_ms: number;
  title: string | null;
  title_length: number;
  meta_description: string | null;
  meta_description_length: number;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  word_count: number;
  images_total: number;
  images_missing_alt: number;
  /** Images without explicit width+height — cause CLS. */
  images_missing_dimensions?: number;
  /** Images below the fold without `loading="lazy"`. */
  images_missing_lazy?: number;
  canonical: string | null;
  has_schema: boolean;
  schema_types: string[];
  has_open_graph: boolean;
  has_viewport: boolean;
  has_lang: boolean;
  /** True if the page declares any <link rel="alternate" hreflang>. */
  has_hreflang?: boolean;
  internal_links: number;
  external_links: number;
  /** Heading texts captured for the keyword opportunity layer. */
  h1_text?: string | null;
  h2_texts?: string[];
  /** Presence map for the security headers we surface. */
  security_headers?: Record<string, boolean>;
  issues: string[];
}

export interface SiteAuditBrokenLink {
  url: string;
  status_code: number;
  found_on: string[];
}

export interface SiteAuditFinding {
  category: AuditCategory;
  severity: AuditSeverity;
  title: string;
  description: string;
  affected_pages: number;
  /** Sample of URLs this finding applies to (capped). */
  affected_urls?: string[];
  /** Concrete fix instructions, often containing code snippets. */
  how_to_fix?: string | null;
  /** Estimated traffic / visibility impact. */
  impact?: ImpactEffort | null;
  /** Estimated implementation effort. */
  effort?: ImpactEffort | null;
  /** Bucket the dashboard groups recommendations under. */
  group?: RecommendationGroup | null;
}

export interface SiteAuditRecommendation {
  priority: AuditPriority;
  category: AuditCategory;
  title: string;
  description: string;
  affected_count: number;
  /** Sample of URLs this recommendation applies to (capped). */
  affected_urls?: string[];
  /** Concrete fix instructions, often containing code snippets. */
  how_to_fix?: string | null;
  /** Estimated traffic / visibility impact. */
  impact?: ImpactEffort | null;
  /** Estimated implementation effort. */
  effort?: ImpactEffort | null;
  /** Bucket the dashboard groups recommendations under. */
  group?: RecommendationGroup | null;
}

/* ── Keyword opportunities ───────────────────────────────────────────────── */

export interface KeywordCurrent {
  /** The phrase the site is already targeting (lowercased). */
  phrase: string;
  /** Internal weight from the extractor — higher = stronger signal. */
  score: number;
  /** A small sample of pages targeting this phrase. */
  pages: string[];
  /** Total number of pages targeting this phrase. */
  page_count: number;
}

export interface KeywordOpportunity {
  keyword: string;
  intent: KeywordIntent;
  difficulty: KeywordDifficulty;
  reasoning: string;
  is_long_tail: boolean;
  /** URL of the existing page best suited to target this keyword, if any. */
  target_url: string | null;
  target_status: "existing_page" | "new_page_needed";
  target_note: string;
}

export interface KeywordCluster {
  pillar: string;
  head_term: string;
  supporting: string[];
  size: number;
}

export interface KeywordCompetitorGap {
  keyword: string;
  competitors_in_top10: string[];
  note: string;
}

export interface KeywordOpportunities {
  current_keywords: KeywordCurrent[];
  opportunities: KeywordOpportunity[];
  clusters: KeywordCluster[];
  competitor_gap: KeywordCompetitorGap[];
  /** Related searches + People-Also-Ask from ValueSERP for the top seed term. */
  related_searches: string[];
  primary_seed: string;
}

export interface SiteAuditRun {
  id: string;
  domain: string;
  base_url?: string;
  status: "running" | "completed" | "failed";
  scores: SiteAuditScores;
  summary: SiteAuditSummary;
  pages: SiteAuditPage[];
  broken_links: SiteAuditBrokenLink[];
  findings: SiteAuditFinding[];
  recommendations: SiteAuditRecommendation[];
  /** Recommendations bucketed by execution profile — quick wins first. */
  recommendation_groups?: Partial<Record<RecommendationGroup, SiteAuditRecommendation[]>>;
  /** Keyword extraction + suggestions to grow organic + AI traffic. */
  keyword_opportunities?: KeywordOpportunities | null;
  created_at?: string;
  error?: string;
}

export const RECOMMENDATION_GROUP_META: Record<RecommendationGroup, { label: string; description: string }> = {
  quick_win: {
    label: "Quick wins",
    description: "Low-effort fixes with measurable impact — start here.",
  },
  strategic: {
    label: "Strategic",
    description: "Higher effort but compounding return — plan into the next sprint.",
  },
  technical_debt: {
    label: "Technical debt",
    description: "Infrastructure or hygiene work that prevents future regressions.",
  },
  monitoring: {
    label: "Monitoring",
    description: "Healthy signals to keep an eye on so they don't regress.",
  },
};

export const KEYWORD_INTENT_META: Record<KeywordIntent, { label: string; tone: "blue" | "violet" | "emerald" | "slate" }> = {
  informational: { label: "Info",          tone: "blue" },
  commercial:    { label: "Commercial",    tone: "violet" },
  transactional: { label: "Transactional", tone: "emerald" },
  navigational:  { label: "Navigational",  tone: "slate" },
};

export interface SiteAuditRunSummary {
  id: string;
  domain: string | null;
  pages_analyzed: number;
  overall_score: number | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

export const SCORE_CATEGORY_META: Record<keyof SiteAuditScores, { label: string; description: string }> = {
  overall: {
    label: "Overall site health",
    description: "Weighted average across all five audit categories.",
  },
  technical_seo: {
    label: "Technical SEO",
    description: "HTTPS, robots.txt, sitemap, viewport, lang, canonical tags.",
  },
  on_page_seo: {
    label: "On-page SEO",
    description: "Titles, meta descriptions, headings, content depth, alt text.",
  },
  geo_readiness: {
    label: "GEO readiness",
    description: "Schema.org, OpenGraph, llms.txt, structured headings — how cite-worthy you are to AI assistants.",
  },
  link_health: {
    label: "Link health",
    description: "Outbound links that resolve. Broken links waste crawl budget and hurt trust.",
  },
  performance: {
    label: "Performance",
    description: "Server response time across audited pages.",
  },
};

export function scoreTone(score: number): "emerald" | "amber" | "rose" {
  if (score >= 80) return "emerald";
  if (score >= 50) return "amber";
  return "rose";
}
