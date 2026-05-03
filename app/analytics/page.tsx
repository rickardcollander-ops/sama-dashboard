"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, DollarSign, Users, RefreshCw, Play, Clock, Zap, Target } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

const _RAW_SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || '';
const SAMA_API_URL = /^https?:\/\//.test(_RAW_SAMA_API) ? _RAW_SAMA_API : '/api/sama';

interface ChannelData {
  channel: string;
  visits: number;
  conversions: number;
  conversionRate: number;
  cost: number;
  roas: string;
}

interface GA4Overview {
  total_sessions: number;
  total_pageviews: number;
  bounce_rate: number;
}

interface AttributionData {
  model: string;
  top_channel: string;
  percentage: number;
  description: string;
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelPerformance, setChannelPerformance] = useState<ChannelData[]>([]);
  const [stats, setStats] = useState({
    totalVisits: 0,
    totalConversions: 0,
    avgConversionRate: 0,
    totalRevenue: 0
  });
  const [ga4, setGa4] = useState<GA4Overview>({ total_sessions: 0, total_pageviews: 0, bounce_rate: 0 });
  const [funnelStages, setFunnelStages] = useState<any[]>([]);
  const [attribution, setAttribution] = useState<AttributionData[]>([]);
  const [days, setDays] = useState(30);
  const [collecting, setCollecting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const collectMetrics = async () => {
    setCollecting(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/analytics/metrics/collect`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Collected ${data.total_channels || 0} channels`);
        if (data.errors?.length) {
          toast.error(`Errors: ${data.errors.map((e: any) => e.error).join(', ').slice(0, 100)}`);
        }
        fetchAnalytics();
      } else {
        toast.error('Failed to collect metrics');
      }
    } catch {
      toast.error('Connection error');
    } finally {
      setCollecting(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Fetch historical metrics from daily_metrics table
      const response = await fetch(`${SAMA_API_URL}/api/analytics/metrics?days=${days}`);
      let metrics: any[] = [];

      if (response.ok) {
        const data = await response.json();
        metrics = data.metrics || data || [];
      } else {
        console.error('Error fetching analytics:', response.status);
      }

      // If no historical data, try live metrics from agents
      if (metrics.length === 0) {
        try {
          const liveResponse = await fetch(`${SAMA_API_URL}/api/analytics/metrics/live`);
          if (liveResponse.ok) {
            const liveData = await liveResponse.json();
            const channels = liveData.channels || {};
            const overview = liveData.overview || {};

            // Capture GA4 overview data
            if (overview.total_sessions) {
              setGa4({
                total_sessions: overview.total_sessions || 0,
                total_pageviews: overview.total_pageviews || 0,
                bounce_rate: overview.bounce_rate || 0,
              });
            }

            // Convert live data into metrics-like rows so the rest of the code works
            for (const [channel, chData] of Object.entries(channels)) {
              const ch = chData as any;
              if (ch && ch.status !== 'error' && channel !== 'ga4') {
                metrics.push({
                  channel,
                  total_sessions: ch.total_clicks || 0,
                  total_conversions: ch.total_conversions || 0,
                  total_revenue: ch.total_revenue || 0,
                  total_ad_spend: ch.total_spend || ch.total_ad_spend || 0,
                });
              }
            }
          }
        } catch (liveErr) {
          console.error('Live metrics also failed:', liveErr);
        }
      } else {
        // Check if historical metrics include ga4 channel for session data
        const ga4Rows = metrics.filter((m: any) => m.channel === 'ga4');
        if (ga4Rows.length > 0) {
          const totalSessions = ga4Rows.reduce((sum: number, m: any) => sum + (m.total_impressions || 0), 0);
          const totalPageviews = ga4Rows.reduce((sum: number, m: any) => sum + (m.total_clicks || 0), 0);
          const lastBounce = ga4Rows[0]?.avg_position || 0; // bounce_rate stored in avg_position
          setGa4({ total_sessions: totalSessions, total_pageviews: totalPageviews, bounce_rate: lastBounce });
          // Remove ga4 rows from channel performance table (it's shown in overview)
          metrics = metrics.filter((m: any) => m.channel !== 'ga4');
        }
      }

      if (metrics.length === 0) {
        toast.error('No analytics data available. Check that APIs are configured.');
        setError('No analytics data available');
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

        // Build funnel from real metrics — derive each stage from actual conversion rate
        const convRate = totalVisits > 0 ? totalConversions / totalVisits : 0;
        // Estimate intermediate stages as proportional steps between awareness and conversion
        const visitRate = Math.min(1, Math.max(convRate * 10, convRate > 0 ? 0.1 : 0));
        const trialRate = Math.max(convRate * 3, convRate > 0 ? 0.01 : 0);
        const activationRate = Math.max(convRate * 2, convRate > 0 ? 0.005 : 0);
        setFunnelStages([
          { stage: "Awareness", count: totalVisits, percentage: 100 },
          { stage: "Website Visit", count: Math.floor(totalVisits * visitRate), percentage: parseFloat((visitRate * 100).toFixed(1)) },
          { stage: "Trial Signup", count: Math.floor(totalVisits * trialRate), percentage: parseFloat((trialRate * 100).toFixed(1)) },
          { stage: "Activation", count: Math.floor(totalVisits * activationRate), percentage: parseFloat((activationRate * 100).toFixed(1)) },
          { stage: "Paid Conversion", count: totalConversions, percentage: parseFloat((convRate * 100).toFixed(1)) }
        ]);

        // Derive attribution from channel data
        if (channels.length > 0) {
          const sortedByVisits = [...channels].sort((a, b) => b.visits - a.visits);
          const sortedByConv = [...channels].sort((a, b) => b.conversions - a.conversions);
          const totalChannelConv = channels.reduce((s, c) => s + c.conversions, 0);
          setAttribution([
            {
              model: 'First Touch',
              top_channel: sortedByVisits[0]?.channel || 'N/A',
              percentage: totalVisits > 0 ? Math.round((sortedByVisits[0]?.visits || 0) / totalVisits * 100) : 0,
              description: 'Most common first interaction',
            },
            {
              model: 'Last Touch',
              top_channel: sortedByConv[0]?.channel || 'N/A',
              percentage: totalChannelConv > 0 ? Math.round((sortedByConv[0]?.conversions || 0) / totalChannelConv * 100) : 0,
              description: 'Most common final interaction',
            },
            {
              model: 'Assisted',
              top_channel: channels.length > 1 ? sortedByVisits[1]?.channel || 'N/A' : 'N/A',
              percentage: channels.length > 1 && totalVisits > 0 ? Math.round((sortedByVisits[1]?.visits || 0) / totalVisits * 100) : 0,
              description: 'Contribute to conversion path',
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to load analytics data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
<main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Analytics Agent</h2>
            <p className="mt-1 text-slate-500 text-sm">Cross-channel metrics, attribution models and conversion funnel.</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex rounded-lg border bg-white overflow-hidden">
              {[7, 14, 30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${days === d ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {d}d
                </button>
              ))}
            </div>
            <button onClick={collectMetrics} disabled={collecting}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400">
              {collecting ? <Clock className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Collect Now
            </button>
            <button onClick={fetchAnalytics} disabled={loading}
              className="flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading analytics data...</div>
        ) : error && channelPerformance.length === 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-12 text-center">
            <p className="text-red-700 font-medium">Failed to load analytics</p>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            <button onClick={fetchAnalytics} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Retry</button>
          </div>
        ) : (
          <>
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-4 mb-6 sm:mb-8">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{ga4.total_sessions > 0 ? 'Sessions (GA4)' : 'Search Clicks'}</p>
                <p className="text-3xl font-bold text-slate-900">{ga4.total_sessions > 0 ? ga4.total_sessions.toLocaleString() : stats.totalVisits.toLocaleString()}</p>
                {ga4.total_pageviews > 0 && <p className="text-xs text-slate-400 mt-1">{ga4.total_pageviews.toLocaleString()} pageviews</p>}
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{ga4.bounce_rate > 0 ? 'Bounce Rate' : 'Conversions'}</p>
                <p className="text-3xl font-bold text-slate-900">{ga4.bounce_rate > 0 ? `${ga4.bounce_rate}%` : stats.totalConversions}</p>
                {ga4.bounce_rate > 0 && stats.totalConversions > 0 && <p className="text-xs text-slate-400 mt-1">{stats.totalConversions} conversions</p>}
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
          <h2 className="text-xl font-semibold text-slate-900">Channel Performance</h2>
          <p className="mb-6 mt-1 text-sm text-slate-400">Breakdown of traffic and conversions by marketing channel over the last 30 days.</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-3 text-left text-sm font-medium text-slate-500">Channel</th>
                  <th className="pb-3 text-right text-sm font-medium text-slate-500">Clicks</th>
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
          <h2 className="text-xl font-semibold text-slate-900">Conversion Funnel</h2>
          <p className="mb-6 mt-1 text-sm text-slate-400">Estimated funnel stages from awareness to paid conversion, derived from actual session and conversion data.</p>
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

        {/* AI Weekly Takeaways */}
        <div className="mt-8 rounded-lg border border-indigo-200 bg-indigo-50/50 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-semibold text-slate-900">AI Takeaways</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {channelPerformance.length > 0 ? (() => {
              const best = [...channelPerformance].sort((a, b) => b.conversions - a.conversions)[0];
              const worst = [...channelPerformance].sort((a, b) => a.conversionRate - b.conversionRate)[0];
              const totalCost = channelPerformance.reduce((s, c) => s + c.cost, 0);
              const takeaways = [
                { text: `${best?.channel || '—'} is your top converter with ${best?.conversions || 0} conversions`, color: 'text-green-700 bg-green-50 border-green-200' },
                { text: `${worst?.channel || '—'} has the lowest conversion rate (${worst?.conversionRate || 0}%) — consider optimizing`, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                { text: `Total marketing spend: $${totalCost.toLocaleString()} across ${channelPerformance.length} channels`, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                { text: stats.avgConversionRate > 3 ? 'Conversion rate is above average for B2B SaaS — keep scaling' : 'Conversion rate is below B2B average (3%) — focus on landing page optimization', color: stats.avgConversionRate > 3 ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200' },
              ];
              return takeaways.map((t, i) => (
                <div key={i} className={`rounded-lg border p-3 text-sm ${t.color}`}>{t.text}</div>
              ));
            })() : (
              <p className="text-sm text-slate-500 col-span-2">Collect metrics to generate AI takeaways.</p>
            )}
          </div>
        </div>

        {/* Goal Tracking */}
        <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-slate-900">Goal Tracking</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Monthly Visits', current: stats.totalVisits, target: 10000, color: 'blue' },
              { label: 'Monthly Conversions', current: stats.totalConversions, target: 100, color: 'green' },
              { label: 'Revenue Target', current: stats.totalRevenue, target: 50000, color: 'purple', isMoney: true },
            ].map(goal => {
              const pct = Math.min((goal.current / goal.target) * 100, 100);
              const display = goal.isMoney ? `$${(goal.current / 1000).toFixed(1)}k / $${(goal.target / 1000).toFixed(0)}k` : `${goal.current.toLocaleString()} / ${goal.target.toLocaleString()}`;
              return (
                <div key={goal.label} className="rounded-lg border p-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">{goal.label}</p>
                  <p className="text-lg font-bold text-slate-900 mb-2">{display}</p>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all bg-${goal.color}-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{pct.toFixed(0)}% of target</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Attribution Model */}
        <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Attribution Model</h2>
          <p className="text-sm text-slate-400 mb-4">Shows which channels drive conversions using three attribution methods: first interaction, last interaction, and assisted (supporting) channels.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {attribution.length > 0 ? attribution.map((a, i) => {
              const colors = ['text-blue-600', 'text-green-600', 'text-purple-600'];
              return (
                <div key={a.model} className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">{a.model}</h3>
                  <p className={`mt-2 text-2xl font-bold ${colors[i]}`}>{a.top_channel}: {a.percentage}%</p>
                  <p className="mt-1 text-sm text-slate-500">{a.description}</p>
                </div>
              );
            }) : (
              <>
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">First Touch</h3>
                  <p className="mt-2 text-2xl font-bold text-slate-400">No data</p>
                  <p className="mt-1 text-sm text-slate-500">Run analytics to see attribution</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">Last Touch</h3>
                  <p className="mt-2 text-2xl font-bold text-slate-400">No data</p>
                  <p className="mt-1 text-sm text-slate-500">Run analytics to see attribution</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">Assisted</h3>
                  <p className="mt-2 text-2xl font-bold text-slate-400">No data</p>
                  <p className="mt-1 text-sm text-slate-500">Run analytics to see attribution</p>
                </div>
              </>
            )}
          </div>
        </div>
        </>
        )}
      </main>
    </div>
  );
}
