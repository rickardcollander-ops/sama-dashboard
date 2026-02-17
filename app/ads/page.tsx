"use client";

import { useEffect, useState } from "react";
import { TrendingUp, DollarSign, MousePointerClick, Eye } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Campaign {
  id: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
}

export default function AdsPage() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [showRecs, setShowRecs] = useState(false);
  const [stats, setStats] = useState({
    totalSpend: 0,
    totalClicks: 0,
    totalImpressions: 0,
    avgCTR: 0,
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch(`${SAMA_API_URL}/api/ads/campaigns`);
      if (response.ok) {
        const data = await response.json();
        // Backend returns campaigns as object {name: config} - convert to array
        let campaignList: Campaign[] = [];
        const raw = data.campaigns;
        if (Array.isArray(raw)) {
          campaignList = raw;
        } else if (raw && typeof raw === 'object') {
          campaignList = Object.entries(raw).map(([key, val]: [string, any], idx) => ({
            id: String(idx + 1),
            name: val?.name || key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            status: 'Active',
            impressions: val?.impressions || 0,
            clicks: val?.clicks || 0,
            cost: val?.budget?.daily || val?.cost || 0,
            conversions: val?.conversions || 0,
            ctr: val?.ctr || 0,
          }));
        }
        setCampaigns(campaignList);
        if (campaignList.length > 0) {
          const totalSpend = campaignList.reduce((s: number, c: any) => s + (c.cost || 0), 0);
          const totalClicks = campaignList.reduce((s: number, c: any) => s + (c.clicks || 0), 0);
          const totalImpressions = campaignList.reduce((s: number, c: any) => s + (c.impressions || 0), 0);
          setStats({
            totalSpend,
            totalClicks,
            totalImpressions,
            avgCTR: totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const optimizeCampaigns = async () => {
    setOptimizing(true);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/ads/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      alert(data.message || 'Campaign optimization started!');
    } catch (error) {
      alert('Failed to optimize campaigns. Check backend connection.');
    } finally {
      setOptimizing(false);
    }
  };

  const viewRecommendations = async () => {
    setShowRecs(true);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/ads/status`);
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      } else {
        setRecommendations({ error: 'Could not load recommendations.' });
      }
    } catch (error) {
      setRecommendations({ error: 'Backend not reachable.' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-slate-900">Ads Agent</h1>
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Google Ads Performance</h2>
          <p className="mt-2 text-slate-600">Campaign metrics and optimization insights</p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Total Spend</p>
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">${stats.totalSpend}</p>
            <p className="mt-1 text-sm text-slate-500">Last 30 days</p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Total Clicks</p>
              <MousePointerClick className="h-5 w-5 text-blue-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalClicks}</p>
            <p className="mt-1 text-sm text-slate-500">Last 30 days</p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Impressions</p>
              <Eye className="h-5 w-5 text-purple-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalImpressions}</p>
            <p className="mt-1 text-sm text-slate-500">Last 30 days</p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Avg CTR</p>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.avgCTR}%</p>
            <p className="mt-1 text-sm text-slate-500">Last 30 days</p>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b p-6">
            <h3 className="text-lg font-semibold text-slate-900">Active Campaigns</h3>
            <p className="mt-1 text-sm text-slate-500">Monitor and optimize your Google Ads campaigns</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Campaign
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Impressions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Clicks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    CTR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500">
                      Loading campaigns...
                    </td>
                  </tr>
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <p className="text-sm text-slate-500">No active campaigns found</p>
                      <p className="mt-1 text-xs text-slate-400">Create campaigns in Google Ads to see data here</p>
                    </td>
                  </tr>
                ) : (
                  campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{campaign.name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">{campaign.impressions}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{campaign.clicks}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">${campaign.cost.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{campaign.ctr.toFixed(2)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-4">
          <button 
            onClick={optimizeCampaigns}
            disabled={optimizing}
            className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
          >
            {optimizing ? 'Optimizing...' : 'Optimize Campaigns'}
          </button>
          <button 
            onClick={viewRecommendations}
            className="rounded-lg border bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            View Recommendations
          </button>
        </div>

        {showRecs && (
          <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Recommendations</h3>
              <button onClick={() => setShowRecs(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>
            {recommendations?.error ? (
              <p className="text-slate-500">{recommendations.error}</p>
            ) : recommendations ? (
              <pre className="rounded bg-slate-50 p-4 text-xs text-slate-600 overflow-auto max-h-64">{JSON.stringify(recommendations, null, 2)}</pre>
            ) : (
              <p className="text-slate-500">Loading...</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
