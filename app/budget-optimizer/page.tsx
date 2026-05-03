"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/components/Toast";

const _RAW_SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || '';
const SAMA_API_URL = /^https?:\/\//.test(_RAW_SAMA_API) ? _RAW_SAMA_API : '/api/sama';

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  current_budget: number;
  roas: number;
  cpa: number;
  performance_score: number;
}

interface Recommendation {
  campaign_name: string;
  current_budget: number;
  recommended_budget: number;
  change_amount: number;
  change_percentage: number;
  reason: string;
  roas: number;
}

export default function BudgetOptimizerPage() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [requiresApproval, setRequiresApproval] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    analyzeCampaigns();
  }, []);

  const analyzeCampaigns = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/ads/budget/analyze?days=7`);
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Error analyzing campaigns:', error);
      const msg = error instanceof Error ? error.message : 'Failed to analyze campaigns';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const optimizeBudgets = async () => {
    setOptimizing(true);
    try {
      const totalBudget = campaigns.reduce((sum, c) => sum + c.current_budget, 0);
      const response = await fetch(`${SAMA_API_URL}/api/ads/budget/optimize?total_budget=${totalBudget}`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.auto_apply || []);
        setRequiresApproval(data.requires_approval || []);
        toast.success('Budget optimization complete');
      } else {
        toast.error(`Optimization failed (HTTP ${response.status})`);
      }
    } catch (error) {
      console.error('Error optimizing budgets:', error);
      toast.error('Error connecting to backend for optimization');
    } finally {
      setOptimizing(false);
    }
  };

  const applyChanges = async (recs: Recommendation[]) => {
    try {
      const response = await fetch(`${SAMA_API_URL}/api/ads/budget/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations: recs })
      });

      if (response.ok) {
        toast.success('Budget changes applied successfully!');
        analyzeCampaigns();
        setRecommendations([]);
        setRequiresApproval([]);
      } else {
        toast.error('Failed to apply budget changes');
      }
    } catch {
      toast.error('Error applying changes');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Budget Optimizer</h2>
          <p className="mt-1 text-slate-500 text-sm">Analyzes campaign performance and recommends budget reallocations. Small changes (&lt;30%) can be auto-applied; larger changes require approval in the Approvals page.</p>
        </div>
        <div className="mb-6 flex gap-4">
          <button
            onClick={analyzeCampaigns}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? 'Analyzing...' : 'Analyze Campaigns'}
          </button>
          <button
            onClick={optimizeBudgets}
            disabled={optimizing || campaigns.length === 0}
            className="rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700 disabled:bg-green-400"
          >
            {optimizing ? 'Optimizing...' : 'Optimize Budgets'}
          </button>
        </div>

        <div className="space-y-6">
          {/* Campaign Performance */}
          {campaigns.length > 0 && (
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Campaign Performance</h2>
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.campaign_id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">{campaign.campaign_name}</h3>
                      <p className="text-sm text-slate-500">
                        Budget: ${campaign.current_budget.toFixed(2)}/day
                      </p>
                    </div>

                    <div className="flex gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-semibold text-slate-900">{campaign.roas.toFixed(2)}x</p>
                        <p className="text-xs text-slate-500">ROAS</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-slate-900">${campaign.cpa.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">CPA</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-slate-900">{(campaign.performance_score * 100).toFixed(0)}%</p>
                        <p className="text-xs text-slate-500">Score</p>
                      </div>
                    </div>

                    {campaign.roas >= 2.0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto-Apply Recommendations */}
          {recommendations.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h2 className="text-lg font-semibold text-green-900">Auto-Apply (Changes &lt;30%)</h2>
                </div>
                <button
                  onClick={() => applyChanges(recommendations)}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Apply All Changes
                </button>
              </div>

              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="rounded-lg border border-green-300 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900">{rec.campaign_name}</h3>
                        <p className="text-sm text-slate-600">{rec.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">
                          ${rec.current_budget.toFixed(2)} → ${rec.recommended_budget.toFixed(2)}
                        </p>
                        <p className={`text-sm ${rec.change_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {rec.change_amount > 0 ? '+' : ''}{rec.change_percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requires Approval */}
          {requiresApproval.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-orange-900">Requires Approval (Changes &gt;30%)</h2>
              </div>

              <div className="space-y-3">
                {requiresApproval.map((rec, idx) => (
                  <div key={idx} className="rounded-lg border border-orange-300 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900">{rec.campaign_name}</h3>
                        <p className="text-sm text-slate-600">{rec.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">
                          ${rec.current_budget.toFixed(2)} → ${rec.recommended_budget.toFixed(2)}
                        </p>
                        <p className="text-sm text-orange-600">
                          {rec.change_percentage.toFixed(1)}% change - needs approval
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm text-orange-700">
                These changes require manual approval in the Approvals page.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
