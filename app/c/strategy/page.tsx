"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Calendar, CheckCircle, ChevronRight,
  Compass, History, Loader2, RefreshCw, Sparkles, Target, TrendingUp,
} from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";
import { ApiError, tenantApi } from "@/lib/api";
import { useActiveRuns } from "@/lib/hooks/useActiveRuns";
import CustomerNav from "@/components/CustomerNav";
import RoadmapTimeline from "@/components/strategy/RoadmapTimeline";
import EditableSection from "@/components/strategy/EditableSection";
import StrategyEvaluation from "@/components/strategy/StrategyEvaluation";

type Verdict = "critical" | "weak" | "improving" | "strong" | string;
type Horizon = "monthly" | "quarterly" | "annual";

interface DomainStrategy {
  domain: string;
  diagnosis?: string;
  goal?: string;
  key_actions?: string[];
}

interface CrossChannelPriority {
  title: string;
  description?: string;
  domains?: string[];
}

interface RoadmapMilestone {
  horizon: "30d" | "60d" | "90d" | string;
  title?: string;
  description?: string;
  items?: string[];
}

interface Strategy {
  id?: string;
  generated_at?: string;
  horizon?: Horizon;
  headline?: string;
  verdict?: Verdict;
  executive_summary?: string;
  domain_strategies?: DomainStrategy[];
  cross_channel_priorities?: CrossChannelPriority[];
  roadmap?: RoadmapMilestone[];
  risks?: string[];
  north_star_metric?: string | { name?: string; target?: string; current?: string };
}

function verdictStyle(verdict?: Verdict): { label: string; bg: string; text: string; ring: string } {
  switch (verdict) {
    case "strong":
      return { label: "Stark", bg: "bg-green-50", text: "text-green-700", ring: "ring-green-200" };
    case "improving":
      return { label: "Förbättras", bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" };
    case "weak":
      return { label: "Svag", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" };
    case "critical":
      return { label: "Kritisk", bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" };
    default:
      return { label: verdict || "Okänd", bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200" };
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function strategyAgeDays(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function northStarText(ns: Strategy["north_star_metric"]): string {
  if (!ns) return "";
  if (typeof ns === "string") return ns;
  const parts: string[] = [];
  if (ns.name) parts.push(ns.name);
  if (ns.target) parts.push(`mål: ${ns.target}`);
  if (ns.current) parts.push(`nu: ${ns.current}`);
  return parts.join(" · ");
}

export default function StrategyPage() {
  const { user } = useUser();
  const { runs, triggerRun } = useActiveRuns();
  const [current, setCurrent] = useState<Strategy | null>(null);
  const [history, setHistory] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState<Horizon>("monthly");
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [emptyState, setEmptyState] = useState(false);
  const verdict = useMemo(() => verdictStyle(current?.verdict), [current?.verdict]);

  const activeStrategyRun = runs.find(
    (r) => r.agent === "strategy" && (r.status === "pending" || r.status === "running"),
  );
  const generating = !!activeStrategyRun;
  const lastCompletedStrategyRunId = runs
    .filter((r) => r.agent === "strategy" && r.status === "completed")
    .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))[0]?.id;
  const lastFailedStrategyRun = runs
    .filter((r) => r.agent === "strategy" && r.status === "failed")
    .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))[0];

  const loadCurrent = async () => {
    if (!user) return;
    setError("");
    try {
      const data = await tenantApi(user.id).get<Strategy | { strategy?: Strategy }>(
        "/api/strategy/current",
      );
      const s = (data as { strategy?: Strategy })?.strategy ?? (data as Strategy);
      if (s && (s.headline || s.executive_summary || s.id)) {
        setCurrent(s);
        setEmptyState(false);
      } else {
        setCurrent(null);
        setEmptyState(true);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setCurrent(null);
        setEmptyState(true);
      } else {
        setError("Kunde inte hämta strategin.");
      }
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    try {
      const data = await tenantApi(user.id).get<{ strategies?: Strategy[] } | Strategy[]>(
        "/api/strategy/history",
      );
      const list = Array.isArray(data) ? data : data?.strategies ?? [];
      setHistory(list);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadCurrent(), loadHistory()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const saveStrategyPatch = async (patch: Partial<Strategy>) => {
    if (!user) return;
    const data = await tenantApi(user.id).patch<{ strategy?: Strategy }>(
      "/api/strategy/current",
      patch,
    );
    if (data?.strategy) {
      setCurrent(data.strategy);
    } else {
      // Optimistic — merge locally if backend didn't return the strategy
      setCurrent((prev) => (prev ? { ...prev, ...patch } : prev));
    }
  };

  const handleGenerate = async () => {
    if (!user) return;
    setError("");
    await triggerRun("strategy", "/api/strategy/generate", {
      label: "Strategi-syntes",
      body: { horizon },
    });
  };

  // Reload when a strategy run finishes — handles runs started in another
  // tab too, since the banner is shared via localStorage.
  useEffect(() => {
    if (!lastCompletedStrategyRunId) return;
    void loadCurrent();
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCompletedStrategyRunId]);

  useEffect(() => {
    if (!lastFailedStrategyRun) return;
    setError(lastFailedStrategyRun.error || "Kunde inte generera en ny strategi.");
  }, [lastFailedStrategyRun]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2">
              <Compass className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Strategi</h1>
              <p className="text-sm text-slate-500">
                Vägval och plan — sammanfattat varje vecka från alla aktiva agenter, med diagnos, prioriteringar och 30/60/90-dagars-plan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as Horizon)}
              disabled={generating}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="monthly">Månads-horisont</option>
              <option value="quarterly">Kvartal-horisont</option>
              <option value="annual">År-horisont</option>
            </select>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? "Genererar…" : "Generera nu"}
            </button>
          </div>
        </div>

        {generating && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
            Genererar en ny strategi. Du kan lämna sidan — bevakningen visas i widgeten nere till höger.
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className="mt-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : current ? (
          <div className="mt-6 space-y-6">
            {/* Verdict + headline */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${verdict.bg} ${verdict.text} ${verdict.ring}`}>
                  {current.verdict === "strong" && <CheckCircle className="h-3 w-3" />}
                  {current.verdict === "critical" && <AlertTriangle className="h-3 w-3" />}
                  {verdict.label}
                </span>
                {current.horizon && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    <Calendar className="h-3 w-3" />
                    {current.horizon}
                  </span>
                )}
                {current.generated_at && (
                  <span className="text-xs text-slate-400">Skapad {formatDate(current.generated_at)}</span>
                )}
              </div>

              {/* S2 stub — staleness indicator + Refine CTA */}
              {(() => {
                const days = strategyAgeDays(current.generated_at);
                if (days === null) return null;
                if (days > 30) {
                  return (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>
                        Strategin är <strong>{days} dagar gammal</strong> — utfallet kan ha hunnit ändras.
                      </span>
                      <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Förfina med AI
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="mt-3 text-xs text-slate-400">
                    Senast uppdaterad för {days === 0 ? "mindre än ett dygn" : days === 1 ? "1 dag" : `${days} dagar`} sen.
                  </div>
                );
              })()}

              <div className="mt-3">
                <EditableSection
                  value={current.headline ?? ""}
                  onSave={(next) => saveStrategyPatch({ headline: next })}
                  placeholder="Lägg till en huvudrubrik för strategin"
                  textClassName="text-xl font-bold text-slate-900"
                  label="Redigera huvudrubrik"
                />
              </div>

              <div className="mt-3">
                <EditableSection
                  value={current.executive_summary ?? ""}
                  onSave={(next) => saveStrategyPatch({ executive_summary: next })}
                  variant="textarea"
                  placeholder="Skriv en kort sammanfattning av strategin (3–5 meningar)."
                  textClassName="text-sm leading-relaxed text-slate-700"
                  label="Redigera sammanfattning"
                />
              </div>

              {northStarText(current.north_star_metric) && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
                  <Target className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">Huvudmål:</span>
                  <span>{northStarText(current.north_star_metric)}</span>
                </div>
              )}
            </section>

            {/* Domain strategies */}
            {current.domain_strategies && current.domain_strategies.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Plan per kanal
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {current.domain_strategies.map((d, idx) => (
                    <div key={`${d.domain}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {d.domain}
                      </div>
                      {d.diagnosis && (
                        <p className="mt-2 text-sm text-slate-700">
                          <span className="font-medium text-slate-900">Diagnos: </span>
                          {d.diagnosis}
                        </p>
                      )}
                      {d.goal && (
                        <p className="mt-2 text-sm text-slate-700">
                          <span className="font-medium text-slate-900">Mål: </span>
                          {d.goal}
                        </p>
                      )}
                      {d.key_actions && d.key_actions.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {d.key_actions.map((action, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cross-channel priorities */}
            {current.cross_channel_priorities && current.cross_channel_priorities.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Prioriteringar över kanaler
                  </h3>
                </div>
                <ul className="mt-3 space-y-3">
                  {current.cross_channel_priorities.map((p, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-900">{p.title}</span>
                        {p.domains && p.domains.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {p.domains.map((d) => (
                              <span key={d} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {p.description && (
                        <p className="mt-1 text-sm text-slate-600">{p.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Roadmap (S3 — horizontal timeline) */}
            {current.roadmap && current.roadmap.length > 0 && (
              <RoadmapTimeline milestones={current.roadmap} />
            )}

            {/* Strategy evaluation (S2) */}
            {user && <StrategyEvaluation tenantId={user.id} />}

            {/* Risks */}
            {current.risks && current.risks.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide">Risker</h3>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {current.risks.map((r, i) => (
                    <li key={i} className="text-sm text-amber-900">
                      • {r}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* History */}
            {history.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <button
                  onClick={() => setShowHistory((s) => !s)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">
                      Tidigare strategier ({history.length})
                    </span>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 text-slate-400 transition-transform ${showHistory ? "rotate-90" : ""}`}
                  />
                </button>
                {showHistory && (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {history.map((h, i) => {
                      const v = verdictStyle(h.verdict);
                      return (
                        <li key={h.id ?? i} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-800">
                              {h.headline || "Strategi"}
                            </div>
                            <div className="text-xs text-slate-400">
                              {formatDate(h.generated_at)}
                              {h.horizon ? ` · ${h.horizon}` : ""}
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${v.bg} ${v.text}`}>
                            {v.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        ) : (
          <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Compass className="mx-auto h-8 w-8 text-slate-300" />
            <h2 className="mt-3 text-lg font-semibold text-slate-700">
              {emptyState ? "Ingen strategi än" : "Strategin är inte tillgänglig"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Strategi-agenten körs automatiskt varje söndag när den är aktiverad. Du kan också skapa en manuellt nu.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Genererar…" : "Skapa första strategin"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
