"use client";

import { useEffect, useState } from "react";
import { Plane, Save, Clock, ChevronDown, ChevronUp, Info, AlertCircle } from "lucide-react";
import { useSite } from "@/lib/hooks/useSite";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

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

/**
 * Autopilot settings panel mounted at the top of /c/content.
 *
 * Reads from and writes to ``user_sites.settings.content_autopilot`` via
 * Supabase directly — the same path the daily and weekly crons read. There
 * is no /api/settings indirection: a panel writing to one storage and a
 * cron reading from another was the previous bug, and keeping both ends
 * pinned to user_sites is what guarantees the toggle actually controls
 * what the agent does.
 *
 * The panel binds to the user's active site (useSite). In admin view-as
 * mode the panel renders read-only — admin edits go through the existing
 * /api/admin/user-sites flow on /c/settings, not here.
 */
export default function AutopilotSettings() {
  const { activeSite, effectiveOwnerId, viewAs, loading: siteLoading, reloadSites } = useSite();

  const [cfg, setCfg] = useState<AutopilotConfig>(DEFAULT);
  const [saved, setSaved] = useState<AutopilotConfig>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSite) return;
    const ap = (activeSite.settings || {}).content_autopilot;
    if (ap && typeof ap === "object") {
      const merged = { ...DEFAULT, ...(ap as Partial<AutopilotConfig>) };
      setCfg(merged);
      setSaved(merged);
    } else {
      setCfg(DEFAULT);
      setSaved(DEFAULT);
    }
  }, [activeSite]);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const readOnly = !!viewAs;

  const handleSave = async () => {
    if (!activeSite || readOnly) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const supabase = getSupabaseBrowser();
      const currentSettings = (activeSite.settings || {}) as Record<string, unknown>;
      const next = { ...currentSettings, content_autopilot: cfg };
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
      setSaved(cfg);
      setOkMsg("Inställningar sparade");
      setTimeout(() => setOkMsg(null), 2500);
      // Re-fetch sites so other components reading activeSite.settings see
      // the new autopilot config without a page reload.
      void reloadSites();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  if (siteLoading || !activeSite) {
    return (
      <div className="mb-4 rounded-lg border bg-white shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3 text-sm text-slate-400">
          <Plane className="h-4 w-4" /> Laddar autopilot...
        </div>
      </div>
    );
  }

  const modeLabel =
    !cfg.enabled ? "Av" :
    cfg.auto_publish ? "På — auto-publicering" : "På — utkast till godkännandekö";

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
            <h3 className="text-sm font-semibold text-slate-900">Autopilot</h3>
            <p className="text-xs text-slate-500">
              {modeLabel}
              {cfg.enabled && ` · ${cfg.cadence === "biweekly" ? "varannan vecka" : "varje vecka"} · ${cfg.auto_draft_top_n} utkast/körning`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            cfg.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
          }`}>
            {cfg.enabled ? "Aktiv" : "Inaktiv"}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-5 py-4">
          {readOnly && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Du visar en annan användares konto. Ändringar gjorda här sparas inte —
                använd <code className="font-mono">/c/settings</code> för admin-redigering.
              </span>
            </div>
          )}

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Autopilot körs <span className="font-medium">{cfg.cadence === "biweekly" ? "varannan vecka" : "varje vecka"}</span>: analyserar innehåll,
              fyller planen med nya idéer, skapar utkast för topp {cfg.auto_draft_top_n}, och {cfg.auto_publish ? "publicerar de som får score ≥ " + cfg.min_score_for_publish : "lägger dem i godkännandekön"}.
              När den är på fyller daily-cronen även luckor i kalendern med ett nytt idé per dag.
            </span>
          </div>

          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Aktivera autopilot</span>
            <button
              disabled={readOnly}
              onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${cfg.enabled ? "bg-blue-600" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cfg.enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </label>

          <fieldset disabled={!cfg.enabled || readOnly} className="space-y-4 disabled:opacity-50">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Frekvens</span>
                <select
                  value={cfg.cadence}
                  onChange={e => setCfg({ ...cfg, cadence: e.target.value as AutopilotConfig["cadence"] })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  <option value="weekly">Varje vecka</option>
                  <option value="biweekly">Varannan vecka</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Idéer per körning</span>
                <input
                  type="number" min={1} max={12}
                  value={cfg.ideas_per_run}
                  onChange={e => setCfg({ ...cfg, ideas_per_run: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Auto-utkast topp N</span>
                <input
                  type="number" min={0} max={6}
                  value={cfg.auto_draft_top_n}
                  onChange={e => setCfg({ ...cfg, auto_draft_top_n: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Min score för publicering</span>
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
                <p className="font-medium text-slate-700">Auto-publicera utkast som klarar score-tröskeln</p>
                <p className="text-xs text-slate-500">
                  När av (rekommenderat) hamnar auto-utkasten i godkännandekön så du klickar Godkänn & Publicera per artikel.
                </p>
              </div>
            </label>
          </fieldset>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {okMsg && <p className="text-xs text-green-700">{okMsg}</p>}

          <div className="flex items-center justify-end gap-2">
            {!dirty && !okMsg && <span className="text-xs text-slate-400">Sparat</span>}
            <button
              onClick={handleSave}
              disabled={saving || !dirty || readOnly}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {saving ? <Clock className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Sparar..." : "Spara inställningar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
