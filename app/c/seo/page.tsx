"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, TrendingUp, ArrowUp, ArrowDown, RefreshCw,
  Loader2, BarChart2, Target, AlertCircle, X, Plus, Sparkles,
  Download, ArrowUpDown,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import CustomerNav from "@/components/CustomerNav";
import CustomerPageShellSkeleton from "@/components/CustomerPageShellSkeleton";
import GoogleDataDiagnostics from "@/components/GoogleDataDiagnostics";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { api, samaHeaders, tenantApi } from "@/lib/api";
import { IS_DEMO, demoSeoKeywords } from "@/lib/demo-data";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { exportCsv } from "@/lib/csv";
import { useLanguage } from "@/lib/hooks/useLanguage";
import Link from "next/link";

type SortKey = "keyword" | "position" | "clicks" | "impressions" | "ctr";
type SortDirection = "asc" | "desc";
type PositionFilter = "all" | "top3" | "top10" | "top30" | "outside";

interface Keyword {
  keyword: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
  position_history?: { date: string; position: number }[];
}

interface BrandContext {
  brand_name?: string;
  domain?: string;
  brand_description?: string;
  target_audience?: string;
  competitors?: string[];
}

export default function CustomerSeoPage() {
  const { user, loading: userLoading } = useUser();
  const { tenantClient, effectiveTenantId, activeAccountId } = useSite();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const baseEnabled = !!user && !!effectiveTenantId;

  const [checking, setChecking] = useState(false);
  // Errors from user actions (add keyword, run check, suggest). Load failures
  // are derived from the query below. Auto-cleared after 8s by the effect.
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [searchFilter, setSearchFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("all");

  // The keyword list is the page's primary data — cached by React Query keyed
  // on the active tenant, so leaving the page and returning paints instantly
  // from cache (with a background refetch when stale) instead of refetching
  // from an empty table. That keying also replaces the old "reset state on
  // tenant change" effect: a different tenant is simply a different cache key.
  const keywordsKey = useMemo(
    () => ["seo", "keywords", effectiveTenantId] as const,
    [effectiveTenantId],
  );
  const keywordsQuery = useQuery({
    queryKey: keywordsKey,
    queryFn: async () => {
      try {
        const res = await fetch("/api/seo/keywords", {
          method: "GET",
          headers: samaHeaders(),
        });
        if (!res.ok) throw new Error(`GET /api/seo/keywords: ${res.status}`);
        const data = (await res.json()) as { keywords?: Keyword[] };
        const kws = data.keywords || [];
        return kws.length > 0 ? kws : IS_DEMO ? demoSeoKeywords : [];
      } catch (err) {
        if (IS_DEMO) return demoSeoKeywords;
        throw err;
      }
    },
    enabled: baseEnabled,
  });
  const keywords = useMemo(() => keywordsQuery.data ?? [], [keywordsQuery.data]);

  const brandQuery = useQuery({
    queryKey: ["seo", "brand-context", user?.id],
    queryFn: async (): Promise<BrandContext> => {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase
          .from("user_settings")
          .select("settings")
          .eq("user_id", user!.id)
          .maybeSingle();
        return (data?.settings as BrandContext) ?? {};
      } catch {
        return {};
      }
    },
    enabled: !!user,
  });
  const brandContext = brandQuery.data ?? {};

  const gscQuery = useQuery({
    queryKey: ["seo", "gsc-status", effectiveTenantId],
    queryFn: async () => {
      try {
        const status = await api.get<Record<string, { connected?: boolean }>>(
          `/api/auth/google/status?tenant_id=${effectiveTenantId}`,
        );
        return !!status?.search_console?.connected;
      } catch {
        return false;
      }
    },
    enabled: baseEnabled,
  });
  const gscConnected = gscQuery.data ?? null;

  // Inline table spinner follows live fetches; the full-page skeleton only
  // shows on the very first load (or while the tenant resolves).
  const loading = keywordsQuery.isFetching;
  const error =
    actionError ??
    (keywordsQuery.isError && !IS_DEMO
      ? "Could not load keywords. The SEO agent may not have run yet."
      : null);

  const refetchKeywords = () => keywordsQuery.refetch();

  useEffect(() => {
    if (actionError) {
      const timer = setTimeout(() => setActionError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [actionError]);

  const triggerCheck = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const client = tenantClient;
      await client.post("/api/seo/keywords/track");
      setTimeout(() => refetchKeywords(), 2000);
    } catch (err: any) {
      console.error("Failed to trigger SEO check:", err);
      if (String(err?.message || err).includes("404")) {
        setActionError("SEO check could not run. Verify that Google Search Console is connected in Settings.");
      } else {
        setActionError(`Could not run SEO check: ${err?.message || err}`);
      }
    }
    setChecking(false);
  };

  const addKeyword = async () => {
    if (!user || !newKeyword.trim()) return;
    setAddingKeyword(true);
    const trimmed = newKeyword.trim();
    try {
      const res = await fetch("/api/seo/keywords/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...samaHeaders() },
        body: JSON.stringify({ keyword: trimmed }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`${res.status} ${detail.slice(0, 200)}`);
      }
      queryClient.setQueryData<Keyword[]>(keywordsKey, (prev = []) =>
        prev.some(k => k.keyword.toLowerCase() === trimmed.toLowerCase())
          ? prev
          : [...prev, { keyword: trimmed, position: 0, clicks: 0, impressions: 0, ctr: 0 }],
      );
      setNewKeyword("");
      await refetchKeywords();
    } catch (err: any) {
      setActionError(`Could not add keyword: ${err?.message || err}`);
    }
    setAddingKeyword(false);
  };

  const addSuggestion = async (keyword: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/seo/keywords/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...samaHeaders() },
        body: JSON.stringify({ keyword }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`${res.status} ${detail.slice(0, 200)}`);
      }
      setSuggestions((prev) => prev.filter((s) => s !== keyword));
      await refetchKeywords();
    } catch (err: any) {
      setActionError(`Could not add keyword: ${err?.message || err}`);
    }
  };

  const suggestKeywords = async () => {
    if (!user) return;
    setSuggestingKeywords(true);
    try {
      const client = tenantClient;
      const result = await client.post<{ keywords?: string[] }>("/api/seo/suggest-keywords", {
        brand_name: brandContext.brand_name || "",
        domain: brandContext.domain || "",
        target_audience: brandContext.target_audience || "",
        competitors: brandContext.competitors || [],
      });
      const newSuggestions = result.keywords || [];
      if (newSuggestions.length > 0) {
        setSuggestions(newSuggestions);
      } else {
        setActionError("No new keyword suggestions found. Try updating your brand description in Settings.");
      }
    } catch (err: any) {
      setActionError(`Could not generate keyword suggestions: ${err?.message || err}`);
    }
    setSuggestingKeywords(false);
  };

  const topKeywords = [...keywords]
    .filter((k) => k.position > 0)
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  const avgPosition =
    keywords.length > 0
      ? keywords.reduce((sum, k) => sum + (k.position || 0), 0) / keywords.length
      : 0;

  const totalClicks = keywords.reduce((sum, k) => sum + (k.clicks || 0), 0);
  const totalImpressions = keywords.reduce((sum, k) => sum + (k.impressions || 0), 0);

  const filteredKeywords = useMemo(() => {
    let result = keywords;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter((k) => k.keyword.toLowerCase().includes(q));
    }
    if (positionFilter !== "all") {
      result = result.filter((k) => {
        if (k.position <= 0) return positionFilter === "outside";
        if (positionFilter === "top3") return k.position <= 3;
        if (positionFilter === "top10") return k.position <= 10;
        if (positionFilter === "top30") return k.position <= 30;
        if (positionFilter === "outside") return k.position > 30;
        return true;
      });
    }
    return result;
  }, [keywords, searchFilter, positionFilter]);

  const sortedKeywords = useMemo(() => {
    const result = [...filteredKeywords];
    result.sort((a, b) => {
      const getValue = (k: Keyword) => {
        if (sortKey === "keyword") return k.keyword;
        if (sortKey === "position" && k.position <= 0) return Number.MAX_SAFE_INTEGER;
        return (k as any)[sortKey] ?? 0;
      };
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return result;
  }, [filteredKeywords, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "keyword" ? "asc" : key === "position" ? "asc" : "desc");
    }
  };

  const handleExportCsv = () => {
    exportCsv(
      `seo-keywords-${new Date().toISOString().slice(0, 10)}.csv`,
      sortedKeywords,
      [
        { header: "Keyword", accessor: (k) => k.keyword },
        { header: "Position", accessor: (k) => (k.position > 0 ? k.position : "") },
        { header: "Clicks", accessor: (k) => k.clicks ?? 0 },
        { header: "Impressions", accessor: (k) => k.impressions ?? 0 },
        { header: "CTR", accessor: (k) => ((k.ctr ?? 0) * 100).toFixed(2) + "%" },
      ]
    );
  };

  if (userLoading || keywordsQuery.isPending) {
    return <CustomerPageShellSkeleton maxWidth="max-w-5xl" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Search className="h-7 w-7 text-blue-500" />
              {t.seo.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{t.seo.subtitle}</p>
          </div>
          <div className="relative group">
            <button
              onClick={triggerCheck}
              disabled={checking || keywords.length === 0}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm transition-colors"
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {checking ? t.seo.running : t.seo.runCheck}
            </button>
            {keywords.length === 0 && (
              <span className="absolute right-0 top-full mt-1 hidden group-hover:block whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white shadow-lg z-10">
                Add a keyword first to run a check
              </span>
            )}
          </div>
        </div>

        {/* GSC Connection Banner */}
        {gscConnected === false && keywords.length === 0 && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">{t.seo.gscNotConnected}</p>
                <p className="text-sm text-blue-700 mt-1">{t.seo.gscNotConnectedHint}</p>
                <Link
                  href="/c/settings/integrations"
                  className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  {t.seo.gscGoToIntegrations}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <StatCard label={t.seo.statKeywords} value={keywords.length} icon={<Target className="h-5 w-5 text-blue-500" />} />
          <StatCard label={t.seo.statAvgPosition} value={avgPosition > 0 ? avgPosition.toFixed(1) : "--"} icon={<BarChart2 className="h-5 w-5 text-violet-500" />} />
          <StatCard label={t.seo.statClicks} value={(totalClicks ?? 0).toLocaleString()} icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} />
          <StatCard label={t.seo.statImpressions} value={(totalImpressions ?? 0).toLocaleString()} icon={<Search className="h-5 w-5 text-amber-500" />} />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
            <button onClick={() => setActionError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Add Keyword + Top Performing Keywords side by side */}
        <div className="mb-8 grid gap-4 lg:grid-cols-2 items-start">
          {/* Add Keyword + AI Suggestions */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">{t.seo.addKeyword}</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                placeholder={t.seo.keywordPlaceholder}
                className="flex-1 min-w-[12rem] rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={addKeyword}
                disabled={addingKeyword || !newKeyword.trim()}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors"
              >
                {addingKeyword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t.seo.addKeyword}
              </button>
              <button
                onClick={suggestKeywords}
                disabled={suggestingKeywords}
                className="flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
              >
                {suggestingKeywords ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                AI Suggestions
              </button>
            </div>

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">{t.seo.suggestedKeywords}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => addSuggestion(s)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top Performing Keywords */}
          {topKeywords.length > 0 && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-4">{t.seo.topPerforming}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {topKeywords.slice(0, 6).map((kw) => (
                  <div
                    key={kw.keyword}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-700 truncate mr-3">{kw.keyword}</span>
                    <span
                      className={`text-sm font-bold ${
                        kw.position <= 3 ? "text-emerald-600" : kw.position <= 10 ? "text-blue-600" : "text-slate-500"
                      }`}
                    >
                      #{kw.position}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Position History Chart */}
        {selectedKeyword?.position_history && selectedKeyword.position_history.length > 0 && (
          <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">
                Position History: <span className="text-blue-600">{selectedKeyword.keyword}</span>
              </h2>
              <button
                onClick={() => setSelectedKeyword(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                <LineChart
                  data={selectedKeyword.position_history}
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
                    reversed
                    domain={[1, "auto"]}
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                    formatter={(value: number | undefined) => [`Position ${value ?? 0}`, ""]}
                  />
                  <Line
                    type="monotone"
                    dataKey="position"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#3b82f6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Keywords Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-900 mr-auto">
              All Keywords{" "}
              <span className="ml-1 text-xs font-normal text-slate-400">
                ({sortedKeywords.length} of {keywords.length})
              </span>
            </h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder={t.seo.filterSearch}
                className="rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              />
            </div>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value as PositionFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">{t.seo.filterAll}</option>
              <option value="top3">{t.seo.filterTop3}</option>
              <option value="top10">{t.seo.filterTop10}</option>
              <option value="top30">{t.seo.filterTop30}</option>
              <option value="outside">{t.seo.filterOutside}</option>
            </select>
            <button
              onClick={handleExportCsv}
              disabled={sortedKeywords.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {t.seo.export}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : keywords.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Search className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">{t.seo.emptyNoKeywords}</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{t.seo.emptyNoKeywordsHint}</p>
            </div>
          ) : sortedKeywords.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Search className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">{t.seo.emptyNoMatch}</p>
              <p className="text-xs text-slate-400 mt-1">{t.seo.emptyNoMatchHint}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <SortHeader label={t.seo.colKeyword} sortKey="keyword" currentKey={sortKey} direction={sortDir} onClick={toggleSort} align="left" />
                    <SortHeader label={t.seo.colPosition} sortKey="position" currentKey={sortKey} direction={sortDir} onClick={toggleSort} align="right" />
                    <SortHeader label={t.seo.colClicks} sortKey="clicks" currentKey={sortKey} direction={sortDir} onClick={toggleSort} align="right" />
                    <SortHeader label={t.seo.colImpressions} sortKey="impressions" currentKey={sortKey} direction={sortDir} onClick={toggleSort} align="right" />
                    <SortHeader label={t.seo.colCtr} sortKey="ctr" currentKey={sortKey} direction={sortDir} onClick={toggleSort} align="right" />
                    <th className="px-4 py-3 font-medium text-slate-500 text-center">{t.seo.colHistory}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedKeywords.map((kw) => (
                    <tr key={kw.keyword} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-700">{kw.keyword}</td>
                      <td className="px-4 py-3 text-right"><PositionBadge position={kw.position} /></td>
                      <td className="px-4 py-3 text-right text-slate-600">{(kw.clicks ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{(kw.impressions ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{((kw.ctr ?? 0) * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-center">
                        {kw.position_history && kw.position_history.length > 0 ? (
                          <button onClick={() => setSelectedKeyword(kw)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">
                            {t.seo.showHistory}
                          </button>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Google data diagnostics */}
        {user && (
          <div className="mt-8">
            <GoogleDataDiagnostics
              service="search_console"
              tenantId={effectiveTenantId}
              accountId={activeAccountId}
              agentName="seo"
              trackedCount={keywords.length}
              onSynced={refetchKeywords}
              showImportFromGsc
            />
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label, value, icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <span className="text-2xl font-bold text-slate-900">{value}</span>
    </div>
  );
}

function SortHeader({
  label, sortKey, currentKey, direction, onClick, align = "left",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDirection;
  onClick: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = currentKey === sortKey;
  return (
    <th className={`${align === "right" ? "text-right" : "text-left"} ${sortKey === "keyword" ? "px-6" : "px-4"} py-3 font-medium text-slate-500`}>
      <button
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-900 transition-colors ${active ? "text-slate-900" : ""}`}
      >
        {label}
        {active ? (
          direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function PositionBadge({ position }: { position: number }) {
  if (position <= 0) return <span className="text-slate-400">--</span>;
  const color =
    position <= 3 ? "text-emerald-600 bg-emerald-50" :
    position <= 10 ? "text-blue-600 bg-blue-50" :
    position <= 30 ? "text-amber-600 bg-amber-50" :
    "text-slate-600 bg-slate-50";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      #{position}
    </span>
  );
}
