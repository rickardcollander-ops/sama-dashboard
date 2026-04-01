"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp, Loader2, BarChart2, Users, MousePointerClick,
  Eye, DollarSign, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { tenantApi } from "@/lib/api";
import { IS_DEMO, demoAnalytics } from "@/lib/demo-data";

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
}

export default function CustomerAnalyticsPage() {
  const { user, loading: userLoading } = useUser();
  const [data, setData] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchAnalytics();
  }, [user]);

  const fetchAnalytics = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const client = tenantApi(user.id);
      const result = await client.get<AnalyticsData>("/api/analytics/overview");
      const hasData = result.channels?.length || result.daily?.length || result.totals;
      setData(hasData ? result : IS_DEMO ? demoAnalytics : result);
    } catch (err) {
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
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <TrendingUp className="h-7 w-7 text-emerald-500" />
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cross-channel performance metrics and ROI tracking
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <MetricCard
            label="Total Clicks"
            value={(totals.clicks ?? 0).toLocaleString()}
            icon={<MousePointerClick className="h-5 w-5 text-blue-500" />}
          />
          <MetricCard
            label="Impressions"
            value={(totals.impressions ?? 0).toLocaleString()}
            icon={<Eye className="h-5 w-5 text-violet-500" />}
          />
          <MetricCard
            label="Conversions"
            value={(totals.conversions ?? 0).toLocaleString()}
            icon={<Users className="h-5 w-5 text-emerald-500" />}
          />
          <MetricCard
            label="Total Spend"
            value={`$${(totals.spend ?? 0).toLocaleString()}`}
            icon={<DollarSign className="h-5 w-5 text-amber-500" />}
          />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
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
                <h2 className="font-semibold text-slate-900 mb-4">Daily Performance</h2>
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
                <h2 className="font-semibold text-slate-900 mb-4">Channel Breakdown</h2>
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
                        <th className="px-4 py-3 font-medium text-slate-500">Channel</th>
                        <th className="px-4 py-3 font-medium text-slate-500 text-right">Clicks</th>
                        <th className="px-4 py-3 font-medium text-slate-500 text-right">Impressions</th>
                        <th className="px-4 py-3 font-medium text-slate-500 text-right">Conversions</th>
                        <th className="px-4 py-3 font-medium text-slate-500 text-right">Spend</th>
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
                <p className="text-sm text-slate-500">No analytics data yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Data will appear here once SAMA agents have been running and collecting metrics.
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
}: {
  label: string;
  value: string;
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
