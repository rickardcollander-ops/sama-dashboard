"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp, Loader2, BarChart2, Users, MousePointerClick,
  Eye, DollarSign, AlertCircle, X,
  RefreshCw, Download,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import CustomerNav from "@/components/CustomerNav";
import GoogleDataDiagnostics from "@/components/GoogleDataDiagnostics";
import { useUser } from "@/lib/hooks/useUser";
import { usePeriod } from "@/lib/hooks/usePeriod";
import { tenantApi, pollAgentRun } from "@/lib/api";
import { IS_DEMO, demoAnalytics } from "@/lib/demo-data";
import PeriodSelector from "@/components/dashboard/PeriodSelector";
import TrendBadge from "@/components/dashboard/TrendBadge";
import { exportCsv } from "@/lib/csv";

interface ChannelMetric {
  channel: string;
  clicks: number;
  impressions: number;
  conversions: number;
  spend: number;
}

interface DailyMetric {
  date: string;
  clicks: number;
  impressions: number;
}

interface AnalyticsData {
  channels?: ChannelMetric[];
  daily?: DailyMetric[];
  totals?: {
    clicks: number;
    impressions: number;
    conversions: number;
    spend: number;
  };
  previous_totals?: {
    clicks: number;
    impressions: number;
    conversions: number;
    spend: number;
  };
}

export default function CustomerAnalyticsPage() {
  const { user, loading: userLoading } = useUser();
  const { period, setPeriod, days } = usePeriod();
  const [data, setData] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    try {
      const savedCompare = localStorage.getItem("sama-analytics-compare");
      if (savedCompare === "true") setCompare(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sama-analytics-compare", String(compare));
    } catch {}
  }, [compare]);

  useEffect(() => {
    if (user) fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, days, compare]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    setError(null);
    try {
      // Trigger a fresh agent run instead of just re-reading the cache.
      // The cache is populated by `analytics_agent.collect_daily_metrics`
      // — re-fetching `/overview` without triggering the agent would just
      // return the same numbers we already have on screen.
      const client = tenantApi(user.id);
      const resp = await client.post<{ run_id?: string; status?: string }>(
        `/api/tenant/agents/analytics/trigger`,
        undefined,
        { headers: { "X-Sama-Intent": "user-action" } },
      );
      if (resp?.run_id && resp?.status === "running") {
        const run = await pollAgentRun(user.id, resp.run_id);
        if (run.status === "failed") {
          setError(run.error || run.summary || "Sync failed");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh analytics");
    }
    await fetchAnalytics();
    setRefreshing(false);
  };

  const fetchAnalytics = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const client = tenantApi(user.id);
      const params = new URLSearchParams({ days: String(days) });
      if (compare) params.set("compare", "1");
      const result = await client.get<AnalyticsData>(`/api/analytics/overview?${params.toString()}`);
      const totals = result.totals;
      const totalsHaveValues = !!totals && (
        (totals.clicks ?? 0) > 0 ||
        (totals.impressions ?? 0) > 0 ||
        (totals.conversions ?? 0) > 0 ||
        (totals.spend ?? 0) > 0
      );
      const hasData = (result.channels?.length || 0) > 0 || (result.daily?.length || 0) > 0 || totalsHaveValues;
      setData(hasData ? result : IS_DEMO ? demoAnalytics : result);
    } catch (err: any) {
      console.error("Failed to fetch analytics:", err);
      if (IS_DEMO) {
        setData(demoAnalytics);
      } else {
        setError("Could not load analytics data. Data will appear once agents have been running.");
      }
    }
    setLoading(false);
  };

  const totals = data.totals || { clicks: 0, impressions: 0, conversions: 0, spend: 0 };
  const prev = data.previous_totals;

  const delta = (curr: number, prevVal: number | undefined): number | null => {
    if (!compare || prevVal === undefined || prevVal === 0) return null;
    return (curr - prevVal) / prevVal;
  };

  const handleExportCsv = () => {
    if (!data.channels || data.channels.length === 0) return;
    exportCsv(
      `analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
      data.channels,
      [
        { header: "Channel", accessor: (c) => c.channel },
        { header: "Clicks", accessor: (c) => c.clicks },
        { header: "Impressions", accessor: (c) => c.impressions },
        { header: "Conversions", accessor: (c) => c.conversions },
        { header: "Spend", accessor: (c) => c.spend },
      ]
    );
  };

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
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-emerald-500" />
              Trafik
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Trafik och konvertering över alla kanaler
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelector value={period} onChange={setPeriod} />
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Jämför med föregående
            </label>
            <button
              onClick={handleExportCsv}
              disabled={!data.channels || data.channels.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Exportera
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300 shadow-sm transition-colors"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {refreshing ? "Hämtar…" : "Uppdatera"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <MetricCard
            label="Klick"
            value={(totals.clicks ?? 0).toLocaleString()}
            icon={<MousePointerClick className="h-5 w-5 text-blue-500" />}
            delta={delta(totals.clicks, prev?.clicks)}
          />
          <MetricCard
            label="Visningar"
            value={(totals.impressions ?? 0).toLocaleString()}
            icon={<Eye className="h-5 w-5 text-violet-500" />}
            delta={delta(totals.impressions, prev?.impressions)}
          />
          <MetricCard
            label="Konverteringar"
            value={(totals.conversions ?? 0).toLocaleString()}
            icon={<Users className="h-5 w-5 text-emerald-500" />}
            delta={delta(totals.conversions, prev?.conversions)}
          />
          <MetricCard
            label="Spendering"
            value={`$${(totals.spend ?? 0).toLocaleString()}`}
            icon={<DollarSign className="h-5 w-5 text-amber-500" />}
            delta={delta(totals.spend, prev?.spend)}
            invertedTrend
          />
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

        {/* Google data diagnostics — surfaces why no GA4 data is flowing in */}
        {user && !loading && !data.daily?.length && !data.channels?.length && (
          <div className="mb-8">
            <GoogleDataDiagnostics
              service="analytics"
              tenantId={user.id}
              agentName="analytics"
              trackedCount={(data.channels?.length || 0) + (data.daily?.length || 0)}
              onSynced={fetchAnalytics}
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Daily Trend */}
            {data.daily && data.daily.length > 0 && (
              <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="font-semibold text-slate-900 mb-4">Dag för dag</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.daily} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "#94a3b8" }}
                        tickFormatter={(v) => {
                          const d = new Date(v);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "none",
                          borderRadius: "8px",
                          color: "#f8fafc",
                          fontSize: "12px",
                        }}
                      />
                      <Line type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Channel Breakdown */}
            {data.channels && data.channels.length > 0 ? (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="font-semibold text-slate-900 mb-4">Per kanal</h2>
                <div className="h-64 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.channels} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="channel" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "none",
                          borderRadius: "8px",
                          color: "#f8fafc",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="clicks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="conversions" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Channel table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left">
                        <th className="px-4 py-3 font-medium text-slate-500">Kanal</th>
                        <th className="px-4 py-3 font-medium text-slate-500 text-right">Klick</th>
                        <th className="px-4 py-3 font-medium text-slate-500 text-right">Visningar</th>
                        <th className="px-4 py-3 font-medium text-slate-500 text-right">Konverteringar</th>
                        <th className="px-4 py-3 font-medium text-slate-500 text-right">Spendering</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.channels.map((ch) => (
                        <tr key={ch.channel} className="border-b border-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">{ch.channel}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{(ch.clicks ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{(ch.impressions ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{(ch.conversions ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-slate-600">${(ch.spend ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-white p-16 shadow-sm text-center">
                <BarChart2 className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">Ingen trafikdata än.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Data dyker upp här när SAMAs agenter har samlat in mätvärden.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  delta,
  invertedTrend,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  delta?: number | null;
  invertedTrend?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {delta !== undefined && delta !== null && (
          <TrendBadge delta={delta} format="percent" inverted={invertedTrend} />
        )}
      </div>
    </div>
  );
}
