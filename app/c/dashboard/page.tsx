"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, RefreshCw, Play, ArrowRight, AlertCircle, X, Sparkles,
  PenTool, Share2, Megaphone, Clock, Check, Bot, Zap,
} from "lucide-react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { usePeriod } from "@/lib/hooks/usePeriod";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { tenantApi } from "@/lib/api";
import { useActiveRuns, type AgentKey } from "@/lib/hooks/useActiveRuns";
import { AGENTS, AGENT_LIST } from "@/lib/agents";
import TrendBadge from "@/components/dashboard/TrendBadge";
import PeriodSelector from "@/components/dashboard/PeriodSelector";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import AgentCard, { type MetricRow } from "@/components/dashboard/AgentCard";
import OnboardingChecklist, { type ChecklistItem } from "@/components/dashboard/OnboardingChecklist";

interface CustomerSettings {
  brand_name?: string;
  domain?: string;
  brand_description?: string;
  geo_queries?: string[];
  geo_platforms?: string[];
  competitors?: string[];
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

interface LeadStats {
  total: number;
  meetings: number;
  total_delta?: number;
  updated_at?: string;
}

function fmtRelative(iso?: string): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CustomerDashboard() {
  const { user, loading: userLoading } = useUser();
  const { period, setPeriod, days } = usePeriod();
  const router = useRouter();
  const [settings, setSettings] = useState<CustomerSettings>({});
  const [geoSummary, setGeoSummary] = useState<GeoSummary | null>(null);
  const [seoStats, setSeoStats] = useState<SeoStats | null>(null);
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const { runs, triggerRun } = useActiveRuns();
  const runAllActive = runs.some(
    (r) => r.status === "running" || r.status === "pending",
  );

  useEffect(() => {
    if (!user || userLoading) return;
    (async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase
          .from("user_settings")
          .select("settings")
          .eq("user_id", user.id)
          .single();
        if (!data?.settings?.brand_name) {
          router.push("/c/onboarding");
          return;
        }
      } catch {
        router.push("/c/onboarding");
        return;
      }
      setCheckedOnboarding(true);
    })();
  }, [user, userLoading, router]);

  useEffect(() => {
    if (user && checkedOnboarding) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, checkedOnboarding, days]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (actionFeedback) {
      const t = setTimeout(() => setActionFeedback(""), 4000);
      return () => clearTimeout(t);
    }
  }, [actionFeedback]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      loadSettings(),
      loadGeoSummary(),
      loadSeoStats(),
      loadContentStats(),
      loadLeadStats(),
    ]);
    if (results.every((r) => r.status === "rejected")) {
      setError("Could not load data. Please try again.");
    }
    setLastRefresh(new Date());
    setLoading(false);
  };

  const loadSettings = async () => {
    if (!user) return;
    const sb = getSupabaseBrowser();
    const { data } = await sb.from("user_settings").select("settings").eq("user_id", user.id).single();
    if (data?.settings) setSettings(data.settings);
  };

  const loadGeoSummary = async () => {
    if (!user) return;
    const data = await tenantApi(user.id).get<GeoSummary>(`/api/ai-visibility/summary?days=${days}`);
    if (data) setGeoSummary(data);
  };

  const loadSeoStats = async () => {
    if (!user) return;
    const data = await tenantApi(user.id).get<any>(`/api/seo/stats?days=${days}`);
    if (data) {
      setSeoStats({
        totalKeywords: data.total_keywords ?? data.totalKeywords ?? 0,
        avgPosition: data.avg_position ?? data.avgPosition ?? 0,
        totalClicks: data.total_clicks ?? data.totalClicks ?? 0,
        clicksDelta: data.clicks_delta ?? data.clicksDelta,
        positionDelta: data.position_delta ?? data.positionDelta,
        updated_at: data.updated_at,
      });
    }
  };

  const loadContentStats = async () => {
    if (!user) return;
    try {
      const data = await tenantApi(user.id).get<any>(`/api/content/stats?days=${days}`);
      if (data) {
        setContentStats({
          total: data.total ?? data.pieces?.length ?? 0,
          published: data.published ?? 0,
          drafts: data.drafts ?? 0,
          delta: data.delta_percent ?? data.delta,
          updated_at: data.updated_at,
        });
        return;
      }
    } catch {}
    try {
      const pieces = await tenantApi(user!.id).get<any>("/api/content/pieces?limit=1");
      setContentStats({ total: pieces?.total ?? pieces?.pieces?.length ?? 0, published: 0, drafts: 0 });
    } catch {}
  };

  const loadLeadStats = async () => {
    if (!user) return;
    const data = await tenantApi(user.id).get<any>(`/api/leads/stats?days=${days}`);
    if (data) {
      const s = data.stats || data;
      setLeadStats({
        total: s.total ?? 0,
        meetings: s.meeting_booked ?? s.meetings ?? 0,
        total_delta: s.total_delta ?? s.delta_percent,
        updated_at: s.updated_at,
      });
    }
  };

  const runQuickAction = async (agent: string, endpoint: string, successMsg: string) => {
    if (!user) return;
    setRunningAction(agent);
    try {
      await tenantApi(user.id).post(endpoint);
      setActionFeedback(successMsg);
      setTimeout(() => loadData(), 1500);
    } catch (err: any) {
      setError(`Could not run action: ${err?.message || err}`);
    }
    setRunningAction(null);
  };

  const runAllChecks = async () => {
    if (!user) return;
    const targets: { agent: AgentKey; endpoint: string }[] = [
      { agent: "ai_visibility", endpoint: "/api/ai-visibility/check" },
      { agent: "seo", endpoint: "/api/seo/keywords/track" },
      { agent: "analytics", endpoint: "/api/tenant/agents/analytics/trigger" },
      { agent: "ads", endpoint: "/api/tenant/agents/ads/trigger" },
    ];
    setActionFeedback("Triggering all agents — progress shown in the bottom-right banner.");
    for (const t of targets) {
      // Fire sequentially so we don't blast the rate limiter all at once
      await triggerRun(t.agent, t.endpoint);
    }
  };

  // Derived
  const hasSetup = !!(settings.brand_name && settings.domain);
  const mentionRate = geoSummary?.mention_rate ?? 0;
  const mentionRateDelta =
    geoSummary?.mention_rate_delta ??
    (geoSummary?.previous_mention_rate != null && geoSummary?.mention_rate != null
      ? geoSummary.mention_rate - geoSummary.previous_mention_rate
      : null);

  const checklistItems: ChecklistItem[] = useMemo(
    () => [
      { id: "brand", label: "Add brand info", description: "Name, domain, and description", done: !!(settings.brand_name && settings.domain), href: "/c/settings", cta: "Configure" },
      { id: "competitors", label: "Add competitors", description: "At least 2 competitors for comparison", done: (settings.competitors?.length ?? 0) >= 2, href: "/c/settings", cta: "Add" },
      { id: "geo_queries", label: "Set up GEO queries", description: "Queries to monitor in AI assistants", done: (settings.geo_queries?.length ?? 0) >= 1, href: "/c/settings", cta: "Set up" },
      { id: "first_check", label: "Run your first GEO check", description: "See how visible you are in AI", done: (geoSummary?.total_checks ?? 0) > 0, href: "/c/geo", cta: "Run" },
      { id: "first_keyword", label: "Track your first keyword", description: "SEO monitoring", done: (seoStats?.totalKeywords ?? 0) > 0, href: "/c/seo", cta: "Add" },
      { id: "first_content", label: "Generate your first content piece", description: "AI-generated article or post", done: (contentStats?.total ?? 0) > 0, href: "/c/content", cta: "Generate" },
    ],
    [settings, geoSummary, seoStats, contentStats]
  );

  // Build metric rows for each agent card
  const geoMetrics: MetricRow[] = [
    {
      label: "Mention Rate",
      value: <span className={`text-lg font-bold ${mentionRate >= 0.5 ? "text-green-600" : mentionRate > 0 ? "text-yellow-600" : "text-red-600"}`}>{Math.round(mentionRate * 100)}%</span>,
      trend: <TrendBadge delta={mentionRateDelta} format="percent" />,
    },
    { label: "Open Gaps", value: <span className="text-lg font-bold text-slate-900">{geoSummary?.open_gaps ?? 0}</span> },
    { label: "Total Checks", value: <span className="text-lg font-bold text-slate-900">{geoSummary?.total_checks ?? 0}</span> },
  ];

  const seoMetrics: MetricRow[] = [
    { label: "Keywords", value: <span className="text-lg font-bold text-slate-900">{seoStats?.totalKeywords ?? 0}</span> },
    {
      label: "Avg. Position",
      value: <span className={`text-lg font-bold ${(seoStats?.avgPosition ?? 0) > 0 && (seoStats?.avgPosition ?? 0) <= 10 ? "text-green-600" : (seoStats?.avgPosition ?? 0) <= 30 ? "text-yellow-600" : "text-slate-900"}`}>{(seoStats?.avgPosition ?? 0) > 0 ? seoStats!.avgPosition.toFixed(1) : "—"}</span>,
      trend: <TrendBadge delta={seoStats?.positionDelta ?? null} format="rank" inverted />,
    },
    {
      label: `Clicks (${period})`,
      value: <span className="text-lg font-bold text-slate-900">{(seoStats?.totalClicks ?? 0).toLocaleString()}</span>,
      trend: <TrendBadge delta={seoStats?.clicksDelta ?? null} format="percent" />,
    },
  ];

  const contentMetrics: MetricRow[] = [
    {
      label: "Content Pieces",
      value: <span className="text-lg font-bold text-slate-900">{contentStats?.total ?? 0}</span>,
      trend: <TrendBadge delta={contentStats?.delta ?? null} format="percent" />,
    },
    {
      label: "Leads Generated",
      value: <span className="text-lg font-bold text-blue-600">{leadStats?.total ?? 0}</span>,
      trend: <TrendBadge delta={leadStats?.total_delta ?? null} format="percent" />,
    },
    { label: "Meetings Booked", value: <span className="text-lg font-bold text-green-600">{leadStats?.meetings ?? 0}</span> },
  ];

  const analyticsMetrics: MetricRow[] = [
    { label: "Active Agents", value: <span className="text-lg font-bold text-green-600">{AGENT_LIST.length}</span> },
  ];

  // Loading skeleton
  if (loading && checkedOnboarding && !geoSummary && !seoStats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
          <div className="mb-8"><div className="h-8 w-64 rounded-lg bg-slate-200 animate-pulse" /><div className="mt-2 h-4 w-48 rounded bg-slate-200 animate-pulse" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4"><div className="h-11 w-11 rounded-lg bg-slate-200 animate-pulse" /><div><div className="h-4 w-24 rounded bg-slate-200 animate-pulse" /><div className="mt-1 h-3 w-40 rounded bg-slate-200 animate-pulse" /></div></div>
                <div className="space-y-3"><div className="h-4 rounded bg-slate-200 animate-pulse" /><div className="h-4 rounded bg-slate-200 animate-pulse" /><div className="h-4 rounded bg-slate-200 animate-pulse" /></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {settings.brand_name ? `Welcome, ${settings.brand_name}` : "Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Overview of your marketing agents
              <span className="ml-2 text-xs text-slate-400">· Updated {fmtRelative(lastRefresh.toISOString())}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PeriodSelector value={period} onChange={setPeriod} />
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={runAllChecks}
              disabled={runAllActive || !hasSetup}
              title={!hasSetup ? "Configure your brand in Settings first" : "Triggers GEO, SEO, Analytics and Ads agents"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm"
            >
              <Zap className="h-3.5 w-3.5" />
              {runAllActive ? "Running…" : "Run All Checks"}
            </button>
          </div>
        </div>

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

        {hasSetup && <OnboardingChecklist items={checklistItems} />}

        {!hasSetup && (
          <Link href="/c/settings" className="mb-8 flex items-center gap-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 hover:bg-blue-100 transition-colors">
            <div className="rounded-full bg-blue-100 p-3"><Search className="h-6 w-6 text-blue-600" /></div>
            <div className="flex-1"><h3 className="text-lg font-semibold text-blue-900">Get Started</h3><p className="text-sm text-blue-700">Configure your brand, competitors, and GEO queries to start monitoring.</p></div>
            <ArrowRight className="h-5 w-5 text-blue-400" />
          </Link>
        )}

        {/* Agent cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <AgentCard
            agent={AGENTS.geo}
            lastUpdated={geoSummary?.last_check_at ? fmtRelative(geoSummary.last_check_at) : "never run"}
            metrics={geoMetrics}
            quickAction={{
              label: "Run check",
              icon: <Play className="h-4 w-4" />,
              onClick: () => runQuickAction("geo", "/api/ai-visibility/check", "GEO check started"),
              loading: runningAction === "geo",
            }}
          />

          <AgentCard
            agent={AGENTS.seo}
            lastUpdated={seoStats?.updated_at ? fmtRelative(seoStats.updated_at) : undefined}
            metrics={seoMetrics}
            quickAction={{
              label: "Run check",
              icon: <RefreshCw className="h-4 w-4" />,
              onClick: () => runQuickAction("seo", "/api/seo/keywords/track", "SEO check started"),
              loading: runningAction === "seo",
            }}
          />

          <AgentCard
            agent={AGENTS.content}
            lastUpdated={contentStats?.updated_at ? fmtRelative(contentStats.updated_at) : undefined}
            metrics={contentMetrics}
            quickAction={{
              label: "Generate",
              icon: <Sparkles className="h-4 w-4" />,
              onClick: () => runQuickAction("content", "/api/content/generate", "Content generation started"),
              loading: runningAction === "content",
            }}
          />

          <AgentCard
            agent={AGENTS.analytics}
            metrics={analyticsMetrics}
          >
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AGENT_LIST.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  <a.icon className="h-2.5 w-2.5" />{a.label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />Running continuously
            </p>
          </AgentCard>
        </div>

        {/* Activity feed + Quick links */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {user && <ActivityFeed userId={user.id} />}
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-slate-900">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { href: "/c/social", icon: Share2, color: "text-indigo-600", label: "Create social post" },
                { href: "/c/ads", icon: Megaphone, color: "text-orange-600", label: "Launch ad campaign" },
                { href: "/c/content", icon: PenTool, color: "text-purple-600", label: "Generate article" },
                { href: "/c/settings", icon: Bot, color: "text-slate-600", label: "Agent settings" },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                  <link.icon className={`h-4 w-4 ${link.color}`} />
                  <div className="flex-1 text-sm font-medium text-slate-700">{link.label}</div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Config summary */}
        {hasSetup && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Your Configuration</h3>
              <Link href="/c/settings" className="text-sm text-blue-600 hover:text-blue-800">Edit</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-slate-500 mb-1">Brand</p>
                <p className="font-medium text-slate-900">{settings.brand_name}</p>
                <p className="text-slate-400">{settings.domain}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Competitors</p>
                <div className="flex flex-wrap gap-1">
                  {(settings.competitors || []).map((c) => (
                    <span key={c} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">{c}</span>
                  ))}
                  {(settings.competitors || []).length === 0 && <span className="text-slate-400">None</span>}
                </div>
              </div>
              <div>
                <p className="text-slate-500 mb-1">GEO Queries</p>
                <p className="font-medium text-slate-900">{(settings.geo_queries || []).length} queries</p>
                <p className="text-slate-400">{(settings.geo_platforms || []).length} platforms</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
