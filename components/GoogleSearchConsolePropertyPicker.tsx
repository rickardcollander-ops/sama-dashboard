"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  CheckCircle, AlertCircle, Loader2, RefreshCw, Info, ChevronDown,
} from "lucide-react";
import { api, tenantApi, ApiError } from "@/lib/api";

interface GscSite {
  url: string;
  permission_level?: string;
}

interface SitesResponse {
  sites?: GscSite[];
  selected_site_url?: string | null;
  connected_account_email?: string | null;
}

interface Props {
  tenantId: string;
  onChange?: (siteUrl: string | null) => void;
}

export default function GoogleSearchConsolePropertyPicker({ tenantId, onChange }: Props) {
  const [sites, setSites] = useState<GscSite[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const client = tenantApi(tenantId);
        const data = await client.get<SitesResponse>(
          `/api/integrations/google/search-console/sites`,
        );
        if (cancelled) return;
        setSites(data.sites || []);
        setSelectedUrl(data.selected_site_url ?? null);
        setConnectedEmail(data.connected_account_email ?? null);
        setUnsupported(false);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setUnsupported(true);
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tenantId, reloadCount]);

  const switchAccount = () => {
    if (typeof window === "undefined") return;
    const returnUrl = `${window.location.origin}/c/settings`;
    window.location.href = `${api.baseUrl}/api/auth/google/connect?service=search_console&tenant_id=${tenantId}&return_url=${encodeURIComponent(returnUrl)}`;
  };

  const refresh = () => setReloadCount((n) => n + 1);

  const select = async (siteUrl: string) => {
    if (siteUrl === selectedUrl) return;
    setSaving(true);
    setError(null);
    try {
      const client = tenantApi(tenantId);
      await client.post(
        `/api/integrations/google/search-console/select-property`,
        { site_url: siteUrl },
        { headers: { "X-Sama-Intent": "user-action" } },
      );
      setSelectedUrl(siteUrl);
      onChange?.(siteUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save selection");
    }
    setSaving(false);
  };

  if (unsupported) {
    return (
      <div className="border-t border-slate-100 px-4 py-3 bg-amber-50/40">
        <div className="flex items-start gap-2 text-xs text-amber-800">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">GSC site selection not yet available</p>
            <p className="opacity-80 mt-0.5">
              The backend doesn&apos;t expose a site picker yet. Ask your admin
              to set <code className="rounded bg-white/60 px-1">gsc_site_url</code> on your tenant.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/30">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-slate-600">
          <span className="font-medium">GSC Property</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          ) : selectedUrl ? (
            <span className="text-slate-900 font-mono">{selectedUrl}</span>
          ) : (
            <span className="text-amber-700">None selected</span>
          )}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Pick which Search Console property the SEO agent should query.
            </p>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              title="Refresh site list"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {connectedEmail && (
            <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600">
              <span className="min-w-0 truncate">
                Connected as <span className="font-mono text-slate-800">{connectedEmail}</span>
              </span>
              <button
                onClick={switchAccount}
                className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50 flex-shrink-0"
                title="Sign in with a different Google account"
              >
                <RefreshCw className="h-3 w-3" />
                Switch account
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-1.5 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span className="break-all">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 px-1 py-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading properties from Google…
            </div>
          ) : sites.length === 0 ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-800 space-y-1.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                <span>
                  {connectedEmail ? (
                    <>The Google account <span className="font-mono">{connectedEmail}</span> has no Search Console properties it can read.</>
                  ) : (
                    <>The connected Google account has no Search Console properties it can read.</>
                  )}{" "}
                  Either sign in with a different Google account, or verify ownership of your site in{" "}
                  <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="underline">Search Console</a>.
                </span>
              </div>
              <button
                onClick={switchAccount}
                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
              >
                <RefreshCw className="h-3 w-3" />
                Byt Google-konto
              </button>
            </div>
          ) : (
            <div className="rounded border border-slate-200 bg-white overflow-hidden">
              {sites.map((s) => {
                const isSelected = s.url === selectedUrl;
                return (
                  <button
                    key={s.url}
                    onClick={() => select(s.url)}
                    disabled={saving}
                    className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-b-0 transition-colors ${
                      isSelected ? "bg-emerald-50/50" : "hover:bg-slate-50"
                    } disabled:opacity-60`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-slate-900 truncate">{s.url}</p>
                      {s.permission_level && (
                        <p className="text-[10px] text-slate-400 capitalize">
                          {s.permission_level.replace(/_/g, " ").toLowerCase()}
                        </p>
                      )}
                    </div>
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                        <CheckCircle className="h-3 w-3" /> Selected
                      </span>
                    ) : saving ? (
                      <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                    ) : (
                      <span className="text-[10px] text-slate-400">Select</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
