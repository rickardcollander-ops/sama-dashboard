"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle, AlertCircle, Loader2, RefreshCw, ExternalLink, Search,
  Download, Clock, AlertTriangle, X,
} from "lucide-react";
import Link from "next/link";
import { api, tenantApi, pollAgentRun, ApiError } from "@/lib/api";

type Service = "search_console" | "analytics" | "ads";

interface AgentRun {
  id: string;
  agent_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  summary: string | null;
  error?: string | null;
}

interface ImportDiagnostics {
  sync_response_keys?: string[];
  backend_keywords_count?: number;
  gsc_query_probes?: { path: string; status: number | string; count: number; sample?: string }[];
}

interface Props {
  /** Which Google service to diagnose. */
  service: Service;
  /** Tenant / user id (Supabase auth user id). */
  tenantId: string;
  /** Backend agent name to trigger for a manual sync. */
  agentName: "seo" | "analytics" | "ads";
  /** Number of items currently tracked (keywords / metrics / campaigns). */
  trackedCount: number;
  /** Optional callback when agent run completes — parent should refresh. */
  onSynced?: () => void;
  /** Optional GSC import path (only used for service=search_console). */
  showImportFromGsc?: boolean;
}

const SERVICE_META: Record<Service, { label: string; settingsAnchor: string }> = {
  search_console: { label: "Google Search Console", settingsAnchor: "/c/settings" },
  analytics: { label: "Google Analytics", settingsAnchor: "/c/settings" },
  ads: { label: "Google Ads", settingsAnchor: "/c/settings" },
};

export default function GoogleDataDiagnostics(props: Props) {
  const { service, tenantId, agentName, trackedCount, onSynced, showImportFromGsc } = props;
  const meta = SERVICE_META[service];

  const [connected, setConnected] = useState<boolean | null>(null);
  const [recentRuns, setRecentRuns] = useState<AgentRun[]>([]);
  const [lastSuccessful, setLastSuccessful] = useState<AgentRun | null>(null);
  const [lastFailed, setLastFailed] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // GA4-specific: which property the agent will query.
  // null = endpoint exists but no property selected.
  // undefined = endpoint not yet implemented on backend (treat as unknown).
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const calls: Promise<unknown>[] = [
        api.get<Record<string, { connected?: boolean }>>(`/api/auth/google/status?tenant_id=${tenantId}`),
        tenantApi(tenantId).get<{ runs?: AgentRun[] }>(`/api/tenant/agent-runs?limit=20`),
      ];
      if (service === "analytics") {
        calls.push(
          tenantApi(tenantId).get<{ selected_property_id?: string | null }>(
            `/api/integrations/google/analytics/properties`,
          ),
        );
      }
      const results = await Promise.allSettled(calls);
      const statusRes = results[0];
      const runsRes = results[1];
      const propertyRes = results[2];

      if (statusRes.status === "fulfilled") {
        const data = statusRes.value as Record<string, { connected?: boolean }>;
        setConnected(!!data?.[service]?.connected);
      } else {
        setConnected(null);
      }
      if (runsRes.status === "fulfilled") {
        const data = runsRes.value as { runs?: AgentRun[] };
        const runs = (data?.runs || []).filter((r) => r.agent_name === agentName);
        setRecentRuns(runs);
        setLastSuccessful(runs.find((r) => r.status === "completed") || null);
        setLastFailed(runs.find((r) => r.status === "failed") || null);
      }
      if (propertyRes) {
        if (propertyRes.status === "fulfilled") {
          const data = propertyRes.value as { selected_property_id?: string | null };
          setSelectedPropertyId(data?.selected_property_id ?? null);
        } else if (propertyRes.reason instanceof ApiError && propertyRes.reason.status === 404) {
          setSelectedPropertyId(undefined);
        } else {
          setSelectedPropertyId(undefined);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, service, agentName]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setError(null);
    setFeedback(null);
    try {
      const client = tenantApi(tenantId);
      const resp = await client.post<{ run_id?: string; status?: string }>(
        `/api/tenant/agents/${agentName}/trigger`,
        undefined,
        { headers: { "X-Sama-Intent": "user-action" } },
      );
      if (resp?.run_id && resp?.status === "running") {
        setFeedback("Sync started — running in background…");
        pollAgentRun(tenantId, resp.run_id)
          .then(async (run) => {
            await refresh();
            if (run.status === "completed") {
              setFeedback(run.summary || "Sync completed");
              onSynced?.();
            } else if (run.status === "failed") {
              setError(run.error || run.summary || "Sync failed");
            }
          })
          .catch(() => {
            setError("Sync polling failed");
          });
      } else {
        await refresh();
        setFeedback("Sync triggered");
        onSynced?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not trigger sync");
    }
    setSyncing(false);
  };

  const handleImportFromGsc = async () => {
    setImporting(true);
    setError(null);
    setFeedback(null);
    setDiagnostics(null);
    try {
      const res = await fetch(`/api/integrations/gsc/import?tenant_id=${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No limit → the route asks the backend to import every GSC query
        // the property has ranked for, not just the top 25.
        body: JSON.stringify({ limit: "all" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      if (data.triggered_agent && data.run_id) {
        setFeedback("No direct import endpoint — triggered SEO agent. Fetching GSC data in background…");
        await refresh();
        try {
          const run = await pollAgentRun(tenantId, data.run_id);
          if (run.status === "completed") {
            setFeedback(run.summary || "GSC import completed");
            await refresh();
            onSynced?.();
          } else if (run.status === "failed") {
            setError(run.error || run.summary || "GSC import failed");
          } else {
            setError("Import is still running — refresh in a few minutes to see results.");
          }
        } catch {
          setError("Import polling failed — refresh manually to see results.");
        }
      } else {
        const inserted = data.imported;
        const updated = data.updated;
        const totalTracked = data.total_tracked;
        const parts: string[] = [];
        if (inserted != null) parts.push(`${inserted} new`);
        if (updated != null) parts.push(`${updated} updated`);
        let message: string;
        if (parts.length > 0) {
          message = `GSC sync: ${parts.join(", ")} keyword${inserted === 1 && updated == null ? "" : "s"}`;
          if (data.total_gsc != null) message += ` (${data.total_gsc} total in GSC)`;
          if (totalTracked != null) message += `. ${totalTracked} now tracked.`;
          else message += ".";
        } else if (totalTracked != null) {
          message = `${totalTracked} keyword${totalTracked === 1 ? "" : "s"} now tracked.`;
        } else {
          message = "Import completed.";
        }
        setFeedback(message);
        if (data.diagnostics) setDiagnostics(data.diagnostics as ImportDiagnostics);
        await refresh();
        onSynced?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
    setImporting(false);
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleString();
  };

  // Build a clear narrative diagnosis
  const diagnosis = (() => {
    if (loading) return null;
    if (connected === false) {
      return {
        tone: "amber" as const,
        title: `${meta.label} is not connected`,
        body: "Connect it in Settings to start syncing data.",
        cta: { label: "Open Settings", href: meta.settingsAnchor, external: false },
      };
    }
    if (lastFailed && (!lastSuccessful || Date.parse(lastFailed.started_at) > Date.parse(lastSuccessful.started_at))) {
      const errMsg = lastFailed.error || lastFailed.summary || "";
      const isAuth = /401|403|invalid_grant|unauthor|permission|consent|scope|re-?auth/i.test(errMsg);
      return {
        tone: "red" as const,
        title: isAuth ? `${meta.label} access expired or revoked` : "Last sync failed",
        body: errMsg || "The agent ran but did not complete successfully.",
        cta: isAuth
          ? { label: "Reconnect in Settings", href: meta.settingsAnchor, external: false }
          : null,
      };
    }
    if (!lastSuccessful) {
      const isSeo = service === "search_console";
      return {
        tone: "blue" as const,
        title: "Connected — but no sync has run yet",
        body: isSeo && trackedCount === 0
          ? "GSC won't return data until you have keywords tracked. Click \"Import all GSC keywords\" below to pull everything you already rank for, or add keywords manually, then trigger a sync."
          : "Click \"Sync now\" below to fetch your first batch of data from Google.",
        cta: null,
      };
    }
    if (trackedCount === 0) {
      if (service === "search_console") {
        return {
          tone: "amber" as const,
          title: "Connected and synced — but no keywords tracked",
          body: "GSC API only returns data for keywords you ask about. Either import top GSC queries automatically or add keywords manually above.",
          cta: null,
        };
      }
      const lastSummary = lastSuccessful.summary || "";
      const looksEmpty = /\b0\b|no\s+(data|metrics|channels|campaigns)/i.test(lastSummary);
      const itemLabel = service === "analytics" ? "channels" : "campaigns";
      // For analytics, the most actionable diagnosis is "no GA4 property selected".
      if (service === "analytics" && selectedPropertyId === null) {
        return {
          tone: "amber" as const,
          title: "Connected and synced — but no GA4 property is selected",
          body: (looksEmpty && lastSummary ? `Agent reported: "${lastSummary}". ` : "") +
            "The analytics agent doesn't know which GA4 property to query. Open Settings and pick the property the agent should use.",
          cta: { label: "Open Settings", href: meta.settingsAnchor, external: false },
        };
      }
      const propertyHint =
        service === "analytics" && selectedPropertyId
          ? `Agent is querying GA4 property ${selectedPropertyId}. `
          : "";
      return {
        tone: "amber" as const,
        title: `Connected and synced — but the agent returned no ${itemLabel}`,
        body:
          (looksEmpty && lastSummary ? `Agent reported: "${lastSummary}". ` : "") +
          propertyHint +
          (service === "analytics"
            ? "Verify the connected Google account has access to this property and that it has traffic for the selected period."
            : "Open Settings to verify a Google Ads account is selected and that the connected Google account has access to it."),
        cta: { label: "Open Settings", href: meta.settingsAnchor, external: false },
      };
    }
    return {
      tone: "emerald" as const,
      title: `${meta.label} is syncing normally`,
      body: `Last successful sync: ${formatTime(lastSuccessful.completed_at || lastSuccessful.started_at)}.`,
      cta: null,
    };
  })();

  const toneStyles: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    red: "border-red-200 bg-red-50 text-red-900",
  };
  const toneIcon: Record<string, React.ReactNode> = {
    emerald: <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />,
    amber: <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />,
    blue: <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />,
    red: <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />,
  };

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            {meta.label} — sync status
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Why isn&apos;t your Google data showing up? Check the diagnosis below and trigger a sync.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            <DiagItem
              label="Connection"
              value={connected === null ? "Unknown" : connected ? "Connected" : "Not connected"}
              ok={connected === true}
              warning={connected === false}
            />
            <DiagItem
              label="Last successful sync"
              value={lastSuccessful ? formatTime(lastSuccessful.completed_at || lastSuccessful.started_at) : "Never"}
              ok={!!lastSuccessful}
              warning={!lastSuccessful}
            />
            <DiagItem
              label={service === "search_console" ? "Tracked keywords" : "Tracked items"}
              value={trackedCount.toLocaleString()}
              ok={trackedCount > 0}
              warning={trackedCount === 0}
            />
          </div>

          {service === "analytics" && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                GA4 property the agent will query
              </p>
              <p className={`text-sm font-mono mt-0.5 ${
                selectedPropertyId ? "text-slate-800" :
                selectedPropertyId === null ? "text-amber-700" :
                "text-slate-400"
              }`}>
                {selectedPropertyId
                  ? selectedPropertyId
                  : selectedPropertyId === null
                    ? "None selected — pick one in Settings"
                    : "Unknown — backend has no property endpoint"}
              </p>
            </div>
          )}

          {diagnosis && (
            <div className={`rounded-lg border p-3 mb-4 ${toneStyles[diagnosis.tone]}`}>
              <div className="flex items-start gap-2">
                {toneIcon[diagnosis.tone]}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{diagnosis.title}</p>
                  <p className="text-xs mt-1 opacity-90 leading-relaxed">{diagnosis.body}</p>
                  {diagnosis.cta && (
                    <Link
                      href={diagnosis.cta.href}
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium underline hover:opacity-80"
                    >
                      {diagnosis.cta.label}
                      {diagnosis.cta.external && <ExternalLink className="h-3 w-3" />}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {feedback && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
              <CheckCircle className="h-3.5 w-3.5" /> {feedback}
              <button onClick={() => setFeedback(null)} className="ml-auto"><X className="h-3 w-3" /></button>
            </div>
          )}
          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
              <button onClick={() => setError(null)} className="ml-auto"><X className="h-3 w-3" /></button>
            </div>
          )}
          {diagnostics && (
            <details className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
              <summary className="cursor-pointer font-medium select-none">
                Import diagnostics — backend probe results
              </summary>
              <div className="mt-2 space-y-1 font-mono">
                {diagnostics.sync_response_keys && (
                  <div>
                    <span className="text-slate-500">sync response keys: </span>
                    {diagnostics.sync_response_keys.join(", ") || "(none)"}
                  </div>
                )}
                {typeof diagnostics.backend_keywords_count === "number" && (
                  <div>
                    <span className="text-slate-500">/api/seo/keywords returned: </span>
                    {diagnostics.backend_keywords_count} keyword
                    {diagnostics.backend_keywords_count === 1 ? "" : "s"}
                  </div>
                )}
                {diagnostics.gsc_query_probes && (
                  <div className="pt-1">
                    <div className="text-slate-500 mb-0.5">GSC-query endpoint probes:</div>
                    {diagnostics.gsc_query_probes.map((p) => (
                      <div key={p.path} className="pl-2">
                        {p.status === 200 ? "✓" : "✗"} {p.path} — {p.status} ({p.count})
                        {p.sample ? ` "${p.sample}"` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSyncNow}
              disabled={syncing || connected === false}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            {showImportFromGsc && service === "search_console" && (
              <button
                onClick={handleImportFromGsc}
                disabled={importing || connected === false}
                className="flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Import all GSC keywords
              </button>
            )}
            <Link
              href={meta.settingsAnchor}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Settings
            </Link>
          </div>

          {recentRuns.length > 0 && (
            <details className="mt-4 group">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 select-none">
                Recent {agentName} agent runs ({recentRuns.length})
              </summary>
              <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="text-left px-3 py-1.5 font-medium">When</th>
                      <th className="text-left px-3 py-1.5 font-medium">Status</th>
                      <th className="text-left px-3 py-1.5 font-medium">Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRuns.slice(0, 5).map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{formatTime(r.started_at)}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            r.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                            r.status === "failed" ? "bg-red-50 text-red-700" :
                            "bg-amber-50 text-amber-700"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-600 truncate max-w-[420px]" title={r.summary || r.error || ""}>
                          {r.error ? <span className="text-red-600">{r.error}</span> : r.summary || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function DiagItem({ label, value, ok, warning }: { label: string; value: string; ok?: boolean; warning?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${
      ok ? "border-emerald-100 bg-emerald-50/40" :
      warning ? "border-amber-100 bg-amber-50/40" :
      "border-slate-100 bg-slate-50/40"
    }`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${
        ok ? "text-emerald-700" : warning ? "text-amber-700" : "text-slate-700"
      }`}>{value}</p>
    </div>
  );
}
