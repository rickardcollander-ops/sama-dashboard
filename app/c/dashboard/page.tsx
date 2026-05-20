"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, RefreshCw, ArrowRight, AlertCircle, X, Check, Zap,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import CustomerNav from "@/components/CustomerNav";
import PageHeader from "@/components/PageHeader";
import StatScoreboard, { type ScoreboardStat } from "@/components/StatScoreboard";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { isAdminEmail } from "@/lib/admin";
import { usePeriod } from "@/lib/hooks/usePeriod";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { useActiveRuns, type AgentKey } from "@/lib/hooks/useActiveRuns";
import TrendBadge from "@/components/dashboard/TrendBadge";
import PeriodSelector from "@/components/dashboard/PeriodSelector";
import type { ChecklistItem } from "@/components/dashboard/OnboardingChecklist";
import type { AnalysisStatusInputs, RequirementChecks } from "@/lib/analyses";

// Recharts is ~150 kB gzipped — load it on the client only after the page
// shell paints so the headline numbers (StatScoreboard) appear immediately.
// Placeholder height matches the expanded chart (header ~56px + chart 224px +
// padding) so hydration doesn't shift content below.
const TrafficGraph = dynamic(() => import("@/components/dashboard/TrafficGraph"), {
  ssr: false,
  loading: () => <div className="h-[304px] rounded-xl border bg-white shadow-sm" />,
});

// Below-the-fold sections — split so the initial JS payload only includes
// what the user sees on first paint.
const AnalysisHub = dynamic(() => import("@/components/dashboard/AnalysisHub"), {
  loading: () => <div className="h-72 rounded-xl border bg-white shadow-sm" />,
});
const RecentOutcomes = dynamic(() => import("@/components/dashboard/RecentOutcomes"), {
  loading: () => null,
});
const OnboardingChecklist = dynamic(() => import("@/components/dashboard/OnboardingChecklist"), {
  loading: () => null,
});
const UpcomingDrafts = dynamic(() => import("@/components/dashboard/UpcomingDrafts"), {
  loading: () => null,
});
const AutoApproveToggle = dynamic(() => import("@/components/content/AutoApproveToggle"), {
  loading: () => null,
});

interface CustomerSettings {
  brand_name?: string;
  domain?: string;
  brand_description?: string;
  geo_queries?: string[];
  geo_platforms?: string[];
  competitors?: string[];
  project_start_date?: string;
  // Set by the onboarding wizard as its last step. When present, the
  // dashboard switches the "Kom igång" checklist to a "Kvar att göra"
  // integration list (Google / GitHub / CMS).
  onboarding_completed_at?: string;
}

interface DailyMetric {
  date: string;
  clicks: number;
  impressions: number;
}

interface TrafficData {
  daily?: DailyMetric[];
  seo_daily?: DailyMetric[];
}

interface GeoSummary {
  mention_rate?: number;
  open_gaps?: number;
  total_checks?: number;
  last_check_at?: string;
  mention_rate_delta?: number;
  previous_mention_rate?: number;
}

interface SeoStats {
  totalKeywords: number;
  avgPosition: number;
  totalClicks: number;
  clicksDelta?: number;
  positionDelta?: number;
  updated_at?: string;
}

interface ContentStats {
  total: number;
  published: number;
  drafts: number;
  delta?: number;
  updated_at?: string;
}

// Shape consumed by RecentOutcomes / UpcomingDrafts. Keep it loose so the
// shared fetch here doesn't have to mirror every column they read — they
// each pick their own fields.
interface DashboardPieceRow {
  id: string;
  title: string;
  type?: string;
  content_type?: string;
  status: string;
  published_at?: string | null;
  scheduled_for?: string | null;
  created_at?: string;
  source_gap_id?: string | null;
  source_gap_title?: string | null;
  source_strategy_topic?: string | null;
  impressions_30d?: number;
  clicks_30d?: number;
}

export default function CustomerDashboard() {
  const { user, loading: userLoading } = useUser();
  const {
    tenantClient,
    effectiveTenantId,
    activeSite,
    sites,
    loading: sitesLoading,
  } = useSite();
  const { period, setPeriod, days } = usePeriod();
  const { t } = useLanguage();
  const router = useRouter();
  // Derived from the active site so the page header and checklist reflect
  // the currently selected site, not a stale row from the legacy
  // user_settings table.
  const settings = useMemo<CustomerSettings>(
    () => (activeSite?.settings as CustomerSettings) || {},
    [activeSite],
  );
  const [geoSummary, setGeoSummary] = useState<GeoSummary | null>(null);
  const [seoStats, setSeoStats] = useState<SeoStats | null>(null);
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);
  const [anyContentEver, setAnyContentEver] = useState(false);
  // Single fetch shared with RecentOutcomes + UpcomingDrafts so the two
  // below-the-fold sections don't each fire their own /api/content/pieces.
  const [recentPieces, setRecentPieces] = useState<DashboardPieceRow[] | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  // Integration connection status — only used post-onboarding to drive the
  // "Kvar att göra" checklist (Google services, GitHub, CMS). Cheap calls,
  // run once on first load and never refreshed (settings page refetches).
  const [googleConnected, setGoogleConnected] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [cmsConnected, setCmsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [trafficData, setTrafficData] = useState<TrafficData>({});
  const [showTotalTraffic, setShowTotalTraffic] = useState(true);
  const [showSeoTraffic, setShowSeoTraffic] = useState(true);
  const { runs, triggerRun } = useActiveRuns();
  const runAllActive = runs.some(
    (r) => r.status === "running" || r.status === "pending",
  );

  function fmtRelative(iso?: string): string {
    if (!iso) return t.time.never;
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.time.justNow;
    if (mins < 60) return `${mins}${t.time.minutesSuffix}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}${t.time.hoursSuffix}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}${t.time.daysSuffix}`;
    return new Date(iso).toLocaleDateString();
  }

  // Onboarding gate: only push first-run users into /c/onboarding. Anyone
  // with a brand_name on their active site, or who has explicitly clicked
  // "Hoppa över", stays on the dashboard. Reading from useSite() (instead
  // of querying user_settings directly) means we look at the same table
  // that onboarding writes to — without that, completed onboarding still
  // bounced back here because user_settings was empty.
  useEffect(() => {
    if (!user || userLoading || sitesLoading) return;

    // Admins routinely jump between tenants in view-as mode — including
    // brand-new ones that don't have a brand_name yet. Forcing them
    // through the customer onboarding wizard locks them out of their
    // own dashboard, so we never auto-redirect the operator account.
    if (isAdminEmail(user.email)) {
      setCheckedOnboarding(true);
      return;
    }

    // Any of these signals means the user has already engaged with
    // setup at some point — don't push them back into the wizard.
    const s = settings as Record<string, unknown>;
    if (
      settings.brand_name ||
      settings.domain ||
      typeof s.onboarding_completed_at === "string"
    ) {
      setCheckedOnboarding(true);
      return;
    }

    const skipped =
      typeof window !== "undefined" &&
      window.localStorage.getItem("sama_onboarding_skipped") === "1";
    if (skipped) {
      setCheckedOnboarding(true);
      return;
    }

    if (sites.length === 0) {
      router.push("/c/onboarding");
      return;
    }

    // Has a site row but no brand_name yet — let them in; the in-app
    // checklist + "Kom igång"-bannern guides them to fill it out.
    setCheckedOnboarding(true);
  }, [user, userLoading, sitesLoading, sites.length, settings, router]);

  // Clear cached metrics when the active site changes so we never render the
  // previous site's numbers while the new fetch is still in flight.
  useEffect(() => {
    setGeoSummary(null);
    setSeoStats(null);
    setContentStats(null);
    setAnyContentEver(false);
    setRecentPieces(null);
    setPendingApprovals(0);
    setTrafficData({});
    setGoogleConnected(false);
    setGithubConnected(false);
    setCmsConnected(false);
  }, [effectiveTenantId]);

  useEffect(() => {
    if (user && checkedOnboarding && effectiveTenantId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, checkedOnboarding, days, effectiveTenantId]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      loadGeoSummary(),
      loadSeoStats(),
      loadContentStats(),
      loadPendingApprovals(),
      loadTrafficData(),
      loadIntegrationStatus(),
    ]);
    if (results.every((r) => r.status === "rejected")) {
      setError(t.dashboard.loadError);
    }
    setLastRefresh(new Date());
    setLoading(false);
  };

  // Fires the three integration status calls in parallel. Each one swallows
  // its own errors so a flaky GitHub status doesn't blank out Google/CMS.
  const loadIntegrationStatus = async () => {
    if (!effectiveTenantId) return;
    await Promise.all([
      (async () => {
        try {
          const data = await tenantClient.get<{
            search_console?: { connected: boolean };
            analytics?: { connected: boolean };
            ads?: { connected: boolean };
          }>("/api/auth/google/status");
          setGoogleConnected(!!(data?.search_console?.connected || data?.analytics?.connected || data?.ads?.connected));
        } catch { /* silent */ }
      })(),
      (async () => {
        try {
          const data = await tenantClient.get<{ connected?: boolean }>(
            "/api/integrations/github/status",
          );
          setGithubConnected(!!data?.connected);
        } catch { /* silent */ }
      })(),
      (async () => {
        try {
          const res = await fetch("/api/integrations/destinations", {
            headers: effectiveTenantId ? { "X-Sama-Site-Id": effectiveTenantId, "X-Tenant-ID": effectiveTenantId } : {},
          });
          if (res.ok) {
            const data = (await res.json().catch(() => ({}))) as { destinations?: unknown[] };
            setCmsConnected(Array.isArray(data.destinations) && data.destinations.length > 0);
          }
        } catch { /* silent */ }
      })(),
    ]);
  };

  const loadTrafficData = async () => {
    if (!user) return;
    try {
      const data = await tenantClient.get<TrafficData>(`/api/analytics/overview?days=${days}`);
      if (data) setTrafficData(data);
    } catch { /* silent */ }
  };

  const loadGeoSummary = async () => {
    if (!user) return;
    const data = await tenantClient.get<GeoSummary>(`/api/ai-visibility/summary?days=${days}`);
    if (data) setGeoSummary(data);
  };

  const loadSeoStats = async () => {
    if (!user) return;
    const data = await tenantClient.get<Record<string, unknown>>(`/api/seo/stats?days=${days}`);
    if (data) {
      setSeoStats({
        totalKeywords: (data.total_keywords ?? data.totalKeywords ?? 0) as number,
        avgPosition: (data.avg_position ?? data.avgPosition ?? 0) as number,
        totalClicks: (data.total_clicks ?? data.totalClicks ?? 0) as number,
        clicksDelta: (data.clicks_delta ?? data.clicksDelta) as number | undefined,
        positionDelta: (data.position_delta ?? data.positionDelta) as number | undefined,
        updated_at: data.updated_at as string | undefined,
      });
    }
  };

  const loadContentStats = async () => {
    if (!user) return;
    // Run both calls in parallel — they're independent, and the original
    // sequential pattern was adding a full extra round-trip to the
    // slowest leg of loadData() on every dashboard refresh.
    // The pieces fetch is bumped to limit=50 so RecentOutcomes and
    // UpcomingDrafts can reuse the response instead of refetching the
    // same endpoint twice from below the fold.
    const [statsResult, piecesResult] = await Promise.allSettled([
      tenantClient.get<Record<string, unknown>>(`/api/content/stats?days=${days}`),
      tenantClient.get<{ pieces?: DashboardPieceRow[]; total?: number }>(
        "/api/content/pieces?limit=50",
      ),
    ]);
    if (statsResult.status === "fulfilled" && statsResult.value) {
      const data = statsResult.value;
      const pieces = data.pieces as unknown[] | undefined;
      setContentStats({
        total: (data.total ?? pieces?.length ?? 0) as number,
        published: (data.published ?? 0) as number,
        drafts: (data.drafts ?? 0) as number,
        delta: (data.delta_percent ?? data.delta) as number | undefined,
        updated_at: data.updated_at as string | undefined,
      });
    }
    if (piecesResult.status === "fulfilled" && piecesResult.value) {
      const list = piecesResult.value.pieces ?? [];
      const allTimeTotal = piecesResult.value.total ?? list.length;
      setAnyContentEver(allTimeTotal > 0);
      setRecentPieces(list);
    } else {
      // Surface an empty array so the children stop showing their loading
      // state instead of hanging on `null` forever after a failed fetch.
      setRecentPieces([]);
    }
  };

  const loadPendingApprovals = async () => {
    if (!user || !effectiveTenantId) return;
    try {
      const res = await fetch("/api/approvals?status=pending", {
        headers: { "X-Tenant-ID": effectiveTenantId },
      });
      if (res.ok) {
        const data = (await res.json()) as { approvals?: unknown[] };
        setPendingApprovals(data.approvals?.length ?? 0);
      }
    } catch { /* silent */ }
  };

  const runAllChecks = async () => {
    if (!user) return;
    const targets: { agent: AgentKey; endpoint: string }[] = [
      { agent: "ai_visibility", endpoint: "/api/ai-visibility/check" },
      { agent: "seo", endpoint: "/api/seo/keywords/track" },
      { agent: "analytics", endpoint: "/api/tenant/agents/analytics/trigger" },
    ];
    setActionFeedback(t.dashboard.runningAgents);
    for (const target of targets) {
      await triggerRun(target.agent, target.endpoint);
    }
  };

  const hasSetup = !!(settings.brand_name && settings.domain);
  const mentionRate = geoSummary?.mention_rate ?? 0;
  const mentionRateDelta =
    geoSummary?.mention_rate_delta ??
    (geoSummary?.previous_mention_rate != null && geoSummary?.mention_rate != null
      ? geoSummary.mention_rate - geoSummary.previous_mention_rate
      : null);

  // Onboarding wizard writes settings.onboarding_completed_at as the very
  // last step. Once that's set, the original 6-item "Kom igång" list has
  // served its purpose — flip to a leaner "Kvar att göra" surface that
  // only shows the integrations the wizard can't set up on the user's
  // behalf (Google services, GitHub, CMS destinations).
  const onboardingCompleted = !!settings.onboarding_completed_at;

  const checklistItems: ChecklistItem[] = useMemo(() => {
    if (onboardingCompleted) {
      return [
        {
          id: "google",
          label: "Anslut Google-tjänster",
          description: "Search Console, Analytics och Ads för faktisk Google-data",
          done: googleConnected,
          href: "/c/settings/integrations",
          cta: "Anslut",
        },
        {
          id: "github",
          label: "Anslut GitHub",
          description: "Publicera artiklar via pull request direkt till din repo",
          done: githubConnected,
          href: "/c/settings/integrations",
          cta: "Anslut",
        },
        {
          id: "cms",
          label: "Lägg till en CMS-destination",
          description: "WordPress, Webflow, Ghost eller en webhook",
          done: cmsConnected,
          href: "/c/settings/integrations",
          cta: "Lägg till",
        },
      ];
    }
    return [
      { id: "brand", label: t.dashboard.checkBrand, description: t.dashboard.checkBrandDesc, done: !!(settings.brand_name && settings.domain), href: "/c/settings", cta: t.dashboard.checkBrandCta },
      { id: "competitors", label: t.dashboard.checkCompetitors, description: t.dashboard.checkCompetitorsDesc, done: (settings.competitors?.length ?? 0) >= 2, href: "/c/settings", cta: t.dashboard.checkCompetitorsCta },
      { id: "geo_queries", label: t.dashboard.checkGeoQueries, description: t.dashboard.checkGeoQueriesDesc, done: (settings.geo_queries?.length ?? 0) >= 1, href: "/c/geo", cta: t.dashboard.checkGeoQueriesCta },
      { id: "first_check", label: t.dashboard.checkFirstCheck, description: t.dashboard.checkFirstCheckDesc, done: (geoSummary?.total_checks ?? 0) > 0, href: "/c/geo", cta: t.dashboard.checkFirstCheckCta },
      { id: "first_keyword", label: t.dashboard.checkFirstKeyword, description: t.dashboard.checkFirstKeywordDesc, done: (seoStats?.totalKeywords ?? 0) > 0, href: "/c/seo", cta: t.dashboard.checkFirstKeywordCta },
      { id: "first_content", label: t.dashboard.checkFirstContent, description: t.dashboard.checkFirstContentDesc, done: anyContentEver, href: "/c/content", cta: t.dashboard.checkFirstContentCta },
    ];
  }, [onboardingCompleted, googleConnected, githubConnected, cmsConnected, settings, geoSummary, seoStats, anyContentEver, t]);

  const scoreboardStats: ScoreboardStat[] = useMemo(() => {
    const mentionPct = Math.round(mentionRate * 100);
    const avgPos = seoStats?.avgPosition ?? 0;
    const published = contentStats?.published ?? contentStats?.total ?? 0;
    return [
      {
        key: "mention",
        label: t.dashboard.aiMentionRate,
        tooltip: t.dashboard.aiMentionTooltip,
        caption: t.dashboard.aiMentionCaption,
        href: "/c/analysis",
        value: geoSummary ? `${mentionPct}%` : "—",
        trend: <TrendBadge delta={mentionRateDelta} format="percent" />,
        hint: geoSummary?.last_check_at
          ? `${t.dashboard.lastChecked} ${fmtRelative(geoSummary.last_check_at)}`
          : t.dashboard.noCheckYet,
      },
      {
        key: "google",
        label: t.dashboard.googleVisibility,
        tooltip: t.dashboard.googleTooltip,
        caption: t.dashboard.googleCaption,
        href: googleConnected ? "/c/analysis" : "/c/settings/integrations",
        value: googleConnected && avgPos > 0 ? avgPos.toFixed(1) : "—",
        trend: googleConnected ? <TrendBadge delta={seoStats?.positionDelta ?? null} format="rank" inverted /> : undefined,
        hint: !googleConnected
          ? t.dashboard.googleNotConnected
          : avgPos > 0
            ? `${seoStats?.totalKeywords ?? 0} ${t.dashboard.keywordsTracked}`
            : t.dashboard.noKeywords,
      },
      {
        key: "content",
        label: t.dashboard.publishedContent,
        tooltip: `${t.dashboard.publishedContent} (${period})`,
        caption: t.dashboard.contentCaption,
        href: "/c/content",
        value: published,
        trend: <TrendBadge delta={contentStats?.delta ?? null} format="percent" />,
        hint: contentStats?.drafts ? `${contentStats.drafts} ${t.dashboard.draftsWaiting}` : undefined,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoSummary, seoStats, contentStats, mentionRate, mentionRateDelta, period, t]);

  const projectStartDate: string | null = useMemo(() => {
    if (settings.project_start_date) return settings.project_start_date;
    if (user?.created_at) return user.created_at.slice(0, 10);
    return null;
  }, [settings.project_start_date, user?.created_at]);

  // Memoised so the dynamically-loaded NextSteps component receives a stable
  // reference and doesn't re-render on every parent paint (e.g. each refresh
  // tick of the active-runs banner).
  const nextStepsInput = useMemo(
    () => ({
      pendingApprovals,
      mentionRateDelta,
      publishedLast30d: contentStats?.published ?? contentStats?.total ?? 0,
      alertsCount: 0,
    }),
    [pendingApprovals, mentionRateDelta, contentStats?.published, contentStats?.total],
  );

  const statusInputs = useMemo<AnalysisStatusInputs>(
    () => ({
      geoSummary,
      seoStats,
      contentStats,
      // Traffic doesn't expose a last_synced_at yet — fall back to the most
      // recent point in the daily series we already pull for the chart.
      trafficLastSyncedAt:
        trafficData.daily?.[trafficData.daily.length - 1]?.date ?? null,
      siteAuditLastRun: null,
    }),
    [geoSummary, seoStats, contentStats, trafficData.daily],
  );

  const requirementChecks = useMemo<RequirementChecks>(
    () => ({
      brand_name: !!settings.brand_name,
      domain: !!settings.domain,
      geo_queries: (settings.geo_queries?.length ?? 0) > 0,
      competitors: (settings.competitors?.length ?? 0) >= 2,
      // We don't have a reliable signal here yet; assume the Tech card is
      // always disabled until the user opens /c/tech and connects.
      github: false,
    }),
    [settings.brand_name, settings.domain, settings.geo_queries, settings.competitors],
  );

  const triggerAgent = (agent: AgentKey, endpoint: string) => {
    void triggerRun(agent, endpoint);
  };

  if (loading && checkedOnboarding && !geoSummary && !seoStats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="h-8 w-64 rounded-lg bg-slate-200 animate-pulse" />
              <div className="mt-2 h-4 w-48 rounded bg-slate-200 animate-pulse" />
            </div>
            <div className="hidden sm:flex gap-2">
              <div className="h-7 w-24 rounded-lg bg-slate-200 animate-pulse" />
              <div className="h-7 w-28 rounded-lg bg-slate-200 animate-pulse" />
            </div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl bg-slate-200" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-5">
                <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
                <div className="mt-3 h-7 w-16 rounded bg-slate-200 animate-pulse" />
                <div className="mt-2 h-3 w-32 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="mt-8 space-y-4">
            <div className="h-[304px] rounded-xl border bg-white shadow-sm" />
            <div className="h-[304px] rounded-xl border bg-white shadow-sm" />
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 h-64 rounded-xl border bg-white shadow-sm" />
            <div className="h-64 rounded-xl border bg-white shadow-sm" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <PageHeader
          title={settings.brand_name ? `${settings.brand_name}` : t.nav.home}
          subtitle={t.dashboard.subtitle}
          meta={`${t.time.lastUpdated} ${fmtRelative(lastRefresh.toISOString())}`}
          actions={
            <>
              <PeriodSelector value={period} onChange={setPeriod} />
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                {t.dashboard.refreshView}
              </button>
              <button
                onClick={runAllChecks}
                disabled={runAllActive || !hasSetup}
                title={!hasSetup ? t.settings.aiFillDomainRequired : undefined}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm"
              >
                <Zap className="h-3.5 w-3.5" />
                {runAllActive ? t.dashboard.fetching : t.dashboard.updateNow}
              </button>
            </>
          }
        />

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
            <button onClick={() => setError("")} className="ml-auto text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
          </div>
        )}

        {actionFeedback && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0" />{actionFeedback}
          </div>
        )}

        {hasSetup && (
          <OnboardingChecklist
            items={checklistItems}
            title={onboardingCompleted ? "Kvar att göra" : undefined}
            hideWhenAllDone={onboardingCompleted}
          />
        )}

        {!hasSetup && (
          <Link href="/c/settings" className="mb-8 flex items-center gap-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 hover:bg-blue-100 transition-colors">
            <div className="rounded-full bg-blue-100 p-3"><Search className="h-6 w-6 text-blue-600" /></div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900">{t.dashboard.getStarted}</h3>
              <p className="text-sm text-blue-700">{t.dashboard.getStartedDesc}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-400" />
          </Link>
        )}

        <StatScoreboard stats={scoreboardStats} />

        <div className="mt-8 space-y-4">
          <TrafficGraph
            title={t.dashboard.totalTraffic}
            subtitle={t.dashboard.totalTrafficDesc}
            data={trafficData.daily}
            projectStartDate={projectStartDate}
            visible={showTotalTraffic}
            onToggle={() => setShowTotalTraffic((v: boolean) => !v)}
            lines={[
              { key: "clicks", label: t.dashboard.clicks, color: "#3b82f6" },
              { key: "impressions", label: t.dashboard.impressions, color: "#8b5cf6" },
            ]}
            noData={googleConnected ? t.dashboard.noData : t.dashboard.googleNotConnected}
            noDataDesc={googleConnected ? t.dashboard.noDataDesc : t.dashboard.googleNotConnectedDesc}
            noDataHref={googleConnected ? undefined : "/c/settings/integrations"}
            chartStart={t.dashboard.chartStart}
          />

          <TrafficGraph
            title={t.dashboard.seoTraffic}
            subtitle={t.dashboard.seoTrafficDesc}
            data={trafficData.seo_daily}
            projectStartDate={projectStartDate}
            visible={showSeoTraffic}
            onToggle={() => setShowSeoTraffic((v: boolean) => !v)}
            lines={[
              { key: "clicks", label: t.dashboard.clicks, color: "#10b981" },
              { key: "impressions", label: t.dashboard.exposures, color: "#f59e0b" },
            ]}
            noData={googleConnected ? t.dashboard.noData : t.dashboard.googleNotConnected}
            noDataDesc={googleConnected ? t.dashboard.noDataDesc : t.dashboard.googleNotConnectedDesc}
            noDataHref={googleConnected ? undefined : "/c/settings/integrations"}
            chartStart={t.dashboard.chartStart}
          />
        </div>

        <div className="mt-8">
          <AnalysisHub
            runs={runs}
            onTrigger={triggerAgent}
            statusInputs={statusInputs}
            requirementChecks={requirementChecks}
            nextStepsInput={nextStepsInput}
          />
        </div>

        {user && (
          <div className="mt-8 space-y-4">
            <AutoApproveToggle tenantId={effectiveTenantId} userId={user.id} />
            <UpcomingDrafts tenantId={effectiveTenantId} pieces={recentPieces} />
          </div>
        )}

        {user && (
          <div className="mt-8">
            <RecentOutcomes tenantId={effectiveTenantId} pieces={recentPieces} />
          </div>
        )}
      </main>
    </div>
  );
}
