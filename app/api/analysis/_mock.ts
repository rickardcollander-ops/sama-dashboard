import type {
  AIPlatform,
  AIPlatformResult,
  AnalysisRun,
  GapCategory,
  QueryResult,
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
    status: "completed",
  };
}

export function suggestQueries(input: {
  brand_name: string;
  domain: string;
  brand_description?: string;
  unique_selling_points?: string;
  target_audience?: string;
}): string[] {
  const seed = input.brand_name || "your brand";
  // Deterministic placeholder list — real implementation uses an LLM with the
  // brand's USP and audience to produce buyer-intent queries.
  return [
    `What is the best ${seed} alternative?`,
    `${seed} vs competitors`,
    `How does ${seed} compare to other tools in the market?`,
    `Top tools for ${input.target_audience || "B2B teams"}`,
    `Is ${seed} worth it?`,
    `${seed} pricing and plans`,
    `${seed} reviews and ratings`,
    `Best alternatives to ${seed}`,
    `${seed} use cases`,
    `Why choose ${seed}?`,
  ];
}
