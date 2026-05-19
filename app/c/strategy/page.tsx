"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Calendar, CheckCircle, ChevronRight,
  Compass, History, Loader2, RefreshCw, Sparkles, Target, TrendingUp,
  Settings,
} from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { ApiError } from "@/lib/api";
import { useActiveRuns } from "@/lib/hooks/useActiveRuns";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import CustomerNav from "@/components/CustomerNav";
import CustomerPageShellSkeleton from "@/components/CustomerPageShellSkeleton";
import RoadmapTimeline from "@/components/strategy/RoadmapTimeline";
import EditableSection from "@/components/strategy/EditableSection";
import StrategyEvaluation from "@/components/strategy/StrategyEvaluation";
import StrategyGoalsForm, { StrategyGoals } from "@/components/strategy/StrategyGoalsForm";
import ContentPlanReview, { ContentPlanItem } from "@/components/strategy/ContentPlanReview";

type Verdict = "critical" | "weak" | "improving" | "strong" | string;
type Horizon = "monthly" | "quarterly" | "annual";
type WizardStep = "goals" | "generating" | "review" | "done";

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

interface AuditFinding {
  title: string;
  severity: "critical" | "warning" | "info";
  category?: string;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function strategyAgeDays(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function buildTldr(strategy: Strategy): string[] {
  const bullets: string[] = [];
  for (const p of strategy.cross_channel_priorities ?? []) {
    if (p.title) bullets.push(p.title);
    if (bullets.length >= 3) break;
  }
  if (bullets.length < 3) {
    for (const d of strategy.domain_strategies ?? []) {
      const action = d.key_actions?.[0];
      if (action) bullets.push(`${d.domain}: ${action}`);
      if (bullets.length >= 3) break;
    }
  }
  return bullets.slice(0, 3);
}

export default function StrategyPage() {
  const { t } = useLanguage();
  const { user } = useUser();
  const { tenantClient, effectiveTenantId } = useSite();
  const { runs, triggerRun } = useActiveRuns();
  const [current, setCurrent] = useState<Strategy | null>(null);
  const [history, setHistory] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Wizard state
  const [step, setStep] = useState<WizardStep>("goals");
  const [savedGoals, setSavedGoals] = useState<StrategyGoals | null>(null);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [auditFindings, setAuditFindings] = useState<AuditFinding[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [bulkResult, setBulkResult] = useState<{ created: number; failed: number } | null>(null);

  const verdictStyle = (v?: Verdict): { label: string; bg: string; text: string; ring: string } => {
    switch (v) {
      case "strong":
        return { label: t.strategy.verdictStrong, bg: "bg-green-50", text: "text-green-700", ring: "ring-green-200" };
      case "improving":
        return { label: t.strategy.verdictImproving, bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" };
      case "weak":
        return { label: t.strategy.verdictWeak, bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" };
      case "critical":
        return { label: t.strategy.verdictCritical, bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" };
      default:
        return { label: v || t.strategy.verdictUnknown, bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200" };
    }
  };

  const VERDICT_HINT: Record<string, string> = {
    critical: t.strategy.verdictHintCritical,
    weak: t.strategy.verdictHintWeak,
    improving: t.strategy.verdictHintImproving,
    strong: t.strategy.verdictHintStrong,
  };

  const northStarText = (ns: Strategy["north_star_metric"]): string => {
    if (!ns) return "";
    if (typeof ns === "string") return ns;
    const parts: string[] = [];
    if (ns.name) parts.push(ns.name);
    if (ns.target) parts.push(`${t.strategy.northStarGoal} ${ns.target}`);
    if (ns.current) parts.push(`${t.strategy.northStarCurrent} ${ns.current}`);
    return parts.join(" · ");
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const verdict = useMemo(() => verdictStyle(current?.verdict), [current?.verdict, t]);

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
      const data = await tenantClient.get<Strategy | { strategy?: Strategy }>(
        "/api/strategy/current",
      );
      const s = (data as { strategy?: Strategy })?.strategy ?? (data as Strategy);
      if (s && (s.headline || s.executive_summary || s.id)) {
        setCurrent(s);
      } else {
        setCurrent(null);
      }
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        setError(t.strategy.errorFetch);
      }
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    try {
      const data = await tenantClient.get<{ strategies?: Strategy[] } | Strategy[]>(
        "/api/strategy/history",
      );
      const list = Array.isArray(data) ? data : data?.strategies ?? [];
      setHistory(list);
    } catch {
      setHistory([]);
    }
  };

  const loadSettingsFromSupabase = async () => {
    if (!user) return;
    try {
      const { data } = await getSupabaseBrowser()
        .from("user_settings")
        .select("settings")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.settings) {
        setTeamMembers((data.settings as Record<string, unknown>).team_members as string[] ?? []);
        const goals = (data.settings as Record<string, unknown>).strategy_goals as StrategyGoals | undefined;
        if (goals) setSavedGoals(goals);
      }
    } catch {
      // first time
    }
  };

  const loadAuditFindings = async () => {
    if (!user) return;
    setAuditLoading(true);
    try {
      // Hits the local Next.js route (always 200) — bypasses tenantClient so
      // we don't reach the backend at NEXT_PUBLIC_SAMA_API_URL, which doesn't
      // implement /latest and used to flood the console with 404s.
      const res = await fetch("/api/site-audit/latest", {
        headers: effectiveTenantId ? { "X-Tenant-ID": effectiveTenantId } : {},
      });
      if (res.ok) {
        const data = (await res.json()) as {
          run?: { findings?: AuditFinding[] };
          findings?: AuditFinding[];
        };
        const findings = data?.run?.findings ?? data?.findings ?? [];
        setAuditFindings(
          findings.filter((f: AuditFinding) => f.severity === "critical" || f.severity === "warning")
        );
      } else {
        setAuditFindings([]);
      }
    } catch {
      setAuditFindings([]);
    }
    setAuditLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadCurrent(), loadHistory(), loadSettingsFromSupabase(), loadAuditFindings()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Determine initial step after load
  useEffect(() => {
    if (loading) return;
    if (current) {
      setStep("done");
    } else if (savedGoals) {
      setStep("generating");
    } else {
      setStep("goals");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const saveStrategyPatch = async (patch: Partial<Strategy>) => {
    if (!user) return;
    const data = await tenantClient.patch<{ strategy?: Strategy }>(
      "/api/strategy/current",
      patch,
    );
    if (data?.strategy) {
      setCurrent(data.strategy);
    } else {
      setCurrent((prev) => (prev ? { ...prev, ...patch } : prev));
    }
  };

  const saveGoalsToSupabase = async (goals: StrategyGoals) => {
    if (!user) return;
    const { data: existing } = await getSupabaseBrowser()
      .from("user_settings")
      .select("settings")
      .eq("user_id", user.id)
      .maybeSingle();
    const merged = { ...(existing?.settings ?? {}), strategy_goals: goals };
    await getSupabaseBrowser()
      .from("user_settings")
      .upsert({ user_id: user.id, settings: merged, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  };

  const handleGoalsSubmit = async (goals: StrategyGoals) => {
    setSavedGoals(goals);
    await saveGoalsToSupabase(goals);
    setStep("generating");
    setError("");

    const auditContext = goals.include_audit_findings && auditFindings.length > 0
      ? auditFindings.map((f) => ({ title: f.title, severity: f.severity }))
      : undefined;

    await triggerRun("strategy", "/api/strategy/generate", {
      label: "Strategi-syntes",
      body: {
        horizon: "quarterly",
        goals,
        audit_findings: auditContext,
      },
    });
  };

  // When generating completes, move to review
  useEffect(() => {
    if (!lastCompletedStrategyRunId || step !== "generating") return;
    (async () => {
      await loadCurrent();
      await loadHistory();
      setStep("review");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCompletedStrategyRunId]);

  useEffect(() => {
    if (!lastFailedStrategyRun) return;
    setError(lastFailedStrategyRun.error || t.strategy.errorGenerate);
    if (step === "generating") setStep("goals");
  }, [lastFailedStrategyRun]);

  const handleApprove = async (items: ContentPlanItem[]) => {
    const res = await fetch("/api/strategy/bulk-create-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(effectiveTenantId ? { "X-Site-Id": effectiveTenantId } : {}),
      },
      body: JSON.stringify({ items }),
    });
    const result = await res.json();
    setBulkResult({ created: result.created ?? 0, failed: result.failed ?? 0 });
    setStep("done");
  };

  if (loading) {
    return <CustomerPageShellSkeleton maxWidth="max-w-5xl" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2">
              <Compass className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Strategi</h1>
              <p className="text-sm text-slate-500">
                {step === "goals" && t.strategy.wizardGoals}
                {step === "generating" && t.strategy.wizardGenerating}
                {step === "review" && t.strategy.wizardReview}
                {step === "done" && t.strategy.wizardDone}
              </p>
            </div>
          </div>
          {step === "done" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("goals")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm"
              >
                <Settings className="h-4 w-4" />
                {t.strategy.changeGoals}
              </button>
              <button
                onClick={async () => {
                  if (!savedGoals) return;
                  await handleGoalsSubmit(savedGoals);
                }}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {generating ? "Genererar…" : t.strategy.updatePlan}
              </button>
            </div>
          )}
        </div>

        {/* Wizard step indicator */}
        {step !== "done" && (
          <div className="mb-8 flex items-center gap-2">
            {[
              { key: "goals", label: t.strategy.stepGoals },
              { key: "generating", label: t.strategy.stepGenerating },
              { key: "review", label: t.strategy.stepReview },
            ].map(({ key, label }, i) => {
              const stepOrder = ["goals", "generating", "review"];
              const currentIdx = stepOrder.indexOf(step);
              const thisIdx = stepOrder.indexOf(key);
              const done = thisIdx < currentIdx;
              const active = thisIdx === currentIdx;
              return (
                <div key={key} className="flex items-center gap-2">
                  {i > 0 && <div className={`h-px w-8 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />}
                  <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    active ? "bg-emerald-100 text-emerald-700" :
                    done ? "bg-emerald-500 text-white" :
                    "bg-slate-100 text-slate-400"
                  }`}>
                    {done && <CheckCircle className="h-3 w-3" />}
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {bulkResult && step === "done" && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p>
                  {bulkResult.created} {t.strategy.bulkCreated}
                  {bulkResult.failed > 0 && ` (${bulkResult.failed} ${t.strategy.bulkFailed})`}.
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <a href="/c/content" className="font-semibold underline hover:text-emerald-700">
                    {t.strategy.openContent}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Goals Form ── */}
        {step === "goals" && (
          <StrategyGoalsForm
            initialGoals={savedGoals ?? undefined}
            teamMembers={teamMembers}
            auditFindings={auditFindings}
            auditLoading={auditLoading}
            onSubmit={handleGoalsSubmit}
          />
        )}

        {/* ── Step: Generating ── */}
        {step === "generating" && (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <Sparkles className="h-7 w-7 text-emerald-600 animate-pulse" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">{t.strategy.generatingTitle}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {t.strategy.generatingHint}
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              <span className="text-sm text-slate-400">{t.strategy.generatingLeave}</span>
            </div>
            <button
              onClick={() => setStep("goals")}
              className="mt-6 text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
            >
              {t.strategy.cancelGenerating}
            </button>
          </div>
        )}

        {/* ── Step: Review 90-day plan ── */}
        {step === "review" && savedGoals && current && (
          <ContentPlanReview
            goals={savedGoals}
            strategy={current}
            onApprove={handleApprove}
            onBack={() => setStep("goals")}
          />
        )}

        {/* ── Step: Done — show current strategy ── */}
        {step === "done" && (
          <div className="space-y-6">
            {current ? (
              <>
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
                      <span className="text-xs text-slate-400">{t.strategy.createdAt} {formatDate(current.generated_at)}</span>
                    )}
                  </div>

                  {current.verdict && VERDICT_HINT[current.verdict] && (
                    <p className="mt-2 text-xs text-slate-500">{VERDICT_HINT[current.verdict]}</p>
                  )}

                  {(() => {
                    const tldr = buildTldr(current);
                    if (tldr.length === 0) return null;
                    return (
                      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.strategy.tldr}</h3>
                        <ul className="mt-2 space-y-1.5">
                          {tldr.map((b, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" aria-hidden />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {(() => {
                    const days = strategyAgeDays(current.generated_at);
                    if (days === null) return null;
                    if (days > 30) {
                      return (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>
                            {t.strategy.ageWarning} <strong>{days} {t.strategy.ageDaysSuffix} gammal</strong> {t.strategy.ageWarningSuffix}
                          </span>
                          <button
                            onClick={() => setStep("goals")}
                            className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                          >
                            <Sparkles className="h-3 w-3" />
                            {t.strategy.updatePlanBtn}
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-3 text-xs text-slate-400">
                        Last updated {days === 0 ? t.strategy.ageJustNow : days === 1 ? t.strategy.ageDay : `${days} ${t.strategy.ageDaysSuffix}`} {t.strategy.ageSuffix}
                      </div>
                    );
                  })()}

                  <div className="mt-3">
                    <EditableSection
                      value={current.headline ?? ""}
                      onSave={(next) => saveStrategyPatch({ headline: next })}
                      placeholder={t.strategy.editHeadlinePlaceholder}
                      textClassName="text-xl font-bold text-slate-900"
                      label="Redigera huvudrubrik"
                    />
                  </div>

                  <div className="mt-3">
                    <EditableSection
                      value={current.executive_summary ?? ""}
                      onSave={(next) => saveStrategyPatch({ executive_summary: next })}
                      variant="textarea"
                      placeholder={t.strategy.editSummaryPlaceholder}
                      textClassName="text-sm leading-relaxed text-slate-700"
                      label="Redigera sammanfattning"
                    />
                  </div>

                  {northStarText(current.north_star_metric) && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
                      <Target className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">{t.strategy.northStar}</span>
                      <span>{northStarText(current.north_star_metric)}</span>
                    </div>
                  )}
                </section>

                {/* Domain strategies */}
                {(() => {
                  const paused = new Set(["social", "ads", "tech", "reviews"]);
                  const present = new Set((current.domain_strategies ?? []).map((d) => (d.domain || "").toLowerCase()));
                  const placeholders = Array.from(paused).filter((p) => !present.has(p)).map((p) => ({ domain: p }));
                  const all: (DomainStrategy & { _paused?: boolean })[] = [
                    ...(current.domain_strategies ?? []),
                    ...placeholders.map((p) => ({ ...p, _paused: true })),
                  ];
                  if (all.length === 0) return null;
                  return (
                    <section>
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t.strategy.planPerChannel}</h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {all.map((d, idx) => {
                          const isPaused = !!d._paused;
                          const hasData = !!(d.diagnosis || d.goal || (d.key_actions && d.key_actions.length > 0));
                          const topic = d.goal || d.diagnosis || `${d.domain}-strategi`;
                          const params = new URLSearchParams();
                          params.set("strategy_topic", topic);
                          params.set("topic", topic);
                          return (
                            <div key={`${d.domain}-${idx}`} className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${isPaused ? "opacity-60" : ""}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{d.domain}</div>
                                {isPaused ? (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">{t.strategy.comingSoon}</span>
                                ) : hasData ? (
                                  <a
                                    href={`/c/content?${params.toString()}`}
                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    {t.strategy.createContentFrom}
                                  </a>
                                ) : null}
                              </div>
                              {!isPaused && !hasData && (
                                <p className="mt-2 text-sm text-slate-500">
                                  {t.strategy.noDataChannel}{" "}
                                  <a href="/c/analysis" className="font-medium text-violet-700 underline hover:text-violet-900">Go to Insights</a>
                                </p>
                              )}
                              {isPaused && <p className="mt-2 text-sm text-slate-500">{t.strategy.pausedChannel}</p>}
                              {d.diagnosis && <p className="mt-2 text-sm text-slate-700"><span className="font-medium text-slate-900">{t.strategy.diagnosis} </span>{d.diagnosis}</p>}
                              {d.goal && <p className="mt-2 text-sm text-slate-700"><span className="font-medium text-slate-900">{t.strategy.goal} </span>{d.goal}</p>}
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
                          );
                        })}
                      </div>
                    </section>
                  );
                })()}

                {/* Cross-channel priorities */}
                {current.cross_channel_priorities && current.cross_channel_priorities.length > 0 && (
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t.strategy.crossChannelTitle}</h3>
                    </div>
                    <ul className="mt-3 space-y-3">
                      {current.cross_channel_priorities.map((p, i) => (
                        <li key={i} className="rounded-lg bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-900">{p.title}</span>
                            {p.domains && p.domains.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {p.domains.map((d) => (
                                  <span key={d} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">{d}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {p.description && <p className="mt-1 text-sm text-slate-600">{p.description}</p>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Roadmap */}
                {current.roadmap && current.roadmap.length > 0 && (
                  <RoadmapTimeline milestones={current.roadmap} />
                )}

                {/* Strategy evaluation */}
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
                        <li key={i} className="text-sm text-amber-900">• {r}</li>
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
                        <span className="text-sm font-semibold text-slate-700">{t.strategy.historyTitle} ({history.length})</span>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${showHistory ? "rotate-90" : ""}`} />
                    </button>
                    {showHistory && (
                      <ul className="mt-3 divide-y divide-slate-100">
                        {history.map((h, i) => {
                          const v = verdictStyle(h.verdict);
                          return (
                            <li key={h.id ?? i} className="flex items-center justify-between gap-3 py-2.5">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-slate-800">{h.headline || "Strategi"}</div>
                                <div className="text-xs text-slate-400">{formatDate(h.generated_at)}{h.horizon ? ` · ${h.horizon}` : ""}</div>
                              </div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${v.bg} ${v.text}`}>{v.label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <Compass className="mx-auto h-8 w-8 text-slate-300" />
                <h2 className="mt-3 text-lg font-semibold text-slate-700">{t.strategy.noStrategyTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.strategy.noStrategyHint}</p>
                <button
                  onClick={() => setStep("goals")}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Target className="h-4 w-4" />
                  {t.strategy.setGoals}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
