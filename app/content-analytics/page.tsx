"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Eye, Clock, MousePointerClick, Target } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://sama-agent-ivory.vercel.app';

interface ContentPerformance {
  url_path: string;
  title: string;
  pageviews: number;
  avg_time_on_page: number;
  bounce_rate: number;
  engagement_rate: number;
  conversions: number;
}

export default function ContentAnalyticsPage() {
  const [topContent, setTopContent] = useState<ContentPerformance[]>([]);
  const [underperforming, setUnderperforming] = useState<ContentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState("pageviews");

  useEffect(() => {
    fetchAnalytics();
  }, [metric]);

  const fetchAnalytics = async () => {
    try {
      // Fetch top performing
      const topResponse = await fetch(
        `${SAMA_API_URL}/api/content/analytics/top-performing?days=30&limit=10&metric=${metric}`
      );
      if (topResponse.ok) {
        const data = await topResponse.json();
        setTopContent(data.content || []);
      }

      // Fetch underperforming
      const underResponse = await fetch(
        `${SAMA_API_URL}/api/content/analytics/underperforming?threshold=100&days=30`
      );
      if (underResponse.ok) {
        const data = await underResponse.json();
        setUnderperforming(data.content || []);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Content Analytics (GA4)</h1>
              <p className="text-sm text-slate-500">Real-time performance tracking</p>
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
        {/* Metric Selector */}
        <div className="mb-6 flex gap-2">
          {['pageviews', 'engagement_rate', 'conversions', 'time_on_page'].map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                metric === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {m.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Loading analytics...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Performing Content */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-slate-900">Top Performing Content</h2>
              </div>

              <div className="space-y-3">
                {topContent.map((content, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-slate-50"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">{content.title}</h3>
                      <p className="text-sm text-slate-500">{content.url_path}</p>
                    </div>

                    <div className="flex gap-6 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Eye className="h-4 w-4" />
                          <span className="font-medium text-slate-900">{content.pageviews.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-500">Views</p>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium text-slate-900">{formatTime(content.avg_time_on_page)}</span>
                        </div>
                        <p className="text-xs text-slate-500">Avg Time</p>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center gap-1 text-slate-500">
                          <MousePointerClick className="h-4 w-4" />
                          <span className="font-medium text-slate-900">{content.engagement_rate.toFixed(1)}%</span>
                        </div>
                        <p className="text-xs text-slate-500">Engagement</p>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Target className="h-4 w-4" />
                          <span className="font-medium text-slate-900">{content.conversions}</span>
                        </div>
                        <p className="text-xs text-slate-500">Conversions</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Underperforming Content */}
            {underperforming.length > 0 && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Needs Optimization</h2>
                </div>

                <div className="space-y-3">
                  {underperforming.map((content, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-4"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900">{content.title}</h3>
                        <p className="text-sm text-slate-500">{content.url_path}</p>
                        <p className="mt-1 text-xs text-orange-600">
                          Only {content.pageviews} views in 30 days - consider refreshing or promoting
                        </p>
                      </div>

                      <button className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
                        Optimize
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
