"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSite } from "@/lib/hooks/useSite";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

interface AutopilotConfig {
  enabled?: boolean;
  cadence?: string;
  ideas_per_run?: number;
  auto_draft_top_n?: number;
  min_score_for_publish?: number;
  auto_publish?: boolean;
}

/**
 * Quick toggle for content_autopilot.auto_publish. Reads from the same
 * user_sites.settings location that the cron reads from and the full
 * AutopilotSettings panel writes to — so flipping this toggle actually
 * changes what the next scheduled run does.
 */
export default function AutoApproveToggle() {
  const { activeSite, effectiveOwnerId, viewAs } = useSite();
  const [autoPublish, setAutoPublish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSite) return;
    const ap = ((activeSite.settings || {}).content_autopilot ?? {}) as AutopilotConfig;
    setAutoPublish(ap.auto_publish === true);
    setLoading(false);
  }, [activeSite]);

  const toggle = async () => {
    if (!activeSite || viewAs) return;
    const newValue = !autoPublish;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const currentSettings = (activeSite.settings || {}) as Record<string, unknown>;
      const currentAp = (currentSettings.content_autopilot as AutopilotConfig) || {};
      const next = {
        ...currentSettings,
        content_autopilot: { ...currentAp, auto_publish: newValue },
      };
      const { error: upsertErr } = await supabase
        .from("user_sites")
        .upsert(
          {
            id: activeSite.id,
            user_id: effectiveOwnerId || activeSite.user_id,
            site_name: activeSite.site_name,
            settings: next,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
      if (upsertErr) throw upsertErr;
      setAutoPublish(newValue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara");
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
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button
        onClick={toggle}
        disabled={saving || !!viewAs}
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
