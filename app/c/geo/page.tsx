"use client";

import { useState, useEffect } from "react";
import {
  Bot, TrendingUp, TrendingDown, AlertCircle, CheckCircle,
  Play, RefreshCw, Minus, Eye, X,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { tenantApi } from "@/lib/api";

interface Summary {
  mention_rate: number;
  avg_rank: number | null;
  total_checks: number;
  open_gaps: number;
  top_competitors: { name: string; count: number }[];
  trend: "up" | "down" | "flat";
  last_check_at: string | null;
  engine_stats: Record<string, { total: number; mentioned: number; rate: number }>;
}

interface AICheck {
  id: string;
  prompt: string;
  category: string;
  ai_engine: string;
  mentioned: boolean;
  rank: number | null;
  competitors_mentioned: string[];
  checked_at: string;
}

export default function CustomerGeoPage() {
  const { user, loading: userLoading } = useUser();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [checks, setChecks] = useState<AICheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    const client = tenantApi(user.id);
    try {
      const [summaryData, checksData] = await Promise.all([
        client.get("/api/ai-visibility/summary").catch(() => null),
        client.get("/api/ai-visibility/checks?limit=20").catch(() => []),
      ]);
      if (summaryData) setSummary(summaryData);
      if (Array.isArray(checksData)) setChecks(checksData);
      else if (checksData?.checks) setChecks(checksData.checks);
    } catch (err: any) {
      console.error("Failed to load GEO data:", err);
      setError(`Kunde inte ladda data: ${err?.message || err}`);
    }
    setLoading(false);
  };

  const runCheck = async () => {
    if (!user) return;
    setRunning(true);
    try {
      const client = tenantApi(user.id);
      await client.post("/api/ai-visibility/check");
      await loadData();
    } catch (err: any) {
      console.error("Failed to run check:", err);
      setError(`Kunde inte köra check: ${err?.message || err}`);
    }
    setRunning(false);
  };

  const trendIcon = (t?: string) =>
    t === "up" ? <TrendingUp className="h-4 w-4 text-emerald-500" /> :
    t === "down" ? <TrendingDown className="h-4 w-4 text-red-500" /> :
    <Minus className="h-4 w-4 text-zinc-400" />;

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Eye className="h-7 w-7 text-slate-400" />
              AI Visibility / GEO
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Hur synlig är ditt varumärke i AI-assistenter?
            </p>
          </div>
          <button
            onClick={runCheck}
            disabled={running}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Kör..." : "Kör check"}
          </button>
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

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">Omnämningsgrad</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {(summary.mention_rate * 100).toFixed(0)}%
                </span>
                {trendIcon(summary.trend)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">Snittranking</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.avg_rank ? `#${summary.avg_rank.toFixed(1)}` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">Totala checks</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {(summary.total_checks ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">Öppna gaps</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary.open_gaps ?? 0}</p>
            </div>
          </div>
        )}

        {/* Engine breakdown */}
        {summary?.engine_stats && Object.keys(summary.engine_stats).length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Per AI-motor</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(summary.engine_stats).map(([engine, stats]) => (
                <div key={engine} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-700 capitalize">{engine}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {(stats.rate * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-slate-500">
                    {stats.mentioned}/{stats.total} omnämningar
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent checks */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Senaste checks</h2>
          {checks.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <Bot className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">
                Inga checks körda ännu. Klicka &quot;Kör check&quot; för att starta.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Fråga</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Motor</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Omnämnd</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Rank</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Konkurrenter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checks.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{c.prompt}</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{c.ai_engine}</td>
                      <td className="px-4 py-3">
                        {c.mentioned ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.rank ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {c.competitors_mentioned?.join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top competitors */}
        {summary?.top_competitors && summary.top_competitors.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Vanligaste konkurrenter i AI-svar</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {summary.top_competitors.map((c) => (
                <div key={c.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-700">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.count} omnämningar</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
