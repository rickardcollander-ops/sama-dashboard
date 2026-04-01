"use client";

import { useState, useEffect } from "react";
import {
  Search, TrendingUp, ArrowUp, ArrowDown, Minus, RefreshCw,
  Loader2, BarChart2, Target,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { tenantApi } from "@/lib/api";

interface Keyword {
  keyword: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
  position_history?: { date: string; position: number }[];
}

export default function CustomerSeoPage() {
  const { user, loading: userLoading } = useUser();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);

  useEffect(() => {
    if (user) fetchKeywords();
  }, [user]);

  const fetchKeywords = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const client = tenantApi(user.id);
      const data = await client.get<{ keywords?: Keyword[] }>("/api/seo/keywords");
      setKeywords(data.keywords || []);
    } catch (err) {
      console.error("Failed to fetch keywords:", err);
      setError("Could not load keyword data. The SEO agent may not have run yet.");
    }
    setLoading(false);
  };

  const triggerCheck = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const client = tenantApi(user.id);
      await client.post("/api/seo/check");
      // Refresh after a short delay to let the check start
      setTimeout(() => fetchKeywords(), 2000);
    } catch (err) {
      console.error("Failed to trigger SEO check:", err);
    }
    setChecking(false);
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

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Search className="h-7 w-7 text-blue-500" />
              SEO Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track your keyword rankings and search performance
            </p>
          </div>
          <button
            onClick={triggerCheck}
            disabled={checking}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm transition-colors"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {checking ? "Checking..." : "Run Check"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <StatCard
            label="Total Keywords"
            value={keywords.length}
            icon={<Target className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            label="Avg Position"
            value={avgPosition > 0 ? avgPosition.toFixed(1) : "--"}
            icon={<BarChart2 className="h-5 w-5 text-violet-500" />}
          />
          <StatCard
            label="Total Clicks"
            value={totalClicks.toLocaleString()}
            icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
          />
          <StatCard
            label="Impressions"
            value={totalImpressions.toLocaleString()}
            icon={<Search className="h-5 w-5 text-amber-500" />}
          />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
          </div>
        )}

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
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={selectedKeyword.position_history}
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    tickFormatter={(v) => {
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
                    formatter={(value: number) => [`Position ${value}`, ""]}
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

        {/* Top Performing Keywords */}
        {topKeywords.length > 0 && (
          <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">Top Performing Keywords</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {topKeywords.slice(0, 6).map((kw) => (
                <div
                  key={kw.keyword}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700 truncate mr-3">
                    {kw.keyword}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      kw.position <= 3
                        ? "text-emerald-600"
                        : kw.position <= 10
                        ? "text-blue-600"
                        : "text-slate-500"
                    }`}
                  >
                    #{kw.position}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keywords Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">All Keywords</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : keywords.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Search className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No keyword data yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Run a check to start tracking your keywords.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-6 py-3 font-medium text-slate-500">Keyword</th>
                    <th className="px-4 py-3 font-medium text-slate-500 text-right">Position</th>
                    <th className="px-4 py-3 font-medium text-slate-500 text-right">Clicks</th>
                    <th className="px-4 py-3 font-medium text-slate-500 text-right">Impressions</th>
                    <th className="px-4 py-3 font-medium text-slate-500 text-right">CTR</th>
                    <th className="px-4 py-3 font-medium text-slate-500 text-center">History</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => (
                    <tr
                      key={kw.keyword}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-slate-700">{kw.keyword}</td>
                      <td className="px-4 py-3 text-right">
                        <PositionBadge position={kw.position} />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {kw.clicks.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {kw.impressions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {(kw.ctr * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        {kw.position_history && kw.position_history.length > 0 ? (
                          <button
                            onClick={() => setSelectedKeyword(kw)}
                            className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                          >
                            View
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
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
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

function PositionBadge({ position }: { position: number }) {
  if (position <= 0) return <span className="text-slate-400">--</span>;
  const color =
    position <= 3
      ? "text-emerald-600 bg-emerald-50"
      : position <= 10
      ? "text-blue-600 bg-blue-50"
      : position <= 30
      ? "text-amber-600 bg-amber-50"
      : "text-slate-600 bg-slate-50";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      #{position}
    </span>
  );
}
