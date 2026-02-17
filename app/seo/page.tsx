"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Search, TrendingUp } from "lucide-react";
import Link from "next/link";

interface KeywordData {
  keyword: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
}

export default function SEOPage() {
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [stats, setStats] = useState({
    avgPosition: 1.6,
    totalClicks: 34,
    totalImpressions: 117,
    avgCTR: 29.0,
  });

  useEffect(() => {
    // Simulate loading real data from SAMA API
    setTimeout(() => {
      setKeywords([
        { keyword: "successifier", position: 1.0, clicks: 28, impressions: 95, ctr: 29.5 },
        { keyword: "customer success platform", position: 2.1, clicks: 4, impressions: 15, ctr: 26.7 },
        { keyword: "cs automation", position: 3.5, clicks: 2, impressions: 7, ctr: 28.6 },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Search className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">SEO Agent</h1>
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">SEO Performance</h2>
          <p className="mt-2 text-slate-600">Google Search Console data for successifier.com</p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Avg Position</p>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.avgPosition}</p>
            <p className="mt-1 text-sm text-green-600">↑ 0.3 from last week</p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Total Clicks</p>
              <ArrowUp className="h-5 w-5 text-blue-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalClicks}</p>
            <p className="mt-1 text-sm text-blue-600">Last 28 days</p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Impressions</p>
              <ArrowUp className="h-5 w-5 text-purple-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalImpressions}</p>
            <p className="mt-1 text-sm text-purple-600">Last 28 days</p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Avg CTR</p>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.avgCTR}%</p>
            <p className="mt-1 text-sm text-green-600">↑ 2.1% from last week</p>
          </div>
        </div>

        {/* Keywords Table */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b p-6">
            <h3 className="text-lg font-semibold text-slate-900">Top Keywords</h3>
            <p className="mt-1 text-sm text-slate-500">Your best performing search terms</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Keyword
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Clicks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Impressions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    CTR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  keywords.map((kw) => (
                    <tr key={kw.keyword} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{kw.keyword}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        <span className="inline-flex items-center gap-1">
                          {kw.position.toFixed(1)}
                          {kw.position <= 3 && <ArrowUp className="h-4 w-4 text-green-500" />}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">{kw.clicks}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{kw.impressions}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{kw.ctr.toFixed(1)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-4">
          <button className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">
            Run SEO Audit
          </button>
          <button className="rounded-lg border bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">
            View Full Report
          </button>
        </div>
      </main>
    </div>
  );
}
