"use client";

import { Fragment, useState, useEffect } from "react";
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle,
  Play, RefreshCw, Minus, Eye, X, Download, Trash2,
  ChevronDown, ChevronUp, Plus,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import CustomerNav from "@/components/CustomerNav";
import KeywordGeoRecommendations from "@/components/KeywordGeoRecommendations";
import AIReadabilityCard from "@/components/analysis/AIReadabilityCard";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { usePeriod } from "@/lib/hooks/usePeriod";
import { samaHeaders } from "@/lib/api";
import { useActiveRuns } from "@/lib/hooks/useActiveRuns";
import PeriodSelector from "@/components/dashboard/PeriodSelector";
import { exportCsv } from "@/lib/csv";
import { useLanguage } from "@/lib/hooks/useLanguage";
import {
  MAX_GEO_QUERIES,
  GEO_QUERIES_STALE_DAYS,
} from "@/lib/integrations/store-constants";

interface Summary {
  mention_rate: number;
  avg_rank: number | null;
  total_checks: number;
  open_gaps: number;
  top_competitors: { name: string; count: number }[];
  trend: "up" | "down" | "flat";
  last_check_at: string | null;
  engine_stats: Record<string, { total: number; mentioned: number; rate: number }>;
  history?: { date: string; mention_rate: number }[];
}

interface LockStatus {
  locked: boolean;
  last_completed_at: string | null;
  next_available_at: string | null;
  lock_days: number;
  geo_queries_updated_at: string | null;
}

function formatCountdown(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "snart";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 60 * 24) / 60);
  const mins = totalMin - days * 60 * 24 - hours * 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${mins} m`;
  return `${mins} m`;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

interface AICheck {
  id: string;
  prompt: string;
  category: string;
  ai_engine: string;
  mentioned: boolean;
  rank: number | null;
  competitors_mentioned: string[];
  ai_response_excerpt?: string | null;
  full_response?: string | null;
  checked_at: string;
}

function trendIcon(trend?: string) {
  return trend === "up" ? <TrendingUp className="h-4 w-4 text-emerald-500" /> :
    trend === "down" ? <TrendingDown className="h-4 w-4 text-red-500" /> :
    <Minus className="h-4 w-4 text-zinc-400" />;
}

export default function CustomerGeoPage() {
  const { user, loading: userLoading } = useUser();
  const { tenantClient, effectiveTenantId } = useSite();
  const { t } = useLanguage();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [checks, setChecks] = useState<AICheck[]>([]);
  const [trackedQueries, setTrackedQueries] = useState<string[]>([]);
  const [queriesUpdatedAt, setQueriesUpdatedAt] = useState<string | null>(null);
  const [removingQuery, setRemovingQuery] = useState<string | null>(null);
  const [newQueryInput, setNewQueryInput] = useState("");
  const [addingQuery, setAddingQuery] = useState(false);
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  // Re-render once a minute so the countdown ticks down without a refetch.
  const [, setNowTick] = useState(0);
  const { period, setPeriod, days } = usePeriod();
  const { runs, triggerRun } = useActiveRuns();

  const activeGeoRun = runs.find(
    (r) => r.agent === "ai_visibility" && (r.status === "running" || r.status === "pending"),
  );
  const lastCompletedGeoRunId = runs
    .filter((r) => r.agent === "ai_visibility" && r.status === "completed")
    .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))[0]?.id;

  // Reset cached data when the active site changes so we don't show
  // another site's mentions/checks while the new fetch is in flight.
  useEffect(() => {
    setSummary(null);
    setChecks([]);
    setTrackedQueries([]);
    setQueriesUpdatedAt(null);
    setLockStatus(null);
  }, [effectiveTenantId]);

  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (user && effectiveTenantId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, days, effectiveTenantId]);

  useEffect(() => {
    if (!lastCompletedGeoRunId) return;
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCompletedGeoRunId]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const loadData = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setError("");
    const client = tenantClient;
    try {
      const [summaryData, checksData, trackedRes, lockRes] = await Promise.all([
        client.get(`/api/ai-visibility/summary?days=${days}`).catch(() => null),
        client.get(`/api/ai-visibility/checks?limit=50&days=${days}`).catch(() => []),
        fetch("/api/recommendations/list", { headers: samaHeaders() })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        client.get(`/api/ai-visibility/lock-status`).catch(() => null),
      ]);
      if (summaryData) setSummary(summaryData);
      if (Array.isArray(checksData)) setChecks(checksData);
      else if (checksData?.checks) setChecks(checksData.checks);
      setTrackedQueries(Array.isArray(trackedRes?.geo_queries) ? trackedRes.geo_queries : []);
      // Prefer the dashboard-side timestamp (it's authoritative for the
      // current user's edits) but fall back to the backend mirror when
      // /list didn't include it (older clients) so the banner still works.
      setQueriesUpdatedAt(
        typeof trackedRes?.geo_queries_updated_at === "string"
          ? trackedRes.geo_queries_updated_at
          : (lockRes?.geo_queries_updated_at ?? null),
      );
      setLockStatus(lockRes ?? null);
    } catch (err: any) {
      console.error("Failed to load GEO data:", err);
      setError(`Could not load data: ${err?.message || err}`);
    }
    if (!silent) setLoading(false);
  };

  const addTrackedQuery = async () => {
    const query = newQueryInput.trim();
    if (!query) return;
    if (trackedQueries.length >= MAX_GEO_QUERIES) {
      setError(`Tracking cap reached — remove a query to add a new one (max ${MAX_GEO_QUERIES}).`);
      return;
    }
    setAddingQuery(true);
    setError("");
    try {
      const res = await fetch("/api/recommendations/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...samaHeaders() },
        body: JSON.stringify({ geo_queries: [query] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Add failed");
      setTrackedQueries(Array.isArray(data?.geo_queries) ? data.geo_queries : trackedQueries);
      setNewQueryInput("");
      if (data?.geo_added === 0 && data?.geo_skipped_full > 0) {
        setError(`Tracking cap reached — only ${MAX_GEO_QUERIES} queries can be tracked at a time.`);
      }
    } catch (err: any) {
      console.error("Failed to add tracked query:", err);
      setError(`Could not add query: ${err?.message || err}`);
    }
    setAddingQuery(false);
  };

  const removeTrackedQuery = async (query: string) => {
    setRemovingQuery(query);
    try {
      const res = await fetch("/api/recommendations/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...samaHeaders() },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTrackedQueries(Array.isArray(data?.geo_queries) ? data.geo_queries : []);
    } catch (err: any) {
      console.error("Failed to remove tracked query:", err);
      setError(`Could not remove query: ${err?.message || err}`);
    }
    setRemovingQuery(null);
  };

  const handleExportCsv = () => {
    if (checks.length === 0) return;
    exportCsv(
      `geo-checks-${new Date().toISOString().slice(0, 10)}.csv`,
      checks,
      [
        { header: "Query", accessor: (c) => c.prompt },
        { header: "Category", accessor: (c) => c.category || "" },
        { header: "Engine", accessor: (c) => c.ai_engine },
        { header: "Mentioned", accessor: (c) => (c.mentioned ? "yes" : "no") },
        { header: "Rank", accessor: (c) => c.rank ?? "" },
        { header: "Competitors", accessor: (c) => (c.competitors_mentioned || []).join("; ") },
        { header: "Checked At", accessor: (c) => c.checked_at },
      ]
    );
  };

  const runCheck = async () => {
    if (!user) return;
    setError("");
    if (trackedQueries.length === 0) {
      setError(
        "Lägg till minst en bevakad fråga nedan innan du kör en kontroll — annars finns det inget att mäta.",
      );
      return;
    }
    if (lockStatus?.locked) {
      // Defensive: button should already be hidden when locked, but the
      // backend will refuse anyway and we don't want a confusing spinner.
      return;
    }
    const result = await triggerRun("ai_visibility", "/api/ai-visibility/check");
    // Refresh lock status so the countdown takes over once the run starts.
    if (result) {
      try {
        const lockRes = await tenantClient.get(`/api/ai-visibility/lock-status`);
        if (lockRes) setLockStatus(lockRes);
      } catch {
        // non-critical
      }
    }
  };

  const running = !!activeGeoRun;
  const nextAvailableDate =
    lockStatus?.next_available_at ? new Date(lockStatus.next_available_at) : null;
  const isLocked =
    !!lockStatus?.locked && !!nextAvailableDate && nextAvailableDate.getTime() > Date.now();
  const queriesStaleDays = daysSince(queriesUpdatedAt);
  const queriesAreStale =
    trackedQueries.length > 0 &&
    (queriesStaleDays === null || queriesStaleDays >= GEO_QUERIES_STALE_DAYS);

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
        </div>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Eye className="h-7 w-7 text-slate-400" />
              {t.geo.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{t.geo.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelector value={period} onChange={setPeriod} />
            <button
              onClick={handleExportCsv}
              disabled={checks.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {t.geo.export}
            </button>
            {isLocked && nextAvailableDate && !running ? (
              <div
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                title={`Senaste kontroll: ${
                  lockStatus?.last_completed_at
                    ? new Date(lockStatus.last_completed_at).toLocaleString("sv-SE")
                    : "—"
                }. Kör automatiskt enligt veckoschema.`}
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Nästa kontroll om{" "}
                  <span className="font-semibold text-slate-800">
                    {formatCountdown(nextAvailableDate)}
                  </span>
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={runCheck}
                disabled={running}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? t.geo.running : t.geo.runCheck}
              </button>
            )}
          </div>
        </div>

        {queriesAreStale && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Granska dina bevakade frågor</p>
              <p className="mt-0.5 text-amber-800">
                {queriesStaleDays === null
                  ? "Du har inte uppdaterat din bevakningslista än — kontrollera att frågorna fortfarande är relevanta."
                  : `Det var ${queriesStaleDays} dagar sedan du senast uppdaterade dina bevakade frågor. Granska gärna listan nedan så att veckokontrollen mäter det du faktiskt bryr dig om.`}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError("")} className="ml-auto text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {activeGeoRun && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
            {t.geo.runningBanner}
          </div>
        )}

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">{t.geo.cardMentionRate}</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {(summary.mention_rate * 100).toFixed(0)}%
                </span>
                {trendIcon(summary.trend)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">{t.geo.cardAvgPosition}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.avg_rank ? `#${summary.avg_rank.toFixed(1)}` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">{t.geo.cardChecks}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {(summary.total_checks ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">{t.geo.cardOpenGaps}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary.open_gaps ?? 0}</p>
            </div>
          </div>
        )}

        {/* Engine breakdown */}
        {summary?.engine_stats && Object.keys(summary.engine_stats).length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">{t.geo.perService}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(summary.engine_stats).map(([engine, stats]) => (
                <div key={engine} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-700 capitalize">{engine}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {(stats.rate * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-slate-500">
                    {stats.mentioned}/{stats.total} {t.geo.mentions}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top competitors */}
        {summary?.top_competitors && summary.top_competitors.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">{t.geo.topCompetitors}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {summary.top_competitors.map((c) => (
                <div key={c.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-700">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.count} {t.geo.mentions}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Recommendations */}
        <div className="mb-8">
          <KeywordGeoRecommendations
            sections={["geo_queries", "long_tail_phrases"]}
            gapSummary={
              summary
                ? `Mention rate ${(summary.mention_rate * 100).toFixed(0)}%, ${summary.open_gaps} open gaps. Top competitors mentioned: ${summary.top_competitors.slice(0, 5).map((c) => c.name).join(", ") || "none yet"}.`
                : undefined
            }
            title={t.geo.recommendTitle}
            description={`AI suggests new natural-language queries to monitor in ChatGPT, Claude, Perplexity and Gemini. Pick which to add (max ${MAX_GEO_QUERIES} at a time).`}
            geoTrackedCount={trackedQueries.length}
            geoMax={MAX_GEO_QUERIES}
            onAdded={() => loadData()}
          />
        </div>

        {/* AI-readability scorecard. Hides itself when no site review has
            scored the site yet, so this section is invisible for new
            tenants until their first /c/analysis run completes. */}
        <AIReadabilityCard />

        {/* Tracked GEO Queries */}
        <div className="mb-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t.geo.trackedTitle}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.geo.trackedDesc} {MAX_GEO_QUERIES} {t.geo.trackedDescSuffix}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  trackedQueries.length >= MAX_GEO_QUERIES
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {trackedQueries.length} / {MAX_GEO_QUERIES}
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addTrackedQuery();
              }}
              className="mb-4 flex flex-wrap items-center gap-2"
            >
              <input
                type="text"
                value={newQueryInput}
                onChange={(e) => setNewQueryInput(e.target.value)}
                placeholder="Add your own query, e.g. 'best customer success platform for SaaS'"
                maxLength={200}
                disabled={addingQuery || trackedQueries.length >= MAX_GEO_QUERIES}
                className="flex-1 min-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <button
                type="submit"
                disabled={
                  addingQuery ||
                  !newQueryInput.trim() ||
                  trackedQueries.length >= MAX_GEO_QUERIES
                }
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {addingQuery ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add
              </button>
            </form>

            {trackedQueries.length === 0 ? (
              <p className="text-sm text-slate-500">{t.geo.noTracked}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {trackedQueries.map((q) => (
                  <li key={q} className="flex items-start gap-3 py-2.5">
                    <span className="flex-1 text-sm text-slate-700">{q}</span>
                    <button
                      onClick={() => removeTrackedQuery(q)}
                      disabled={removingQuery === q}
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-colors"
                      aria-label={`Remove \"${q}\"`}
                    >
                      {removingQuery === q ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent checks */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">{t.geo.recentChecks}</h2>
          {checks.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full bg-violet-100 p-4 mb-4">
                  <Eye className="h-8 w-8 text-violet-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{t.geo.noDataTitle}</h3>
                <p className="text-sm text-slate-500 max-w-md mb-6">{t.geo.noDataHint}</p>
                {isLocked && nextAvailableDate && !running ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                    <RefreshCw className="h-4 w-4 text-slate-400" />
                    <span>
                      Nästa kontroll om{" "}
                      <span className="font-semibold text-slate-800">
                        {formatCountdown(nextAvailableDate)}
                      </span>
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={runCheck}
                    disabled={running}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm"
                  >
                    {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {running ? t.geo.running : t.geo.runCheck}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">{t.geo.tableQuery}</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">{t.geo.tableAI}</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">{t.geo.tableMentioned}</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">{t.geo.tablePosition}</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">{t.geo.tableCompetitors}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checks.map((c) => {
                    const expanded = expandedCheckId === c.id;
                    const responseText = c.full_response || c.ai_response_excerpt || "";
                    return (
                      <Fragment key={c.id}>
                        <tr
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => setExpandedCheckId(expanded ? null : c.id)}
                        >
                          <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{c.prompt}</td>
                          <td className="px-4 py-3 text-slate-600 capitalize">{c.ai_engine}</td>
                          <td className="px-4 py-3">
                            {c.mentioned ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-400" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{c.rank ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {c.competitors_mentioned?.join(", ") || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={6} className="px-4 py-4">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {t.geo.expandedResponse} {c.ai_engine}
                              </p>
                              <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700 max-h-96 overflow-y-auto">
                                {responseText || t.geo.noResponse}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mention Rate History */}
        {summary?.history && summary.history.length > 1 && (
          <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">{t.geo.mentionHistory}</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart
                  data={summary.history}
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [`${Math.round(Number(value ?? 0) * 100)}%`, t.geo.cardMentionRate]}
                  />
                  <Line
                    type="monotone"
                    dataKey="mention_rate"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#8b5cf6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
