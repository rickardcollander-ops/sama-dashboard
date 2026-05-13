import { AGENTS } from "@/lib/agents";
import type { ActiveRun, AgentKey } from "@/lib/hooks/useActiveRuns";

// Single source of truth for "what analyses exist, and when do they run".
// Complements lib/agents.ts (which owns colors/icons) by describing cadence,
// triggers and requirements so the dashboard can render a unified hub.
//
// Strings are inline Swedish on purpose: localising every analysis label and
// cron description across four languages would be a much larger change. The
// surrounding chrome (group titles, buttons, status pills) does go through
// lib/locales/index.ts so language switching still works.

export type AnalysisCategory = "recurring" | "channel" | "deep";
export type Cadence = "on-demand" | "daily" | "weekly" | "autopilot";
export type Requirement =
  | "brand_name"
  | "domain"
  | "geo_queries"
  | "competitors"
  | "github";

export interface AnalysisStatusInputs {
  geoSummary?: { last_check_at?: string } | null;
  seoStats?: { updated_at?: string } | null;
  contentStats?: { updated_at?: string } | null;
  trafficLastSyncedAt?: string | null;
  siteAuditLastRun?: string | null;
}

export interface RequirementChecks {
  brand_name: boolean;
  domain: boolean;
  geo_queries: boolean;
  competitors: boolean;
  github: boolean;
}

export interface AnalysisDef {
  id: string;
  agentKey?: AgentKey;
  agentIconId: keyof typeof AGENTS;
  label: string;
  description: string;
  category: AnalysisCategory;
  cadence: Cadence;
  /** Human-readable schedule, shown when cadence !== "on-demand". */
  cronDescription?: string;
  /** Manual trigger endpoint. Missing = not user-runnable from the hub. */
  triggerEndpoint?: string;
  /** Detail page link. */
  href: string;
  requires: ReadonlyArray<Requirement>;
  /** Reads "last run" timestamp from the data the dashboard already loads. */
  lastRunSelector: (props: AnalysisStatusInputs) => string | undefined | null;
}

export const ANALYSES: ReadonlyArray<AnalysisDef> = [
  // --- Återkommande (recurring) ----------------------------------------
  {
    id: "geo",
    agentKey: "ai_visibility",
    agentIconId: "geo",
    label: "AI-synlighet (GEO)",
    description: "Spårar nämnanden i ChatGPT, Claude, Perplexity m.fl.",
    category: "recurring",
    cadence: "weekly",
    cronDescription: "Måndagar 07:30",
    triggerEndpoint: "/api/ai-visibility/check",
    href: "/c/geo",
    requires: ["brand_name", "geo_queries"],
    lastRunSelector: (p) => p.geoSummary?.last_check_at,
  },
  {
    id: "seo",
    agentKey: "seo",
    agentIconId: "seo",
    label: "SEO & Google",
    description: "Spårar ranking och klick från Google Search Console.",
    category: "recurring",
    cadence: "daily",
    cronDescription: "Dagligen 02:00",
    triggerEndpoint: "/api/seo/keywords/track",
    href: "/c/seo",
    requires: ["domain"],
    lastRunSelector: (p) => p.seoStats?.updated_at,
  },
  {
    id: "analytics",
    agentKey: "analytics",
    agentIconId: "analytics",
    label: "Analytics",
    description: "Trafik och kanalmix från GA4 och kopplade källor.",
    category: "recurring",
    cadence: "daily",
    cronDescription: "Dagligen 04:00",
    triggerEndpoint: "/api/tenant/agents/analytics/trigger",
    href: "/c/analytics",
    requires: ["domain"],
    lastRunSelector: (p) => p.trafficLastSyncedAt,
  },
  {
    id: "site_audit",
    agentKey: "site_audit",
    agentIconId: "tech",
    label: "Sajtanalys",
    description: "Crawl + tekniskt och innehållsmässigt djuptest av upp till 200 sidor.",
    category: "recurring",
    cadence: "weekly",
    cronDescription: "Veckovis (söndagar)",
    href: "/c/audit",
    requires: ["domain"],
    lastRunSelector: (p) => p.siteAuditLastRun,
  },

  // --- Innehåll & kanaler (channel) ------------------------------------
  {
    id: "content",
    agentKey: "content",
    agentIconId: "content",
    label: "Content",
    description: "Genererar idéer och utkast — du godkänner i kö.",
    category: "channel",
    cadence: "autopilot",
    cronDescription: "Onsdagar 06:00 (autopilot)",
    href: "/c/content",
    requires: ["brand_name", "domain"],
    lastRunSelector: (p) => p.contentStats?.updated_at,
  },
  {
    id: "social",
    agentIconId: "social",
    label: "Social",
    description: "Föreslår och schemalägger inlägg.",
    category: "channel",
    cadence: "autopilot",
    cronDescription: "Tisdagar 11:00 (autopilot)",
    href: "/c/social",
    requires: ["brand_name"],
    lastRunSelector: () => undefined,
  },
  {
    id: "ads",
    agentIconId: "ads",
    label: "Ads",
    description: "AI-genererade annonser och kreativ.",
    category: "channel",
    cadence: "on-demand",
    href: "/c/ads",
    requires: ["domain"],
    lastRunSelector: () => undefined,
  },
  {
    id: "tech",
    agentIconId: "tech",
    label: "Tech",
    description: "Föreslår löpande PR:s med sajt-förbättringar.",
    category: "channel",
    cadence: "on-demand",
    href: "/c/tech",
    requires: ["github"],
    lastRunSelector: () => undefined,
  },

  // Sajtanalys was previously in its own "Djupanalyser" group but the
  // dashboard now folds it into Återkommande checks (no extra section
  // for a single-item category).
];

export const ANALYSES_BY_CATEGORY: Record<AnalysisCategory, AnalysisDef[]> = {
  recurring: ANALYSES.filter((a) => a.category === "recurring"),
  channel: ANALYSES.filter((a) => a.category === "channel"),
  deep: ANALYSES.filter((a) => a.category === "deep"),
};

export type RowStatus = "running" | "ok" | "error" | "idle";

/**
 * Latest status of a given analysis, derived from the active-runs ledger.
 * Mirrors the logic that lived inline in AgentChips so AnalysisRow can share
 * it. "idle" simply means "no recent run we know of"; the row falls back to
 * lastRunSelector for a "last run" timestamp.
 */
export function pickStatus(runs: ActiveRun[], def: AnalysisDef): RowStatus {
  if (!def.agentKey) return "idle";
  const matching = runs.filter((r) => r.agent === def.agentKey);
  if (matching.length === 0) return "idle";
  const latest = [...matching].sort((a, b) => b.triggered_at - a.triggered_at)[0];
  if (latest.status === "running" || latest.status === "pending") return "running";
  if (latest.status === "failed") return "error";
  return "ok";
}

/** Returns the list of requirements that are NOT satisfied. */
export function missingRequirements(
  def: AnalysisDef,
  checks: RequirementChecks,
): Requirement[] {
  return def.requires.filter((r) => !checks[r]);
}
