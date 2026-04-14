"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Bot, BarChart2, FileText, RefreshCw, Play, ArrowRight,
  AlertCircle, X, Sparkles, PenTool, Share2, Megaphone, Clock, Check,
} from "lucide-react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { createBrowserClient } from "@supabase/ssr";
import { tenantApi } from "@/lib/api";
import TrendBadge from "@/components/dashboard/TrendBadge";
import PeriodSelector, { type Period, PERIOD_DAYS } from "@/components/dashboard/PeriodSelector";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import OnboardingChecklist, { type ChecklistItem } from "@/components/dashboard/OnboardingChecklist";

interface CustomerSettings {
  brand_name?: string;
  domain?: string;
  brand_description?: string;
  geo_queries?: string[];
  geo_platforms?: string[];
  competitors?: string[];
  anthropic_api_key?: string;
  openai_api_key?: string;
  google_connected?: boolean;
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

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
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
  const router = useRouter();
  const [settings, setSettings] = useState<CustomerSettings>({});
  const [geoSummary, setGeoSummary] = useState<GeoSummary | null>(null);
  const [seoStats, setSeoStats] = useState<SeoStats | null>(null);
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);
  const [period, setPeriod] = useState<Period>("30d");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Redirect to onboarding if user has no settings
  useEffect(() => {
    if (!user || userLoading) return;
    (async () => {
      try {
        const supabase = getSupabase();
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

  // Load period from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sama-dashboard-period") as Period | null;
      if (saved && ["7d", "30d", "90d"].includes(saved)) {
        setPeriod(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sama-dashboard-period", period);
    } catch {}
  }, [period]);

  useEffect(() => {
    if (user && checkedOnboarding) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, checkedOnboarding, period]);

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
    const days = PERIOD_DAYS[period];
    const results = await Promise.allSettled([
      loadSettings(),
      loadGeoSummary(days),
      loadSeoStats(days),
      loadContentStats(days),
      loadLeadStats(days),
    ]);
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length === results.length) {
      setError("Could not load data. Please try again.");
    }
    setLastRefresh(new Date());
    setLoading(false);
  };

  const loadSettings = async () => {
    if (!user) return;
    try {
      const sb = getSupabase();
      const { data } = await sb
        .from("user_settings")
        .select("settings")
        .eq("user_id", user.id)
        .single();
      if (data?.settings) setSettings(data.settings);
    } catch (err) {
      console.error("Failed to load user settings:", err);
    }
  };

  const loadGeoSummary = async (days: number) => {
    if (!user) return;
    try {
      const client = tenantApi(user.id);
      const data = await client.get<GeoSummary>(`/api/ai-visibility/summary?days=${days}`);
      if (data) setGeoSummary(data);
    } catch (err) {
      console.error("Failed to load GEO summary:", err);
    }
  };

  const loadSeoStats = async (days: number) => {
    if (!user) return;
    try {
      const client = tenantApi(user.id);
      const data = await client.get<any>(`/api/seo/stats?days=${days}`);
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
    } catch (err) {
      console.error("Failed to load SEO stats:", err);
    }
  };

  const loadContentStats = async (days: number) => {
    if (!user) return;
    try {
      const client = tenantApi(user.id);
      const data = await client.get<any>(`/api/content/stats?days=${days}`);
      if (data) {
        setContentStats({
          total: data.total ?? data.pieces?.length ?? 0,
          published: data.published ?? 0,
          drafts: data.drafts ?? 0,
          delta: data.delta_percent ?? data.delta,
          updated_at: data.updated_at,
        });
      } else {
        // Fallback to pieces endpoint
        const pieces = await client.get<any>("/api/content/pieces?limit=1");
        setContentStats({
          total: pieces?.total ?? pieces?.pieces?.length ?? 0,
          published: 0,
          drafts: 0,
        });
      }
    } catch (err) {
      console.error("Failed to load content stats:", err);
    }
  };

  const loadLeadStats = async (days: number) => {
    if (!user) return;
    try {
      const client = tenantApi(user.id);
      const data = await client.get<any>(`/api/leads/stats?days=${days}`);
      if (data) {
        const s = data.stats || data;
        setLeadStats({
          total: s.total ?? 0,
          meetings: s.meeting_booked ?? s.meetings ?? 0,
          total_delta: s.total_delta ?? s.delta_percent,
          updated_at: s.updated_at,
        });
      }
    } catch (err) {
      console.error("Failed to load lead stats:", err);
    }
  };

  const runQuickAction = async (agent: string, endpoint: string, successMsg: string) => {
    if (!user) return;
    setRunningAction(agent);
    try {
      const client = tenantApi(user.id);
      await client.post(endpoint);
      setActionFeedback(successMsg);
      setTimeout(() => loadData(), 1500);
    } catch (err: any) {
      setError(`Could not run action: ${err?.message || err}`);
    }
    setRunningAction(null);
  };

  const hasSetup = !!(settings.brand_name && settings.domain);
  const mentionRate = geoSummary?.mention_rate ?? 0;
  const mentionRateDelta =
    geoSummary?.mention_rate_delta ??
    (geoSummary?.previous_mention_rate != null && geoSummary?.mention_rate != null
      ? geoSummary.mention_rate - geoSummary.previous_mention_rate
      : null);

  const checklistItems: ChecklistItem[] = useMemo(
    () => [
      {
        id: "brand",
        label: "Add brand info",
        description: "Name, domain, and description",
        done: !!(settings.brand_name && settings.domain),
        href: "/c/settings",
        cta: "Configure",
      },
      {
        id: "competitors",
        label: "Add competitors",
        description: "At least 2 competitors for comparison",
        done: (settings.competitors?.length ?? 0) >= 2,
        href: "/c/settings",
        cta: "Add",
      },
      {
        id: "geo_queries",
        label: "Set up GEO queries",
        description: "Queries to monitor in AI assistants",
        done: (settings.geo_queries?.length ?? 0) >= 1,
        href: "/c/settings",
        cta: "Set up",
      },
      {
        id: "first_check",
        label: "Run your first GEO check",
        description: "See how visible you are in AI",
        done: (geoSummary?.total_checks ?? 0) > 0,
        href: "/c/geo",
        cta: "Run",
      },
      {
        id: "first_keyword",
        label: "Track your first keyword",
        description: "SEO monitoring",
        done: (seoStats?.totalKeywords ?? 0) > 0,
        href: "/c/seo",
        cta: "Add",
      },
      {
        id: "first_content",
        label: "Generate your first content piece",
        description: "AI-generated article or post",
        done: (contentStats?.total ?? 0) > 0,
        href: "/c/content",
        cta: "Generate",
      },
    ],
    [settings, geoSummary, seoStats, contentStats]
  );

  if (loading && checkedOnboarding && !geoSummary && !seoStats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
          <div className="mb-8">
            <div className="h-8 w-64 rounded-lg bg-slate-200 animate-pulse" />
            <div className="mt-2 h-4 w-48 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 rounded-lg bg-slate-200 animate-pulse" />
                  <div>
                    <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
                    <div className="mt-1 h-3 w-40 rounded bg-slate-200 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 rounded bg-slate-200 animate-pulse" />
                  <div className="h-4 rounded bg-slate-200 animate-pulse" />
                  <div className="h-4 rounded bg-slate-200 animate-pulse" />
                </div>
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
              <span className="ml-2 text-xs text-slate-400">
                · Updated {fmtRelative(lastRefresh.toISOString())}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PeriodSelector value={period} onChange={setPeriod} />
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError("")} className="ml-auto text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {actionFeedback && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0" />
            {actionFeedback}
          </div>
        )}

        {/* Onboarding checklist */}
        {hasSetup && (
          <OnboardingChecklist items={checklistItems} />
        )}

        {/* Setup prompt */}
        {!hasSetup && (
          <Link
            href="/c/settings"
            className="mb-8 flex items-center gap-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 hover:bg-blue-100 transition-colors"
          >
            <div className="rounded-full bg-blue-100 p-3">
              <Search className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900">Get Started</h3>
              <p className="text-sm text-blue-700">
                Configure your brand, competitors, and GEO queries to start monitoring.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-400" />
          </Link>
        )}

        {/* Agent cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* GEO Monitor */}
          <div className="flex flex-col rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-violet-50 p-2.5">
                <Bot className="h-6 w-6 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">GEO Monitor</h3>
                  <span className="text-[10px] text-slate-400">
                    {geoSummary?.last_check_at ? fmtRelative(geoSummary.last_check_at) : "never run"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">AI Visibility in ChatGPT, Claude, Perplexity & more</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Mention Rate</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${mentionRate >= 0.5 ? "text-green-600" : mentionRate > 0 ? "text-yellow-600" : "text-red-600"}`}>
                    {Math.round(mentionRate * 100)}%
                  </span>
                  <TrendBadge delta={mentionRateDelta} format="percent" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Open Gaps</span>
                <span className="text-lg font-bold text-slate-900">{geoSummary?.open_gaps ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total Checks</span>
                <span className="text-lg font-bold text-slate-900">{geoSummary?.total_checks ?? 0}</span>
              </div>
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <button
                onClick={() => runQuickAction("geo", "/api/ai-visibility/check", "GEO check started")}
                disabled={runningAction === "geo"}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
              >
                {runningAction === "geo" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run check
              </button>
              <Link
                href="/c/geo"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
              >
                <Bot className="h-4 w-4" /> Open
              </Link>
            </div>
          </div>

          {/* SEO */}
          <div className="flex flex-col rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">SEO</h3>
                  <span className="text-[10px] text-slate-400">
                    {seoStats?.updated_at ? fmtRelative(seoStats.updated_at) : ""}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Rankings, technical audits & keywords</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Keywords</span>
                <span className="text-lg font-bold text-slate-900">{seoStats?.totalKeywords ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Avg. Position</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${(seoStats?.avgPosition ?? 0) > 0 && (seoStats?.avgPosition ?? 0) <= 10 ? "text-green-600" : (seoStats?.avgPosition ?? 0) <= 30 ? "text-yellow-600" : "text-slate-900"}`}>
                    {(seoStats?.avgPosition ?? 0) > 0 ? seoStats!.avgPosition.toFixed(1) : "—"}
                  </span>
                  <TrendBadge delta={seoStats?.positionDelta ?? null} format="rank" inverted />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Clicks ({period})</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900">{(seoStats?.totalClicks ?? 0).toLocaleString()}</span>
                  <TrendBadge delta={seoStats?.clicksDelta ?? null} format="percent" />
                </div>
              </div>
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <button
                onClick={() => runQuickAction("seo", "/api/seo/keywords/track", "SEO check started")}
                disabled={runningAction === "seo"}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {runningAction === "seo" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Run check
              </button>
              <Link
                href="/c/seo"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Search className="h-4 w-4" /> Open
              </Link>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-purple-50 p-2.5">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">Content</h3>
                  <span className="text-[10px] text-slate-400">
                    {contentStats?.updated_at ? fmtRelative(contentStats.updated_at) : ""}
                  </span>
                </div>
                <p className="text-xs text-slate-500">AI-generated articles & pages</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Content Pieces</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900">{contentStats?.total ?? 0}</span>
                  <TrendBadge delta={contentStats?.delta ?? null} format="percent" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Leads Generated</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-blue-600">{leadStats?.total ?? 0}</span>
                  <TrendBadge delta={leadStats?.total_delta ?? null} format="percent" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Meetings Booked</span>
                <span className="text-lg font-bold text-green-600">{leadStats?.meetings ?? 0}</span>
              </div>
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <button
                onClick={() => runQuickAction("content", "/api/content/generate", "Content generation started")}
                disabled={runningAction === "content"}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
              >
                {runningAction === "content" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate
              </button>
              <Link
                href="/c/content"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
              >
                <FileText className="h-4 w-4" /> Open
              </Link>
            </div>
          </div>

          {/* Analytics */}
          <div className="flex flex-col rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-indigo-50 p-2.5">
                <BarChart2 className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900">Analytics</h3>
                <p className="text-xs text-slate-500">Cross-channel metrics & ROI</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Active Agents</span>
                <span className="text-lg font-bold text-green-600">6</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <AgentPill icon={Search} label="SEO" />
                <AgentPill icon={FileText} label="Content" />
                <AgentPill icon={Share2} label="Social" />
                <AgentPill icon={Megaphone} label="Ads" />
                <AgentPill icon={Bot} label="GEO" />
                <AgentPill icon={BarChart2} label="Analytics" />
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Running continuously
              </p>
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <Link
                href="/c/analytics"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <BarChart2 className="h-4 w-4" /> View reports
              </Link>
            </div>
          </div>
        </div>

        {/* Activity feed + Quick links */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {user && <ActivityFeed userId={user.id} />}
          </div>
          <div className="flex flex-col gap-4">
            {/* Quick links */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href="/c/social"
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
                >
                  <Share2 className="h-4 w-4 text-indigo-600" />
                  <div className="flex-1 text-sm font-medium text-slate-700">Create social post</div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link
                  href="/c/ads"
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
                >
                  <Megaphone className="h-4 w-4 text-orange-600" />
                  <div className="flex-1 text-sm font-medium text-slate-700">Launch ad campaign</div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link
                  href="/c/content"
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
                >
                  <PenTool className="h-4 w-4 text-purple-600" />
                  <div className="flex-1 text-sm font-medium text-slate-700">Generate article</div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link
                  href="/c/settings"
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
                >
                  <Bot className="h-4 w-4 text-slate-600" />
                  <div className="flex-1 text-sm font-medium text-slate-700">Agent settings</div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Config summary */}
        {hasSetup && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Your Configuration</h3>
              <Link href="/c/settings" className="text-sm text-blue-600 hover:text-blue-800">
                Edit
              </Link>
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
                    <span key={c} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                      {c}
                    </span>
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

function AgentPill({ icon: Icon, label }: { icon: React.ComponentType<any>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
