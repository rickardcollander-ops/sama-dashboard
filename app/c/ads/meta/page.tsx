"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, Pause, Play, AlertCircle, CheckCircle,
  TrendingUp, Users, DollarSign, MousePointer, ChevronDown,
  ChevronRight, Sparkles, Settings, ArrowLeft, BarChart2, Eye, X,
} from "lucide-react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";

interface MetaStatus {
  connected: boolean;
  platform: string;
  account_name?: string;
  account_id?: string;
  currency?: string;
  timezone?: string;
  connected_at?: string;
  error?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | string;
  objective: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  conversions: number;
  cpl: number;
  ctr: number;
  frequency: number;
  start_time?: string;
}

interface Summary {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_leads: number;
  total_reach: number;
  blended_cpl: number;
  blended_ctr: number;
  blended_cpc: number;
  active_campaigns: number;
  paused_campaigns: number;
}

interface AdSet {
  id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  optimization_goal: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  leads: number;
  cpl: number;
}

interface Insight {
  title: string;
  observation: string;
  action: string;
  priority: "high" | "medium" | "low";
  campaign?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  PAUSED: "bg-amber-100 text-amber-700 border-amber-200",
  ARCHIVED: "bg-slate-100 text-slate-500 border-slate-200",
  DELETED: "bg-red-100 text-red-500 border-red-200",
};

const PRIORITY_STYLE: Record<string, string> = {
  high: "border-l-red-400 bg-red-50",
  medium: "border-l-amber-400 bg-amber-50",
  low: "border-l-blue-400 bg-blue-50",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700",
};

export default function MetaAdsPage() {
  const { user, loading: userLoading } = useUser();
  const { tenantClient } = useSite();

  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [dateRange, setDateRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState("");

  // Connect form
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [connectToken, setConnectToken] = useState("");
  const [connectAccountId, setConnectAccountId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  // Campaign actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState<{ id: string; value: string } | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [adsets, setAdsets] = useState<Record<string, AdSet[]>>({});
  const [loadingAdsets, setLoadingAdsets] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (user) loadAll();
  }, [user, dateRange]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadStatus(), loadCampaigns()]);
    setLoading(false);
  };

  const loadStatus = async () => {
    try {
      const data = await tenantClient.get<MetaStatus>("/api/ads/meta/status");
      setStatus(data);
    } catch {
      setStatus({ connected: false, platform: "meta" });
    }
  };

  const loadCampaigns = async () => {
    try {
      const data = await tenantClient.get<{
        configured: boolean;
        summary?: Summary;
        campaigns?: Campaign[];
      }>(`/api/ads/meta/campaigns?date_range=${dateRange}`);
      if (data.summary) setSummary(data.summary);
      if (data.campaigns) setCampaigns(data.campaigns);
    } catch {
      // Not yet connected — no-op
    }
  };

  const handleConnect = async () => {
    if (!connectToken.trim() || !connectAccountId.trim()) {
      setConnectError("Båda fälten krävs");
      return;
    }
    setConnecting(true);
    setConnectError("");
    try {
      await tenantClient.post("/api/ads/credentials", {
        platform: "meta",
        access_token: connectToken.trim(),
        account_id: connectAccountId.trim(),
      });
      const verified = await tenantClient.post<{ verified: boolean; error?: string }>(
        "/api/ads/meta/verify",
        {}
      );
      if (!verified.verified) {
        setConnectError(
          verified.error ||
            "Kunde inte verifiera uppgifterna. Kontrollera token och konto-ID."
        );
        setConnecting(false);
        return;
      }
      setConnectToken("");
      setConnectAccountId("");
      setShowConnectForm(false);
      await loadAll();
    } catch (e: any) {
      setConnectError(e?.message || "Anslutningen misslyckades. Kontrollera dina uppgifter.");
    }
    setConnecting(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handlePause = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      await tenantClient.post(`/api/ads/meta/campaigns/${campaignId}/pause`, {});
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, status: "PAUSED" } : c))
      );
    } catch (e: any) {
      setError(`Kunde inte pausa kampanjen: ${e?.message || e}`);
    }
    setActionLoading(null);
  };

  const handleResume = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      await tenantClient.post(`/api/ads/meta/campaigns/${campaignId}/resume`, {});
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, status: "ACTIVE" } : c))
      );
    } catch (e: any) {
      setError(`Kunde inte aktivera kampanjen: ${e?.message || e}`);
    }
    setActionLoading(null);
  };

  const handleBudgetSave = async (campaignId: string) => {
    if (!editingBudget) return;
    const budget = parseFloat(editingBudget.value);
    if (isNaN(budget) || budget < 1) {
      setError("Budget måste vara minst 1");
      return;
    }
    setActionLoading(campaignId);
    try {
      await tenantClient.post(`/api/ads/meta/campaigns/${campaignId}/budget`, {
        daily_budget: budget,
      });
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, daily_budget: budget } : c))
      );
      setEditingBudget(null);
    } catch (e: any) {
      setError(`Kunde inte uppdatera budget: ${e?.message || e}`);
    }
    setActionLoading(null);
  };

  const loadInsights = async () => {
    setLoadingInsights(true);
    try {
      const data = await tenantClient.get<{ insights: Insight[] }>("/api/ads/meta/insights");
      setInsights(data.insights || []);
    } catch (e: any) {
      setError(`Kunde inte hämta insights: ${e?.message || e}`);
    }
    setLoadingInsights(false);
  };

  const toggleCampaign = async (campaignId: string) => {
    if (expandedCampaign === campaignId) {
      setExpandedCampaign(null);
      return;
    }
    setExpandedCampaign(campaignId);
    if (!adsets[campaignId]) {
      setLoadingAdsets(campaignId);
      try {
        const data = await tenantClient.get<{ adsets: AdSet[] }>(
          `/api/ads/meta/campaigns/${campaignId}/adsets?date_range=${dateRange}`
        );
        setAdsets((prev) => ({ ...prev, [campaignId]: data.adsets || [] }));
      } catch {
        setAdsets((prev) => ({ ...prev, [campaignId]: [] }));
      }
      setLoadingAdsets(null);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n);
  const fmtDec = (n: number) =>
    new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(n);

  if (userLoading || loading) {
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

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/c/ads"
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#1877F2] flex items-center justify-center text-white font-bold text-sm">
                  f
                </div>
                Meta Ads
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">Facebook + Instagram kampanjer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={7}>7 dagar</option>
              <option value={14}>14 dagar</option>
              <option value={30}>30 dagar</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Uppdatera
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
            <button onClick={() => setError("")} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Not connected — setup banner */}
        {status && !status.connected && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-1">Meta Ads inte ansluten</h3>
                <p className="text-sm text-amber-700 mb-4">
                  Anslut ditt Meta Ad Account för att visa och hantera kampanjer direkt härifrån.
                </p>

                {!showConnectForm ? (
                  <button
                    onClick={() => setShowConnectForm(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <div className="h-4 w-4 rounded bg-white/20 flex items-center justify-center font-bold text-xs">
                      f
                    </div>
                    Anslut Meta Ads
                  </button>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-white p-5 space-y-4 max-w-lg">
                    <h4 className="font-semibold text-slate-900">Anslut Meta Ads</h4>

                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
                      <p className="font-semibold">Hur du hämtar dina uppgifter:</p>
                      <p>1. Gå till <strong>Meta Business Manager</strong> → Inställningar → Systemanvändare</p>
                      <p>2. Skapa eller välj en systemanvändare → generera en <strong>långlängd access token</strong></p>
                      <p>3. Permissions: <code className="bg-blue-100 px-1 rounded">ads_management</code>, <code className="bg-blue-100 px-1 rounded">ads_read</code></p>
                      <p>4. Ad Account ID hittar du under Annonskonton (t.ex. <code className="bg-blue-100 px-1 rounded">act_123456789</code>)</p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Access Token
                        </label>
                        <input
                          type="password"
                          value={connectToken}
                          onChange={(e) => setConnectToken(e.target.value)}
                          placeholder="EAAxxxxxxx..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Ad Account ID
                        </label>
                        <input
                          type="text"
                          value={connectAccountId}
                          onChange={(e) => setConnectAccountId(e.target.value)}
                          placeholder="act_123456789 eller 123456789"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {connectError && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {connectError}
                      </p>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                      >
                        {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {connecting ? "Ansluter..." : "Anslut"}
                      </button>
                      <button
                        onClick={() => {
                          setShowConnectForm(false);
                          setConnectError("");
                        }}
                        className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Connected badge */}
        {status?.connected && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800">
              Ansluten till{" "}
              <strong>{status.account_name || status.account_id}</strong>
              {status.currency && ` · ${status.currency}`}
              {status.timezone && ` · ${status.timezone}`}
            </p>
            <Link
              href="/c/settings"
              className="ml-auto text-xs text-green-700 hover:underline flex items-center gap-1 shrink-0"
            >
              <Settings className="h-3 w-3" />
              Hantera
            </Link>
          </div>
        )}

        {/* Performance cards */}
        {summary && (
          <div className="mb-6 grid grid-cols-2 lg:grid-cols-5 gap-3">
            {([
              { label: "Spend", value: fmtDec(summary.total_spend), icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Leads", value: fmt(summary.total_leads), icon: Users, color: "text-green-600", bg: "bg-green-50" },
              { label: "CPL", value: fmtDec(summary.blended_cpl), icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Klick", value: fmt(summary.total_clicks), icon: MousePointer, color: "text-orange-600", bg: "bg-orange-50" },
              { label: "Visningar", value: fmt(summary.total_impressions), icon: Eye, color: "text-slate-600", bg: "bg-slate-100" },
            ] as const).map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`rounded-lg p-1.5 ${bg}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
                <p className="text-xl font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Summary bar */}
        {summary && (
          <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <span>
              <span className="font-semibold text-green-700">{summary.active_campaigns}</span> aktiva
            </span>
            <span>·</span>
            <span>
              <span className="font-semibold text-amber-700">{summary.paused_campaigns}</span> pausade
            </span>
            <span>·</span>
            <span>CTR {summary.blended_ctr.toFixed(2)}%</span>
            <span>·</span>
            <span>CPC {fmtDec(summary.blended_cpc)}</span>
            <span>·</span>
            <span>Räckvidd {fmt(summary.total_reach)}</span>
          </div>
        )}

        {/* Campaign list */}
        {campaigns.length > 0 && (
          <section className="mb-6 rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-500" />
                Kampanjer
              </h2>
              <span className="text-xs text-slate-400">Senaste {dateRange} dagarna</span>
            </div>

            <div className="divide-y">
              {campaigns.map((camp) => (
                <div key={camp.id}>
                  <div className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleCampaign(camp.id)}
                        className="mt-1 text-slate-400 hover:text-slate-600 shrink-0"
                        aria-label="Visa ad sets"
                      >
                        {expandedCampaign === camp.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                              STATUS_BADGE[camp.status] || "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {camp.status}
                          </span>
                          <span className="text-xs text-slate-400 uppercase tracking-wide">
                            {camp.objective?.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="font-medium text-slate-900 truncate">{camp.name}</p>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                          <span>
                            Spend: <strong className="text-slate-700">{fmtDec(camp.spend)}</strong>
                          </span>
                          <span>
                            Impressions: <strong className="text-slate-700">{fmt(camp.impressions)}</strong>
                          </span>
                          <span>
                            Klick: <strong className="text-slate-700">{fmt(camp.clicks)}</strong>
                          </span>
                          <span>
                            CTR: <strong className="text-slate-700">{camp.ctr.toFixed(2)}%</strong>
                          </span>
                          <span>
                            Leads: <strong className="text-slate-700">{camp.leads}</strong>
                          </span>
                          {camp.leads > 0 && (
                            <span>
                              CPL: <strong className="text-slate-700">{fmtDec(camp.cpl)}</strong>
                            </span>
                          )}
                          {camp.frequency > 0 && (
                            <span className={camp.frequency > 3.5 ? "text-amber-600 font-medium" : ""}>
                              Freq: <strong>{camp.frequency.toFixed(1)}</strong>
                              {camp.frequency > 3.5 && " ⚠️"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Budget + actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {editingBudget?.id === camp.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editingBudget.value}
                              onChange={(e) =>
                                setEditingBudget({ id: camp.id, value: e.target.value })
                              }
                              className="w-20 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleBudgetSave(camp.id);
                                if (e.key === "Escape") setEditingBudget(null);
                              }}
                            />
                            <button
                              onClick={() => handleBudgetSave(camp.id)}
                              disabled={actionLoading === camp.id}
                              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:bg-blue-300"
                            >
                              {actionLoading === camp.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "OK"
                              )}
                            </button>
                            <button
                              onClick={() => setEditingBudget(null)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          camp.daily_budget !== null && (
                            <button
                              onClick={() =>
                                setEditingBudget({
                                  id: camp.id,
                                  value: String(camp.daily_budget),
                                })
                              }
                              className="text-xs text-slate-500 hover:text-blue-600 hover:underline whitespace-nowrap"
                              title="Klicka för att redigera daglig budget"
                            >
                              {fmtDec(camp.daily_budget ?? 0)}/dag
                            </button>
                          )
                        )}

                        {camp.status === "ACTIVE" ? (
                          <button
                            onClick={() => handlePause(camp.id)}
                            disabled={actionLoading === camp.id}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-colors"
                            title="Pausa kampanj"
                          >
                            {actionLoading === camp.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Pause className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : camp.status === "PAUSED" ? (
                          <button
                            onClick={() => handleResume(camp.id)}
                            disabled={actionLoading === camp.id}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors"
                            title="Aktivera kampanj"
                          >
                            {actionLoading === camp.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Ad sets */}
                  {expandedCampaign === camp.id && (
                    <div className="px-8 pb-4 bg-slate-50/70 border-t">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-3 mb-2">
                        Ad Sets
                      </p>
                      {loadingAdsets === camp.id ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Laddar ad sets...
                        </div>
                      ) : !adsets[camp.id] || adsets[camp.id].length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">Inga ad sets hittades</p>
                      ) : (
                        <div className="space-y-2">
                          {adsets[camp.id].map((adset) => (
                            <div
                              key={adset.id}
                              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                                    STATUS_BADGE[adset.status] || "bg-slate-100 text-slate-500 border-slate-200"
                                  }`}
                                >
                                  {adset.status}
                                </span>
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {adset.name}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                                <span>Spend: {fmtDec(adset.spend)}</span>
                                <span>Leads: {adset.leads}</span>
                                {adset.leads > 0 && <span>CPL: {fmtDec(adset.cpl)}</span>}
                                <span>Impressions: {fmt(adset.impressions)}</span>
                                {adset.frequency > 0 && (
                                  <span className={adset.frequency > 3.5 ? "text-amber-600" : ""}>
                                    Freq: {adset.frequency.toFixed(1)}
                                    {adset.frequency > 3.5 && " ⚠️"}
                                  </span>
                                )}
                                {adset.daily_budget !== null && (
                                  <span>Budget: {fmtDec(adset.daily_budget ?? 0)}/dag</span>
                                )}
                                {adset.optimization_goal && (
                                  <span>Mål: {adset.optimization_goal.replace(/_/g, " ")}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {status?.connected && campaigns.length === 0 && (
          <div className="mb-6 rounded-xl border bg-white p-12 text-center shadow-sm">
            <BarChart2 className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-slate-500">
              Inga kampanjer hittades för de senaste {dateRange} dagarna.
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Prova ett längre tidsintervall eller kontrollera att kontot har aktiva kampanjer.
            </p>
          </div>
        )}

        {/* AI Insights */}
        {status?.connected && (
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                AI-analys
              </h2>
              {insights.length === 0 ? (
                <button
                  onClick={loadInsights}
                  disabled={loadingInsights}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300 transition-colors"
                >
                  {loadingInsights ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {loadingInsights ? "Analyserar..." : "Generera insights"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setInsights([]);
                    loadInsights();
                  }}
                  disabled={loadingInsights}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingInsights ? "animate-spin" : ""}`} />
                  Uppdatera
                </button>
              )}
            </div>

            <div className="p-5">
              {insights.length === 0 && !loadingInsights && (
                <div className="text-center py-8">
                  <Sparkles className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">
                    Klicka på &ldquo;Generera insights&rdquo; för att få AI-drivna rekommendationer
                    baserade på din kampanjdata.
                  </p>
                </div>
              )}

              {loadingInsights && (
                <div className="flex items-center gap-3 justify-center py-8 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Analyserar kampanjdata med Claude...</span>
                </div>
              )}

              {insights.length > 0 && (
                <div className="space-y-3">
                  {insights.map((insight, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border-l-4 p-4 ${
                        PRIORITY_STYLE[insight.priority] || "border-l-slate-300 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-slate-900 text-sm">{insight.title}</p>
                        <span
                          className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                            PRIORITY_BADGE[insight.priority] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {insight.priority}
                        </span>
                      </div>
                      {insight.campaign && (
                        <p className="text-xs text-slate-500 mb-1">Kampanj: {insight.campaign}</p>
                      )}
                      <p className="text-xs text-slate-600 mb-2">{insight.observation}</p>
                      <p className="text-xs font-medium text-slate-800">→ {insight.action}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
