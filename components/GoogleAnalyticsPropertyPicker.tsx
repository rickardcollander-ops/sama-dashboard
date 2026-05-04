"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  CheckCircle, AlertCircle, Loader2, RefreshCw, Info, ChevronDown,
} from "lucide-react";
import { tenantApi, ApiError } from "@/lib/api";

interface GA4Property {
  id: string;
  display_name: string;
  account_id?: string;
  account_name?: string;
  time_zone?: string;
  currency_code?: string;
}

interface PropertiesResponse {
  properties?: GA4Property[];
  selected_property_id?: string | null;
}

interface Props {
  tenantId: string;
  onChange?: (propertyId: string | null) => void;
}

export default function GoogleAnalyticsPropertyPicker({ tenantId, onChange }: Props) {
  const [properties, setProperties] = useState<GA4Property[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      try {
        const client = tenantApi(tenantId);
        const data = await client.get<PropertiesResponse>(
          `/api/integrations/google/analytics/properties`,
        );
        if (cancelled) return;
        setProperties(data.properties || []);
        setSelectedId(data.selected_property_id ?? null);
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
    setLoading(true);
    load();
    return () => { cancelled = true; };
  }, [tenantId, reloadCount]);

  const refresh = () => setReloadCount((n) => n + 1);

  const select = async (propertyId: string) => {
    if (propertyId === selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const client = tenantApi(tenantId);
      await client.post(
        `/api/integrations/google/analytics/select-property`,
        { property_id: propertyId },
        { headers: { "X-Sama-Intent": "user-action" } },
      );
      setSelectedId(propertyId);
      onChange?.(propertyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save selection");
    }
    setSaving(false);
  };

  const selectedProperty = properties.find((p) => p.id === selectedId);

  if (unsupported) {
    return (
      <div className="border-t border-slate-100 px-4 py-3 bg-amber-50/40">
        <div className="flex items-start gap-2 text-xs text-amber-800">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">GA4 property selection not yet available</p>
            <p className="opacity-80 mt-0.5">
              The backend doesn&apos;t expose a property picker yet. The analytics
              agent will use whatever property the backend has configured for your
              tenant — which may be why no channels are returned. Ask your admin
              to set <code className="rounded bg-white/60 px-1">ga4_property_id</code> on your tenant.
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
          <span className="font-medium">GA4 Property</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          ) : selectedProperty ? (
            <span className="text-slate-900">
              {selectedProperty.display_name}
              <span className="ml-1.5 text-slate-400">({selectedProperty.id})</span>
            </span>
          ) : selectedId ? (
            <span className="text-slate-900 font-mono">{selectedId}</span>
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
              Pick which Google Analytics 4 property the analytics agent should query.
            </p>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              title="Refresh property list"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

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
          ) : properties.length === 0 ? (
            <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>
                The connected Google account has no GA4 properties it can read.
                Sign in to <a href="https://analytics.google.com" target="_blank" rel="noreferrer" className="underline">analytics.google.com</a>{" "}
                and verify the account has a GA4 property (Universal Analytics is not supported).
              </span>
            </div>
          ) : (
            <div className="rounded border border-slate-200 bg-white overflow-hidden">
              {properties.map((p) => {
                const isSelected = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    onClick={() => select(p.id)}
                    disabled={saving}
                    className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-b-0 transition-colors ${
                      isSelected ? "bg-emerald-50/50" : "hover:bg-slate-50"
                    } disabled:opacity-60`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 truncate">
                        {p.display_name}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400 truncate">
                        {p.id}
                        {p.account_name ? ` · ${p.account_name}` : ""}
                      </p>
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
