"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Calendar, CheckCircle, ChevronRight,
  Compass, History, Loader2, Sparkles, Target, TrendingUp,
} from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";
import { ApiError, tenantApi } from "@/lib/api";
import CustomerNav from "@/components/CustomerNav";

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
  const [current, setCurrent] = useState<Strategy | null>(null);
  const [history, setHistory] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [horizon, setHorizon] = useState<Horizon>("monthly");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [emptyState, setEmptyState] = useState(false);

  const verdict = useMemo(() => verdictStyle(current?.verdict), [current?.verdict]);

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

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    setError("");
    setInfo("");
    try {
      await tenantApi(user.id).post(
        "/api/strategy/generate",
        { horizon },
        { headers: { "X-Sama-Intent": "user-action" } },
      );
      setInfo("Genererar en ny strategi. Det tar oftast en minut eller två.");
      const previousAt = current?.generated_at ?? "";
      const deadline = Date.now() + 5 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const data = await tenantApi(user.id).get<Strategy | { strategy?: Strategy }>(
            "/api/strategy/current",
          );
          const s = (data as { strategy?: Strategy })?.strategy ?? (data as Strategy);
          if (s?.generated_at && s.generated_at !== previousAt) {
            setCurrent(s);
            setEmptyState(false);
            break;
          }
        } catch {
          // keep polling
        }
      }
      await loadHistory();
      setInfo("");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Kunde inte generera en ny strategi.";
      setError(msg);
    }
    setGenerating(false);
  };

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

        {info && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
            {info}
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

              {current.headline && (
                <h2 className="mt-3 text-xl font-bold text-slate-900">{current.headline}</h2>
              )}
              {current.executive_summary && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {current.executive_summary}
                </p>
              )}

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

            {/* Roadmap */}
            {current.roadmap && current.roadmap.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Plan framåt
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  {current.roadmap.map((m, i) => (
                    <div key={`${m.horizon}-${i}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        <ArrowRight className="h-3 w-3" />
                        {m.horizon}
                      </div>
                      {m.title && <div className="mt-2 text-sm font-semibold text-slate-900">{m.title}</div>}
                      {m.description && <p className="mt-1 text-sm text-slate-600">{m.description}</p>}
                      {m.items && m.items.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {m.items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-sm text-slate-700">
                              <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

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
