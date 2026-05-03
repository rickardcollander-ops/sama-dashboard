"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle,
  Play, RefreshCw, Minus, Eye, X, Download,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import CustomerNav from "@/components/CustomerNav";
import KeywordGeoRecommendations from "@/components/KeywordGeoRecommendations";
import { useUser } from "@/lib/hooks/useUser";
import { usePeriod } from "@/lib/hooks/usePeriod";
import { tenantApi } from "@/lib/api";
import PeriodSelector from "@/components/dashboard/PeriodSelector";
import { exportCsv } from "@/lib/csv";

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

interface AICheck {
  id: string;
  prompt: string;
  category: string;
  ai_engine: string;
  mentioned: boolean;
  rank: number | null;
  competitors_mentioned: string[];
  checked_at: string;
}

export default function CustomerGeoPage() {
  const { user, loading: userLoading } = useUser();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [checks, setChecks] = useState<AICheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const { period, setPeriod, days } = usePeriod();

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, days]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    const client = tenantApi(user.id);
    try {
      const [summaryData, checksData] = await Promise.all([
        client.get(`/api/ai-visibility/summary?days=${days}`).catch(() => null),
        client.get(`/api/ai-visibility/checks?limit=50&days=${days}`).catch(() => []),
      ]);
      if (summaryData) setSummary(summaryData);
      if (Array.isArray(checksData)) setChecks(checksData);
      else if (checksData?.checks) setChecks(checksData.checks);
    } catch (err: any) {
      console.error("Failed to load GEO data:", err);
      setError(`Could not load data: ${err?.message || err}`);
    }
    setLoading(false);
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
    setRunning(true);
    try {
      const client = tenantApi(user.id);
      await client.post("/api/ai-visibility/check");
      await loadData();
    } catch (err: any) {
      console.error("Failed to run check:", err);
      setError(`Could not run check: ${err?.message || err}`);
    }
    setRunning(false);
  };

  const trendIcon = (t?: string) =>
    t === "up" ? <TrendingUp className="h-4 w-4 text-emerald-500" /> :
    t === "down" ? <TrendingDown className="h-4 w-4 text-red-500" /> :
    <Minus className="h-4 w-4 text-zinc-400" />;

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
              AI Visibility / GEO
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              How visible is your brand in AI assistants?
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelector value={period} onChange={setPeriod} />
            <button
              onClick={handleExportCsv}
              disabled={checks.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              onClick={runCheck}
              disabled={running}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Running..." : "Run Check"}
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

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">Mention Rate</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {(summary.mention_rate * 100).toFixed(0)}%
                </span>
                {trendIcon(summary.trend)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">Avg Rank</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.avg_rank ? `#${summary.avg_rank.toFixed(1)}` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">Total Checks</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {(summary.total_checks ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">Open Gaps</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary.open_gaps ?? 0}</p>
            </div>
          </div>
        )}

        {/* Mention Rate History */}
        {summary?.history && summary.history.length > 1 && (
          <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Mention Rate Over Time</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
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
                    formatter={(value) => [`${Math.round(Number(value ?? 0) * 100)}%`, "Mention Rate"]}
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

        {/* Engine breakdown */}
        {summary?.engine_stats && Object.keys(summary.engine_stats).length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Per AI Engine</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(summary.engine_stats).map(([engine, stats]) => (
                <div key={engine} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-700 capitalize">{engine}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {(stats.rate * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-slate-500">
                    {stats.mentioned}/{stats.total} mentions
                  </p>
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
            title="Find new GEO queries to track"
            description="AI suggests new natural-language prompts to monitor across ChatGPT, Claude, Perplexity and Gemini. Pick the ones to add."
            onAdded={() => loadData()}
          />
        </div>

        {/* Recent checks */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Checks</h2>
          {checks.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full bg-violet-100 p-4 mb-4">
                  <Eye className="h-8 w-8 text-violet-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No AI visibility data yet</h3>
                <p className="text-sm text-slate-500 max-w-md mb-6">
                  Run your first check to see how visible your brand is in AI assistants like ChatGPT, Claude, and Perplexity.
                </p>
                <button
                  onClick={runCheck}
                  disabled={running}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm"
                >
                  {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {running ? "Running..." : "Run Check"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Query</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Engine</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Mentioned</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Rank</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Competitors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checks.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top competitors */}
        {summary?.top_competitors && summary.top_competitors.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Most Common Competitors in AI Responses</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {summary.top_competitors.map((c) => (
                <div key={c.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-700">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.count} mentions</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
