"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { tenantApi } from "@/lib/api";

interface AutopilotConfig {
  enabled?: boolean;
  cadence?: string;
  ideas_per_run?: number;
  auto_draft_top_n?: number;
  min_score_for_publish?: number;
  auto_publish?: boolean;
}

interface Props {
  tenantId: string;
  userId: string;
}

export default function AutoApproveToggle({ tenantId, userId }: Props) {
  const [autoPublish, setAutoPublish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await tenantApi(tenantId).get<{ settings?: { content_autopilot?: AutopilotConfig } }>(
          `/api/settings/${userId}`,
        );
        if (!cancelled) {
          setAutoPublish(data?.settings?.content_autopilot?.auto_publish ?? false);
        }
      } catch {
        /* use default false */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, userId]);

  const toggle = async () => {
    const newValue = !autoPublish;
    setSaving(true);
    try {
      const existing = await tenantApi(tenantId).get<{ settings?: Record<string, unknown> }>(
        `/api/settings/${userId}`,
      );
      const currentSettings = existing?.settings || {};
      const currentAp = (currentSettings.content_autopilot as AutopilotConfig) || {};
      await tenantApi(tenantId).post(`/api/settings`, {
        user_id: userId,
        settings: {
          ...currentSettings,
          content_autopilot: { ...currentAp, auto_publish: newValue },
        },
      });
      setAutoPublish(newValue);
    } catch {
      /* silent — toggle stays at previous value */
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-900">Autogodkänn artiklar</p>
        <p className="text-xs text-slate-500">
          {autoPublish
            ? "Utkast publiceras automatiskt när de godkänns av AI"
            : "Du godkänner och publicerar varje artikel manuellt"}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        aria-pressed={autoPublish}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          autoPublish ? "bg-purple-600" : "bg-slate-300"
        }`}
      >
        {saving ? (
          <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
        ) : (
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              autoPublish ? "translate-x-6" : "translate-x-1"
            }`}
          />
        )}
      </button>
    </div>
  );
}
