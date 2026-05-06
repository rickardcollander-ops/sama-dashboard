"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, RefreshCw, ArrowRight, AlertCircle, X,
  PenTool, Check, Bot, Zap, Code2, Calendar as CalendarIcon, Sparkles,
  ChevronDown, ChevronUp, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import CustomerNav from "@/components/CustomerNav";
import PageHeader from "@/components/PageHeader";
import StatScoreboard, { type ScoreboardStat } from "@/components/StatScoreboard";
import NextSteps, { buildNextSteps } from "@/components/dashboard/NextSteps";
import AgentChips from "@/components/dashboard/AgentChips";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { usePeriod } from "@/lib/hooks/usePeriod";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useActiveRuns, type AgentKey } from "@/lib/hooks/useActiveRuns";
import TrendBadge from "@/components/dashboard/TrendBadge";
import PeriodSelector from "@/components/dashboard/PeriodSelector";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import OnboardingChecklist, { type ChecklistItem } from "@/components/dashboard/OnboardingChecklist";
import RecentOutcomes from "@/components/dashboard/RecentOutcomes";

interface CustomerSettings {
  brand_name?: string;
  domain?: string;
  brand_description?: string;
  geo_queries?: string[];
  geo_platforms?: string[];
  competitors?: string[];
  project_start_date?: string;
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

function fmtRelative(iso?: string): string {
  if (!iso) return "aldrig";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just nu";
  if (mins < 60) return `${mins}m sen`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sen`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d sen`;
  return new Date(iso).toLocaleDateString();
}

export default function CustomerDashboard() {
  const { user, loading: userLoading } = useUser();
  const { tenantClient } = useSite();
  const { period, setPeriod, days } = usePeriod();
  const router = useRouter();
  const [settings, setSettings] = useState<CustomerSettings>({});
  const [geoSummary, setGeoSummary] = useState<GeoSummary | null>(null);
  const [seoStats, setSeoStats] = useState<SeoStats | null>(null);
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);
  const [anyContentEver, setAnyContentEver] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);
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
      loadPendingApprovals(),
      loadTrafficData(),
    ]);
    if (results.every((r) => r.status === "rejected")) {
      setError("Kunde inte hämta data. Försök igen.");
    }
    setLastRefresh(new Date());
    setLoading(false);
  };

  const loadTrafficData = async () => {
    if (!user) return;
    try {
      const data = await tenantClient.get<TrafficData>(`/api/analytics/overview?days=${days}`);
      if (data) setTrafficData(data);
    } catch {
      /* silent — traffic graphs are optional on the homepage */
    }
  };

  const loadSettings = async () => {
    if (!user) return;
    const sb = getSupabaseBrowser();
    const { data } = await sb.from("user_settings").select("settings").eq("user_id", user.id).single();
    if (data?.settings) setSettings(data.settings);
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
    try {
      const data = await tenantClient.get<Record<string, unknown>>(`/api/content/stats?days=${days}`);
      if (data) {
        const pieces = data.pieces as unknown[] | undefined;
        setContentStats({
          total: (data.total ?? pieces?.length ?? 0) as number,
          published: (data.published ?? 0) as number,
          drafts: (data.drafts ?? 0) as number,
          delta: (data.delta_percent ?? data.delta) as number | undefined,
          updated_at: data.updated_at as string | undefined,
        });
      }
    } catch {}
    try {
      const pieces = await tenantClient.get<Record<string, unknown>>("/api/content/pieces?limit=1");
      const list = pieces?.pieces as unknown[] | undefined;
      const allTimeTotal = (pieces?.total ?? list?.length ?? 0) as number;
      setAnyContentEver(allTimeTotal > 0);
    } catch {}
  };

  const loadPendingApprovals = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/approvals?status=pending", {
        headers: { "X-Tenant-ID": user.id },
      });
      if (res.ok) {
        const data = (await res.json()) as { approvals?: unknown[] };
        setPendingApprovals(data.approvals?.length ?? 0);
      }
    } catch {
      /* silent */
    }
  };

  const runAllChecks = async () => {
    if (!user) return;
    const targets: { agent: AgentKey; endpoint: string }[] = [
      { agent: "ai_visibility", endpoint: "/api/ai-visibility/check" },
      { agent: "seo", endpoint: "/api/seo/keywords/track" },
      { agent: "analytics", endpoint: "/api/tenant/agents/analytics/trigger" },
      { agent: "ads", endpoint: "/api/tenant/agents/ads/trigger" },
    ];
    setActionFeedback("Kör agenterna — följ status nere till höger.");
    for (const t of targets) {
      // Sequential to avoid hammering the rate limiter
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
      { id: "brand", label: "Lägg till varumärkesinfo", description: "Namn, domän och beskrivning", done: !!(settings.brand_name && settings.domain), href: "/c/settings", cta: "Lägg till" },
      { id: "competitors", label: "Lägg till konkurrenter", description: "Minst 2 konkurrenter för jämförelse", done: (settings.competitors?.length ?? 0) >= 2, href: "/c/settings", cta: "Lägg till" },
      { id: "geo_queries", label: "Sätt upp sökfrågor", description: "Frågor att bevaka i AI-assistenter", done: (settings.geo_queries?.length ?? 0) >= 1, href: "/c/settings", cta: "Sätt upp" },
      { id: "first_check", label: "Kör din första AI-kontroll", description: "Se hur synligt ditt varumärke är i AI", done: (geoSummary?.total_checks ?? 0) > 0, href: "/c/geo", cta: "Kör" },
      { id: "first_keyword", label: "Spåra ditt första sökord", description: "Google-bevakning", done: (seoStats?.totalKeywords ?? 0) > 0, href: "/c/seo", cta: "Lägg till" },
      { id: "first_content", label: "Skapa ditt första content", description: "AI-genererad artikel eller inlägg", done: anyContentEver, href: "/c/content", cta: "Skapa" },
    ],
    [settings, geoSummary, seoStats, contentStats, anyContentEver]
  );

  // Statusrad — three KPIs at the top of the page.
  const scoreboardStats: ScoreboardStat[] = useMemo(() => {
    const mentionPct = Math.round(mentionRate * 100);
    const avgPos = seoStats?.avgPosition ?? 0;
    const published = contentStats?.published ?? contentStats?.total ?? 0;
    return [
      {
        key: "mention",
        label: "AI-omnämnandegrad",
        tooltip: "Hur ofta ditt varumärke nämns när AI-assistenter får relevanta frågor.",
        caption: "Hur ofta ert varumärke nämns i AI-svar.",
        href: "/c/analysis",
        value: geoSummary ? `${mentionPct}%` : "—",
        trend: <TrendBadge delta={mentionRateDelta} format="percent" />,
        hint: geoSummary?.last_check_at ? `Senast kollat ${fmtRelative(geoSummary.last_check_at)}` : "Ingen kontroll körd än",
      },
      {
        key: "google",
        label: "Google-synlighet",
        tooltip: "Genomsnittlig rankposition för dina spårade sökord.",
        caption: "Snittposition i Google för era sökord — lägre är bättre.",
        href: "/c/analysis",
        value: avgPos > 0 ? avgPos.toFixed(1) : "—",
        trend: <TrendBadge delta={seoStats?.positionDelta ?? null} format="rank" inverted />,
        hint: avgPos > 0 ? `${(seoStats?.totalKeywords ?? 0)} sökord spårade` : "Inga sökord ännu",
      },
      {
        key: "content",
        label: "Publicerat content",
        tooltip: `Antal publicerade artiklar/sidor under valt tidsspann (${period}).`,
        caption: "Artiklar och sidor SAMA har publicerat åt er.",
        href: "/c/content",
        value: published,
        trend: <TrendBadge delta={contentStats?.delta ?? null} format="percent" />,
        hint: contentStats?.drafts ? `${contentStats.drafts} utkast väntar` : undefined,
      },
    ];
  }, [geoSummary, seoStats, contentStats, mentionRate, mentionRateDelta, period]);

  // Use an explicit project start date from settings, or fall back to user's created_at
  const projectStartDate: string | null = useMemo(() => {
    if (settings.project_start_date) return settings.project_start_date;
    if (user?.created_at) return user.created_at.slice(0, 10);
    return null;
  }, [settings.project_start_date, user?.created_at]);

  const nextStepsInput = {
    pendingApprovals,
    mentionRateDelta,
    publishedLast30d: contentStats?.published ?? contentStats?.total ?? 0,
    alertsCount: 0,
  };
  const stepCount = buildNextSteps(nextStepsInput).length;

  // Loading skeleton
  if (loading && checkedOnboarding && !geoSummary && !seoStats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
          <div className="mb-8">
            <div className="h-8 w-64 rounded-lg bg-slate-200 animate-pulse" />
            <div className="mt-2 h-4 w-48 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl bg-slate-200" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-5">
                <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
                <div className="mt-3 h-7 w-16 rounded bg-slate-200 animate-pulse" />
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
        <PageHeader
          title={settings.brand_name ? `Hej, ${settings.brand_name}` : "Hem"}
          subtitle="Så går det med er synlighet och content just nu. Härifrån når du rätt verktyg snabbt."
          meta={`Senast uppdaterad ${fmtRelative(lastRefresh.toISOString())}`}
          actions={
            <>
              <PeriodSelector value={period} onChange={setPeriod} />
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Uppdatera vy
              </button>
              <button
                onClick={runAllChecks}
                disabled={runAllActive || !hasSetup}
                title={!hasSetup ? "Konfigurera ditt varumärke först" : "Hämta senaste data — ungefär 30 sek"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm"
              >
                <Zap className="h-3.5 w-3.5" />
                {runAllActive ? "Hämtar…" : "Uppdatera nu"}
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

        {hasSetup && <OnboardingChecklist items={checklistItems} />}

        {!hasSetup && (
          <Link href="/c/settings" className="mb-8 flex items-center gap-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 hover:bg-blue-100 transition-colors">
            <div className="rounded-full bg-blue-100 p-3"><Search className="h-6 w-6 text-blue-600" /></div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900">Kom igång</h3>
              <p className="text-sm text-blue-700">Lägg in varumärke, konkurrenter och sökfrågor för att börja mäta.</p>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-400" />
          </Link>
        )}

        {/* Statusrad */}
        <StatScoreboard stats={scoreboardStats} />

        {/* Trafikgrafer */}
        <div className="mt-8 space-y-4">
          <TrafficGraph
            title="Total trafik"
            subtitle="Klick och visningar per dag (alla kanaler)"
            data={trafficData.daily}
            projectStartDate={projectStartDate}
            visible={showTotalTraffic}
            onToggle={() => setShowTotalTraffic((v: boolean) => !v)}
            lines={[
              { key: "clicks", label: "Klick", color: "#3b82f6" },
              { key: "impressions", label: "Visningar", color: "#8b5cf6" },
            ]}
          />

          <TrafficGraph
            title="SEO – klick & exponeringar"
            subtitle="Klick och exponeringar per dag från Google Search Console"
            data={trafficData.seo_daily}
            projectStartDate={projectStartDate}
            visible={showSeoTraffic}
            onToggle={() => setShowSeoTraffic((v: boolean) => !v)}
            lines={[
              { key: "clicks", label: "Klick", color: "#10b981" },
              { key: "impressions", label: "Exponeringar", color: "#f59e0b" },
            ]}
          />
        </div>

        {/* Nästa steg */}
        <div className="mt-8">
          <NextSteps input={nextStepsInput} />
        </div>

        {/* Aktiva agenter */}
        <div className="mt-8">
          <AgentChips runs={runs} />
        </div>

        {/* Senaste utfall */}
        {user && (
          <div className="mt-8">
            <RecentOutcomes tenantId={user.id} />
          </div>
        )}

        {/* Activity feed + Quick links */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {user && <ActivityFeed userId={user.id} />}
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-slate-900">Snabblänkar</h3>
            <div className="space-y-2">
              {[
                { href: "/c/content", icon: PenTool, color: "text-purple-600", label: "Skapa content" },
                { href: "/c/content/calendar", icon: CalendarIcon, color: "text-indigo-600", label: "Se publiceringskalender" },
                { href: "/c/tech", icon: Code2, color: "text-slate-700", label: "Tekniska åtgärder" },
                { href: "/c/analysis", icon: Sparkles, color: "text-blue-600", label: "Se er synlighet" },
                { href: "/c/settings", icon: Bot, color: "text-slate-600", label: "Öppna inställningar" },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                  <link.icon className={`h-4 w-4 ${link.color}`} />
                  <div className="flex-1 text-sm font-medium text-slate-700">{link.label}</div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </div>
            {stepCount > 0 && (
              <p className="mt-4 text-xs text-slate-400">
                {stepCount} {stepCount === 1 ? "rekommenderat steg" : "rekommenderade steg"} ovan.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

interface TrafficGraphLine {
  key: string;
  label: string;
  color: string;
}

function TrafficGraph({
  title,
  subtitle,
  data,
  projectStartDate,
  visible,
  onToggle,
  lines,
}: {
  title: string;
  subtitle: string;
  data?: { date: string; clicks: number; impressions: number }[];
  projectStartDate: string | null;
  visible: boolean;
  onToggle: () => void;
  lines: TrafficGraphLine[];
}) {
  const hasData = data && data.length > 0;

  const fmtDate = (v: unknown): string => {
    const d = new Date(String(v ?? ""));
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          <div className="text-left">
            <div className="font-semibold text-slate-900 text-sm">{title}</div>
            <div className="text-xs text-slate-500">{subtitle}</div>
          </div>
        </div>
        {visible ? (
          <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {visible && (
        <div className="px-6 pb-6">
          {hasData ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickFormatter={fmtDate}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={40} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                    labelFormatter={fmtDate}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  />
                  {lines.map((l) => (
                    <Line
                      key={l.key}
                      type="monotone"
                      dataKey={l.key}
                      name={l.label}
                      stroke={l.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                  {projectStartDate && (
                    <ReferenceLine
                      x={projectStartDate}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: "Start",
                        position: "insideTopRight",
                        fontSize: 11,
                        fill: "#f59e0b",
                        fontWeight: 600,
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <TrendingUp className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Ingen data ännu.</p>
              <p className="text-xs text-slate-300 mt-1">
                Data syns här när agenter har samlat in mätvärden.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
