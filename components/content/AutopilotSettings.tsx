"use client";

import { useEffect, useState } from "react";
import { Plane, Save, Clock, ChevronDown, ChevronUp, Info, AlertCircle } from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";

interface AutopilotConfig {
  enabled: boolean;
  cadence: "weekly" | "biweekly" | "off";
  ideas_per_run: number;
  auto_draft_top_n: number;
  min_score_for_publish: number;
  auto_publish: boolean;
}

const DEFAULT: AutopilotConfig = {
  enabled: false,
  cadence: "weekly",
  ideas_per_run: 6,
  auto_draft_top_n: 3,
  min_score_for_publish: 70,
  auto_publish: false,
};

interface Props {
  apiUrl: string;
}

/**
 * Persistent autopilot settings panel mounted at the top of /content.
 *
 * Loads/saves ``user_settings.settings.content_autopilot`` via the existing
 * /api/settings endpoints. The agent's scheduler picks this up weekly to
 * run analyze → generate ideas → draft top-N → queue for approval (or
 * auto-publish if explicitly enabled).
 *
 * Always renders, even when the dashboard isn't authenticated against
 * Supabase — falls back to user_id='default' so the admin/dev shell can
 * still configure the home brand's autopilot. When auth is configured,
 * we use the logged-in user's id.
 */
export default function AutopilotSettings({ apiUrl }: Props) {
  const { user, loading: userLoading, isSupabaseConfigured } = useUser();
  const userId = user?.id || "default";
  const isAnonymous = !user;

  const [cfg, setCfg] = useState<AutopilotConfig>(DEFAULT);
  const [saved, setSaved] = useState<AutopilotConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Wait for the auth check to settle before fetching, but always render.
  useEffect(() => {
    if (userLoading) return;
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/api/settings/${userId}`);
        if (res.ok) {
          const data = await res.json();
          const ap = (data.settings || {}).content_autopilot;
          if (ap && typeof ap === "object") {
            const merged = { ...DEFAULT, ...ap };
            setCfg(merged);
            setSaved(merged);
          }
        }
      } catch {
        /* defaults are fine */
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, userLoading, apiUrl]);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      // Read-modify-write so we don't clobber the rest of the user_settings.
      const get = await fetch(`${apiUrl}/api/settings/${userId}`);
      const existing = get.ok ? (await get.json()).settings || {} : {};
      const merged = { ...existing, content_autopilot: cfg };
      const res = await fetch(`${apiUrl}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, settings: merged }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");
      setSaved(cfg);
      setOkMsg("Settings saved");
      setTimeout(() => setOkMsg(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // While the auth check is in flight, render a placeholder so the slot
  // doesn't shift later. Avoid blank-rendering the panel.
  if (userLoading || loading) {
    return (
      <div className="mb-4 rounded-lg border bg-white shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3 text-sm text-slate-400">
          <Plane className="h-4 w-4" /> Loading auto-pilot settings...
        </div>
      </div>
    );
  }

  const modeLabel =
    !cfg.enabled ? "Off" :
    cfg.auto_publish ? "On — auto-publish" : "On — drafts to approval queue";

  return (
    <div className="mb-4 rounded-lg border bg-white shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${cfg.enabled ? "bg-blue-100" : "bg-slate-100"}`}>
            <Plane className={`h-4 w-4 ${cfg.enabled ? "text-blue-600" : "text-slate-500"}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Auto-pilot</h3>
            <p className="text-xs text-slate-500">
              {modeLabel}
              {cfg.enabled && ` · ${cfg.cadence} · ${cfg.auto_draft_top_n} drafts/run`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            cfg.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
          }`}>
            {cfg.enabled ? "Active" : "Inactive"}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-5 py-4">
          {isAnonymous && isSupabaseConfigured && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Not signed in — settings will save under <code className="font-mono">default</code>.
                Sign in via /c/login to scope auto-pilot to your tenant.
              </span>
            </div>
          )}

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Auto-pilot runs <span className="font-medium">{cfg.cadence}</span>: analyses content, fills the plan with new ideas,
              drafts the top {cfg.auto_draft_top_n}, and {cfg.auto_publish ? "publishes drafts that score ≥ " + cfg.min_score_for_publish : "queues them for your approval"}.
              You can also schedule specific articles in the Calendar — those run on the day you pick.
            </span>
          </div>

          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Enable auto-pilot</span>
            <button
              onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cfg.enabled ? "bg-blue-600" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cfg.enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </label>

          <fieldset disabled={!cfg.enabled} className="space-y-4 disabled:opacity-50">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Cadence</span>
                <select
                  value={cfg.cadence}
                  onChange={e => setCfg({ ...cfg, cadence: e.target.value as AutopilotConfig["cadence"] })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Ideas per run</span>
                <input
                  type="number" min={1} max={12}
                  value={cfg.ideas_per_run}
                  onChange={e => setCfg({ ...cfg, ideas_per_run: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Auto-draft top N</span>
                <input
                  type="number" min={0} max={6}
                  value={cfg.auto_draft_top_n}
                  onChange={e => setCfg({ ...cfg, auto_draft_top_n: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Min score to publish</span>
                <input
                  type="number" min={0} max={100}
                  value={cfg.min_score_for_publish}
                  onChange={e => setCfg({ ...cfg, min_score_for_publish: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
            </div>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={cfg.auto_publish}
                onChange={e => setCfg({ ...cfg, auto_publish: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <div className="text-sm">
                <p className="font-medium text-slate-700">Auto-publish drafts that pass the score threshold</p>
                <p className="text-xs text-slate-500">
                  When off (recommended), auto-drafted articles land in the approval queue and you click Approve & Publish per article.
                </p>
              </div>
            </label>
          </fieldset>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {okMsg && <p className="text-xs text-green-700">{okMsg}</p>}

          <div className="flex items-center justify-end gap-2">
            {!dirty && !okMsg && <span className="text-xs text-slate-400">Saved</span>}
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {saving ? <Clock className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
