import type {
  AIPlatform,
  AIPlatformResult,
  AnalysisRun,
  AuditPageReport,
  GapCategory,
  QueryResult,
  SiteAudit,
} from "@/app/c/analysis/types";

/**
 * Mock backend for the SEO + GEO unified analysis. Used while the real
 * orchestration in sama-agent (SerpAPI fan-out + multi-LLM prompts) is wired up.
 *
 * Every call here is deterministic-ish so the UI can be developed and demoed
 * without burning real LLM tokens.
 */

function pickGap(seoRank: number | null, mentioned: number, total: number, hasCompetitor: boolean): GapCategory {
  const seoStrong = seoRank !== null && seoRank <= 10;
  const geoStrong = mentioned / Math.max(total, 1) >= 0.5;
  if (hasCompetitor && !seoStrong && !geoStrong) return "competitor_dominates";
  if (seoStrong && !geoStrong) return "seo_winner_geo_loser";
  if (!seoStrong && geoStrong) return "geo_winner_seo_loser";
  if (seoStrong && geoStrong) return "both_winners";
  return "both_losers";
}

function fakeAiResult(platform: AIPlatform, query: string, brand: string, competitors: string[]): AIPlatformResult {
  const seed = (platform.length + query.length + brand.length) % 7;
  const mentioned = seed > 2;
  const rank = mentioned ? (seed % 3) + 1 : null;
  const competitorPick = competitors.length ? competitors[seed % competitors.length] : null;
  return {
    platform,
    mentioned,
    rank,
    cited_as_source: mentioned && seed % 2 === 0,
    sentiment: mentioned ? (seed % 3 === 0 ? "positive" : "neutral") : null,
    competitors_mentioned: competitorPick ? [competitorPick] : [],
  };
}

export function buildMockRun(input: {
  brand_name: string;
  domain: string;
  competitors: string[];
  queries: string[];
  platforms: AIPlatform[];
}): AnalysisRun {
  const { brand_name, domain, competitors, queries, platforms } = input;

  const query_results: QueryResult[] = queries.map((q, idx) => {
    const seoRank = idx % 4 === 0 ? null : ((idx * 7) % 30) + 1;
    const ai_results = platforms.map((p) => fakeAiResult(p, q, brand_name, competitors));
    const mentioned = ai_results.filter((r) => r.mentioned).length;
    const hasCompetitorDominance = ai_results.some((r) => r.competitors_mentioned.length > 0);
    return {
      query: q,
      seo_rank: seoRank,
      seo_competitors_in_top10: idx % 3,
      ai_results,
      gap: pickGap(seoRank, mentioned, ai_results.length, hasCompetitorDominance),
    };
  });

  const totalSlots = query_results.length * Math.max(platforms.length, 1);
  const totalMentions = query_results.reduce(
    (acc, q) => acc + q.ai_results.filter((r) => r.mentioned).length,
    0,
  );
  const seoTop10 = query_results.filter((q) => q.seo_rank !== null && q.seo_rank <= 10).length;
  const queriesWithPresence = query_results.filter(
    (q) => (q.seo_rank !== null && q.seo_rank <= 10) || q.ai_results.some((r) => r.mentioned),
  ).length;

  const top_opportunities = query_results
    .filter((q) => q.gap === "seo_winner_geo_loser" || q.gap === "geo_winner_seo_loser")
    .slice(0, 3)
    .map((q) => ({
      query: q.query,
      reason:
        q.gap === "seo_winner_geo_loser"
          ? "You rank on Google but AIs don't mention you — citation gap"
          : "AIs mention you but Google doesn't rank you — backlink/pillar gap",
    }));

  return {
    id: `run_${Date.now()}`,
    created_at: new Date().toISOString(),
    brand_name,
    domain,
    platforms,
    query_results,
    overview: {
      overall_mention_rate: totalSlots ? totalMentions / totalSlots : 0,
      seo_top10_coverage: query_results.length ? seoTop10 / query_results.length : 0,
      queries_with_presence: queriesWithPresence,
      total_queries: query_results.length,
      top_opportunities,
    },
    site_audit: buildMockSiteAudit(domain),
    status: "completed",
  };
}

export function buildMockSiteAudit(domain: string): SiteAudit {
  const host = (domain || "example.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const samplePaths = ["/", "/pricing", "/features", "/blog", "/about", "/contact"];
  const pages: AuditPageReport[] = samplePaths.map((path, i) => {
    const wc = 320 + ((i * 173) % 900);
    const hasMeta = i % 3 !== 0;
    const hasSchema = i % 2 === 0;
    const issues: string[] = [];
    if (!hasMeta) issues.push("Missing meta description");
    if (!hasSchema) issues.push("No schema.org JSON-LD (hurts AI/GEO discovery)");
    if (wc < 400) issues.push(`Thin content (${wc} words)`);
    return {
      url: `https://${host}${path}`,
      status_code: i === samplePaths.length - 1 ? 200 : 200,
      response_time_ms: 240 + i * 35,
      title: `${host} — ${path === "/" ? "Home" : path.slice(1)}`,
      title_length: 30 + i * 4,
      meta_description: hasMeta ? `Mock meta for ${path}` : null,
      meta_description_length: hasMeta ? 120 : 0,
      h1_count: 1,
      h1_text: path === "/" ? "Welcome" : path.slice(1),
      h2_count: 3 + (i % 3),
      h3_count: 2,
      word_count: wc,
      canonical: `https://${host}${path}`,
      has_viewport: true,
      has_lang: true,
      has_og_tags: i % 2 === 0,
      has_twitter_card: i % 3 === 0,
      schema_types: hasSchema ? ["Organization", i % 4 === 0 ? "FAQPage" : "Article"] : [],
      image_count: 4 + i,
      images_missing_alt: i % 4 === 0 ? 2 : 0,
      internal_links: 8 + i * 2,
      external_links: 1 + (i % 3),
      issues,
      page_score: 70 + ((i * 5) % 20),
    };
  });
  return {
    domain: host,
    pages_crawled: pages.length,
    robots_txt: { present: true, sitemap_url: `https://${host}/sitemap.xml`, size: 220 },
    sitemap: { present: true, url: `https://${host}/sitemap.xml`, url_count: 12, urls: [] },
    scores: {
      overall: 72,
      technical: 80,
      geo: 64,
      content: 70,
      links: 78,
      details: {
        pages_ok: pages.length,
        pages_total: pages.length,
        robots_present: true,
        sitemap_present: true,
        sitemap_url_count: 12,
        with_canonical: pages.length,
        with_viewport: pages.length,
        with_lang: pages.length,
        with_og: 4,
        with_schema: 3,
        with_faq_or_article_schema: 2,
        with_proper_h1: pages.length,
        with_good_title: pages.length,
        with_good_meta: 4,
        long_enough_pages: 5,
        avg_word_count: 720,
        alt_coverage: 90,
        avg_internal_links: 12.4,
        broken_link_rate: 2.5,
      },
    },
    issues: [
      { severity: "high", category: "geo", title: "3/6 pages have no schema markup",
        detail: "Add JSON-LD (Article, FAQPage, Product, Organization) to help AI engines cite you." },
      { severity: "medium", category: "content", title: "2 thin pages (<400 words)",
        detail: "Expand thin pages with substantive copy that answers buyer questions." },
      { severity: "medium", category: "technical", title: "2 pages missing meta description",
        detail: "Meta descriptions drive click-through from SERPs and AI summaries." },
    ],
    broken_links: { checked: 12, broken_count: 1, broken: [{ url: `https://${host}/old-page`, status: 404 }] },
    pages,
  };
}

export function suggestQueries(input: {
  brand_name: string;
  domain: string;
  brand_description?: string;
  unique_selling_points?: string;
  target_audience?: string;
  category?: string;
}): string[] {
  // These queries are sent to AI assistants to measure unbiased visibility,
  // so they must NOT contain the brand name or domain — otherwise the AI sees
  // the brand in the prompt and the result is biased.
  const audience = input.target_audience || "B2B teams";
  const category = input.category || "tools in this category";
  return [
    `Best ${category} for ${audience}`,
    `Top ${category} for ${audience} in 2025`,
    `How to choose ${category}`,
    `${category} pricing benchmarks`,
    `${category} reviews and ratings`,
    `Most popular ${category}`,
    `What should I look for when buying ${category}?`,
    `${category} use cases for ${audience}`,
    `Leading vendors in ${category}`,
    `Recommended ${category} for growing teams`,
  ];
}
