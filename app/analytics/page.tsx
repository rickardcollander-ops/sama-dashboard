"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, DollarSign, Users } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface ChannelData {
  channel: string;
  visits: number;
  conversions: number;
  conversionRate: number;
  cost: number;
  roas: string;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [channelPerformance, setChannelPerformance] = useState<ChannelData[]>([]);
  const [stats, setStats] = useState({
    totalVisits: 0,
    totalConversions: 0,
    avgConversionRate: 0,
    totalRevenue: 0
  });
  const [funnelStages, setFunnelStages] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch from backend API
      const response = await fetch(`${SAMA_API_URL}/api/analytics/metrics?days=30`);
      let metrics: any[] = [];
      
      if (response.ok) {
        const data = await response.json();
        metrics = data.metrics || data || [];
      } else {
        console.error('Error fetching analytics:', response.status);
      }

      if (metrics.length > 0) {
        // Calculate totals
        const totalVisits = metrics.reduce((sum, m) => sum + (m.total_sessions || 0), 0);
        const totalConversions = metrics.reduce((sum, m) => sum + (m.total_conversions || 0), 0);
        const totalRevenue = metrics.reduce((sum, m) => sum + (m.total_revenue || 0), 0);
        const avgConversionRate = totalVisits > 0 ? (totalConversions / totalVisits) * 100 : 0;

        setStats({
          totalVisits,
          totalConversions,
          avgConversionRate: parseFloat(avgConversionRate.toFixed(2)),
          totalRevenue
        });

        // Group by channel (if available)
        const channelMap = new Map<string, any>();
        metrics.forEach(m => {
          const channel = m.channel || 'Direct';
          if (!channelMap.has(channel)) {
            channelMap.set(channel, {
              channel,
              visits: 0,
              conversions: 0,
              cost: 0
            });
          }
          const ch = channelMap.get(channel);
          ch.visits += m.total_sessions || 0;
          ch.conversions += m.total_conversions || 0;
          ch.cost += m.total_ad_spend || 0;
        });

        const channels = Array.from(channelMap.values()).map(ch => ({
          ...ch,
          conversionRate: ch.visits > 0 ? parseFloat(((ch.conversions / ch.visits) * 100).toFixed(2)) : 0,
          roas: ch.cost > 0 ? `${((ch.conversions * 800) / ch.cost).toFixed(1)}x` : '∞'
        }));

        setChannelPerformance(channels);

        // Simple funnel (can be enhanced with real data)
        setFunnelStages([
          { stage: "Awareness", count: totalVisits, percentage: 100 },
          { stage: "Website Visit", count: Math.floor(totalVisits * 0.76), percentage: 76 },
          { stage: "Trial Signup", count: Math.floor(totalVisits * 0.042), percentage: 4.2 },
          { stage: "Activation", count: Math.floor(totalVisits * 0.028), percentage: 2.8 },
          { stage: "Paid Conversion", count: totalConversions, percentage: parseFloat(((totalConversions / totalVisits) * 100).toFixed(1)) }
        ]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Analytics Agent</h1>
              <p className="text-sm text-slate-500">Cross-channel attribution and performance insights</p>
            </div>
            <Link
              href="/"
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading analytics data...</div>
        ) : (
          <>
        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Visits</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalVisits.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Conversions</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalConversions}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Conversion Rate</p>
                <p className="text-3xl font-bold text-slate-900">{stats.avgConversionRate}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Revenue (30d)</p>
                <p className="text-3xl font-bold text-slate-900">${(stats.totalRevenue / 1000).toFixed(0)}k</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Channel Performance */}
        <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-slate-900">Channel Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-3 text-left text-sm font-medium text-slate-500">Channel</th>
                  <th className="pb-3 text-right text-sm font-medium text-slate-500">Visits</th>
                  <th className="pb-3 text-right text-sm font-medium text-slate-500">Conversions</th>
                  <th className="pb-3 text-right text-sm font-medium text-slate-500">Conv. Rate</th>
                  <th className="pb-3 text-right text-sm font-medium text-slate-500">Cost</th>
                  <th className="pb-3 text-right text-sm font-medium text-slate-500">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {channelPerformance.map((channel, index) => (
                  <tr key={channel.channel} className={index !== channelPerformance.length - 1 ? "border-b border-slate-100" : ""}>
                    <td className="py-4 text-sm font-medium text-slate-900">{channel.channel}</td>
                    <td className="py-4 text-right text-sm text-slate-600">{channel.visits.toLocaleString()}</td>
                    <td className="py-4 text-right text-sm text-slate-600">{channel.conversions}</td>
                    <td className="py-4 text-right text-sm text-slate-600">{channel.conversionRate}%</td>
                    <td className="py-4 text-right text-sm text-slate-600">
                      {channel.cost === 0 ? "$0" : `$${channel.cost.toLocaleString()}`}
                    </td>
                    <td className="py-4 text-right text-sm font-medium text-green-600">{channel.roas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-slate-900">Conversion Funnel</h2>
          <div className="space-y-4">
            {funnelStages.map((stage, index) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-900">{stage.stage}</span>
                  <span className="text-sm text-slate-500">
                    {stage.count.toLocaleString()} ({stage.percentage}%)
                  </span>
                </div>
                <div className="h-8 rounded-lg bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                    style={{ width: `${stage.percentage}%` }}
                  ></div>
                </div>
                {index < funnelStages.length - 1 && (
                  <div className="mt-2 text-xs text-slate-400">
                    Drop-off: {((funnelStages[index].count - funnelStages[index + 1].count) / funnelStages[index].count * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Attribution Model */}
        <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Attribution Model</h2>
          <p className="text-sm text-slate-500 mb-4">Multi-touch attribution showing channel contribution to conversions</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">First Touch</h3>
              <p className="mt-2 text-2xl font-bold text-blue-600">Organic: 45%</p>
              <p className="mt-1 text-sm text-slate-500">Most common first interaction</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">Last Touch</h3>
              <p className="mt-2 text-2xl font-bold text-green-600">Direct: 38%</p>
              <p className="mt-1 text-sm text-slate-500">Most common final interaction</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">Assisted</h3>
              <p className="mt-2 text-2xl font-bold text-purple-600">Ads: 67%</p>
              <p className="mt-1 text-sm text-slate-500">Contribute to conversion path</p>
            </div>
          </div>
        </div>
        </>
        )}
      </main>
    </div>
  );
}
