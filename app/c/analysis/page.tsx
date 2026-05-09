"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles, Loader2, RefreshCw, ChevronRight,
  CheckCircle2, AlertTriangle, TrendingUp, Crown, Skull, Trophy, FileText,
  History as HistoryIcon, Search, Globe, Lock, ChevronDown, ChevronUp,
  Calendar as CalendarIcon,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import KeywordGeoRecommendations from "@/components/KeywordGeoRecommendations";
import CreateContentPlanModal from "@/components/CreateContentPlanModal";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { useActiveRuns } from "@/lib/hooks/useActiveRuns";
import { useLanguage } from "@/lib/hooks/useLanguage";
import SiteAuditReport from "@/components/analysis/SiteAuditReport";
import InsightsOverview from "@/components/analysis/InsightsOverview";
import type { SiteAuditRun, SiteAuditRunSummary } from "./audit-types";

interface AnalysisRunSummary {
  id: string;
  brand_name: string | null;
  domain: string | null;
  query_count: number;
  platform_count: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

async function persistAnalysisRun(run: AnalysisRun, tenantId: string): Promise<void> {
  if (!run || run.status !== "completed") return;
  try {
    await fetch("/api/analysis/runs/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": tenantId,
      },
      body: JSON.stringify(run),
    });
  } catch {
    // best-effort
  }
}

async function persistSiteAuditRun(run: SiteAuditRun, tenantId: string): Promise<void> {
  if (!run || run.status !== "completed") return;
  try {
    await fetch("/api/site-audit/runs/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": tenantId,
      },
      body: JSON.stringify(run),
    });
  } catch {
    // best-effort
  }
}

async function pollAnalysisRun(tenantId: string, runId: string): Promise<AnalysisRun & { error?: string } | null> {
  const start = Date.now();
  while (Date.now() - start < 15 * 60 * 1000) {
    try {
      const res = await fetch(`/api/analysis/runs/${runId}`, {
        headers: { "X-Tenant-ID": tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.status && data.status !== "running") return data;
      }
    } catch { /* transient */ }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

async function pollSiteAuditRun(tenantId: string, runId: string): Promise<SiteAuditRun | null> {
  const start = Date.now();
  while (Date.now() - start < 10 * 60 * 1000) {
    try {
      const res = await fetch(`/api/site-audit/runs/${runId}`, {
        headers: { "X-Tenant-ID": tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.status && data.status !== "running") return data as SiteAuditRun;
      }
    } catch { /* transient */ }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

import {
  AI_PLATFORM_LABELS,
  GAP_LABELS,
  type AIPlatform,
  type AnalysisRun,
  type GapCategory,
} from "./types";

interface BrandSettings {
  brand_name: string;
  domain: string;
  brand_description: string;
  unique_selling_points: string;
  target_audience: string;
  competitors: string[];
}

const ALL_PLATFORMS: AIPlatform[] = ["chatgpt", "claude", "perplexity", "gemini", "google_aio", "copilot"];

const GAP_ICON: Record<GapCategory, typeof Trophy> = {
  both_winners: Trophy,
  seo_winner_geo_loser: TrendingUp,
  geo_winner_seo_loser: Sparkles,
  both_losers: Skull,
  competitor_dominates: Crown,
};

export default function AnalysisPage() {
  const { t } = useLanguage();
  const { user, loading: userLoading } = useUser();
  const { effectiveTenantId, activeSite } = useSite();
  const { registerRun } = useActiveRuns();
  const [brand, setBrand] = useState<BrandSettings | null>(null);
  const [running, setRunning] = useState(false);
  const [visibilityRun, setVisibilityRun] = useState<AnalysisRun | null>(null);
  const [auditRun, setAuditRun] = useState<SiteAuditRun | null>(null);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planToast, setPlanToast] = useState<string | null>(null);

  // Clear results when workspace changes so old site's data isn't shown
  useEffect(() => {
    setVisibilityRun(null);
    setAuditRun(null);
    setInitialLoading(true);
    setPlanToast(null);
  }, [effectiveTenantId]);

  // Load brand settings + latest results
  useEffect(() => {
    if (!user || !effectiveTenantId) return;
    (async () => {
      const s = (activeSite?.settings || {}) as Record<string, unknown>;
      setBrand({
        brand_name: (s.brand_name as string) || "",
        domain: (s.domain as string) || "",
        brand_description: (s.brand_description as string) || "",
        unique_selling_points: (s.unique_selling_points as string) || "",
        target_audience: (s.target_audience as string) || "",
        competitors: Array.isArray(s.competitors) ? s.competitors as string[] : [],
      });

      try {
        const res = await fetch("/api/analysis/runs?limit=1", {
          headers: { "X-Tenant-ID": effectiveTenantId },
        });
        if (res.ok) {
          const data = await res.json();
          const latest = data?.runs?.[0];
          if (latest?.id && latest.status === "completed") {
            const full = await fetch(`/api/analysis/runs/${latest.id}`, {
              headers: { "X-Tenant-ID": effectiveTenantId },
            });
            if (full.ok) {
              const run = await full.json();
              if (run?.status === "completed") setVisibilityRun(run);
            }
          }
        }
      } catch { /* not critical */ }

      try {
        const res = await fetch("/api/site-audit/runs?limit=1", {
          headers: { "X-Tenant-ID": effectiveTenantId },
        });
        if (res.ok) {
          const data = await res.json();
          const latest = data?.runs?.[0];
          if (latest?.id && latest.status === "completed") {
            const full = await fetch(`/api/site-audit/runs/${latest.id}`, {
              headers: { "X-Tenant-ID": effectiveTenantId },
            });
            if (full.ok) {
              const run = await full.json();
              if (run?.status === "completed") {
                setAuditRun(run);
                void persistSiteAuditRun(run, effectiveTenantId);
              }
            }
          }
        }
      } catch { /* not critical */ }

      setInitialLoading(false);
    })();
  }, [user, effectiveTenantId, activeSite]);

  const handleRun = async () => {
    if (!brand || !brand.domain) return;
    setRunning(true);
    setError("");

    try {
      let queries: string[] = [];
      try {
        const qRes = await fetch("/api/analysis/generate-queries", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Tenant-ID": effectiveTenantId },
          body: JSON.stringify(brand),
        });
        if (qRes.ok) {
          const qData = await qRes.json();
          queries = qData.queries || [];
        }
      } catch { /* fallback */ }

      if (queries.length === 0) {
        queries = [brand.brand_name, brand.domain].filter(Boolean);
      }

      const platforms: AIPlatform[] = ["chatgpt", "claude", "perplexity", "google_aio"];

      const [visRes, auditRes] = await Promise.allSettled([
        fetch("/api/analysis/run", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Tenant-ID": effectiveTenantId },
          body: JSON.stringify({
            brand_name: brand.brand_name,
            domain: brand.domain,
            competitors: brand.competitors,
            queries,
            platforms,
          }),
        }),
        fetch("/api/site-audit/run", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Tenant-ID": effectiveTenantId },
          body: JSON.stringify({ domain: brand.domain, max_pages: 200 }),
        }),
      ]);

      const polls: Promise<unknown>[] = [];

      if (visRes.status === "fulfilled" && visRes.value.ok) {
        const vData = await visRes.value.json().catch(() => ({}));
        if (Array.isArray((vData as AnalysisRun).query_results)) {
          setVisibilityRun(vData as AnalysisRun);
          void persistAnalysisRun(vData as AnalysisRun, effectiveTenantId);
        } else if ((vData as { id?: string }).id) {
          polls.push(
            pollAnalysisRun(effectiveTenantId, (vData as { id: string }).id).then((r) => {
              if (r?.status === "completed") {
                setVisibilityRun(r);
                void persistAnalysisRun(r, effectiveTenantId);
              }
            })
          );
        }
      }

      if (auditRes.status === "fulfilled" && auditRes.value.ok) {
        const aData = await auditRes.value.json().catch(() => ({}));
        const auditId = (aData as { id?: string }).id;
        if (auditId) {
          registerRun("site_audit", auditId, {
            label: brand.domain ? `Sajtanalys · ${brand.domain}` : "Sajtanalys",
          });
          polls.push(
            pollSiteAuditRun(effectiveTenantId, auditId).then((r) => {
              if (r?.status === "completed") {
                setAuditRun(r);
                void persistSiteAuditRun(r, effectiveTenantId);
              }
            })
          );
        }
      }

      await Promise.allSettled(polls);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysen misslyckades");
    }

    setRunning(false);
  };

  if (userLoading || !brand) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  const noDomain = !brand.domain;
  const hasResults = !!(visibilityRun || auditRun);
  // Skapa content-plan-knappen kräver en färdig analyserad körning + tenant
  const canCreatePlan =
    !!visibilityRun?.id &&
    visibilityRun.status === "completed" &&
    !!effectiveTenantId &&
    effectiveTenantId !== "default";

  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerNav />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Sparkles className="h-6 w-6 text-violet-600" />
              {t.insights.title}
            </h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {brand.domain ? (
                <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-medium text-slate-600">
                  <Lock className="h-3 w-3" /> {brand.domain}
                </span>
              ) : (
                <a href="/c/settings" className="text-sm text-amber-600 hover:underline">
                  ⚠ {t.insights.domainHint}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <HistoryIcon className="h-4 w-4" />
              {t.insights.historyBtn}
              {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setShowPlanModal(true)}
              disabled={!canCreatePlan}
              title={
                !canCreatePlan
                  ? "Kör en analys först för att kunna skapa en plan från den"
                  : "Skapa en 90-dagars content-plan baserat på analysens gap"
              }
              className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarIcon className="h-4 w-4" />
              Skapa content-plan
            </button>
            <button
              onClick={handleRun}
              disabled={running || noDomain}
              title={
                noDomain ? "Lägg till domän i Inställningar" :
                "Kör en ny synlighets- och sajtanalys"
              }
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-700 hover:to-blue-700 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {running ? t.insights.analysing : t.insights.runAnalysis}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {planToast && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium">Content-plan skapas i bakgrunden</div>
              <div className="mt-0.5 text-xs opacity-80">{planToast}</div>
              <Link href="/c/content/plan" className="mt-1 inline-block text-xs font-semibold underline">
                Visa planen →
              </Link>
            </div>
            <button
              onClick={() => setPlanToast(null)}
              className="text-emerald-500 hover:text-emerald-700"
              aria-label="Stäng"
            >
              ×
            </button>
          </div>
        )}

        {running && (
          <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-5">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-violet-900">Analyserar {brand.domain}…</p>
                <p className="text-xs text-violet-600 mt-0.5">
                  {t.insights.analysingDesc}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Historik (collapsible) ── */}
        {showHistory && (
          <div className="mb-8 space-y-6">
            <CombinedHistory
              tenantId={effectiveTenantId}
              onOpenVisibility={async (id) => {
                setError("");
                try {
                  const res = await fetch(`/api/analysis/runs/${id}`, { headers: { "X-Tenant-ID": effectiveTenantId } });
                  const d = await res.json().catch(() => ({}));
                  if (res.ok && d?.status === "completed") {
                    setVisibilityRun(d);
                    setShowHistory(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    setError(d?.error || "Kunde inte ladda analysen. Backend kan vara otillgänglig — försök igen om en stund.");
                  }
                } catch {
                  setError("Kunde inte ladda analysen. Kontrollera din anslutning och försök igen.");
                }
              }}
              onOpenAudit={async (id) => {
                setError("");
                try {
                  const res = await fetch(`/api/site-audit/runs/${id}`, { headers: { "X-Tenant-ID": effectiveTenantId } });
                  const d = await res.json().catch(() => ({}));
                  if (res.ok && d?.status === "completed") {
                    setAuditRun(d);
                    setShowHistory(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    setError(d?.error || "Kunde inte ladda sajtgenomgången. Backend kan vara otillgänglig — försök igen om en stund.");
                  }
                } catch {
                  setError("Kunde inte ladda sajtgenomgången. Kontrollera din anslutning och försök igen.");
                }
              }}
            />
          </div>
        )}

        {/* ── Empty state ── */}
        {!initialLoading && !running && !hasResults && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-violet-200 mb-4" />
            <h2 className="text-lg font-semibold text-slate-800">{t.insights.emptyTitle}</h2>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              {t.insights.emptyHint} <strong>{t.insights.emptyHintRun}</strong> {t.insights.emptyHintSuffix}{" "}
              {brand.domain || "er sajt"} {t.insights.emptyHintSuffix2}
            </p>
            {noDomain && (
              <a href="/c/settings" className="mt-4 inline-block text-sm font-medium text-violet-700 underline">
                Lägg till domän i Inställningar →
              </a>
            )}
          </div>
        )}

        {/* ── AI + SEO Synlighet ── */}
        {visibilityRun && !running && (
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-violet-500" />
                <h2 className="text-sm font-semibold text-slate-800">{t.insights.visibilityTitle}</h2>
                {visibilityRun.created_at && (
                  <span className="text-xs text-slate-400">
                    · {new Date(visibilityRun.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            {visibilityRun._source === "mock" && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Exempeldata — inte en riktig analys.</div>
                  {visibilityRun._mock_reason && <div className="text-xs opacity-80">{visibilityRun._mock_reason}</div>}
                </div>
              </div>
            )}
            <ResultsStage run={visibilityRun} />
          </div>
        )}

        {/* ── Site Audit ── */}
        {auditRun && !running && (
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-800">{t.insights.auditTitle}</h2>
              {auditRun.created_at && (
                <span className="text-xs text-slate-400">
                  · {new Date(auditRun.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
            <SiteAuditReport run={auditRun} />
          </div>
        )}

        {/* ── Insikter overview (always visible) ── */}
        {user && !running && (
          <div className="mt-2">
            <InsightsOverview tenantId={effectiveTenantId} />
          </div>
        )}
      </div>

      {/* Skapa content-plan modal */}
      {showPlanModal && visibilityRun?.id && effectiveTenantId && (
        <CreateContentPlanModal
          analysisRunId={visibilityRun.id}
          analysisRun={visibilityRun}
          tenantId={effectiveTenantId}
          onClose={() => setShowPlanModal(false)}
          onSuccess={(result) => {
            setPlanToast(
              result.message ||
                `Cirka ${result.articles_per_week * 13} artiklar och ${
                  result.articles_per_week * 13 * result.social_platforms.length
                } sociala inlägg genereras.`,
            );
            if (result.run_id) {
              const totalArticles = result.articles_per_week * 13;
              const totalSocial = totalArticles * result.social_platforms.length;
              // Plan creation only batches a single Claude call for titles
              // (and at most one extra call for brand-seed topics when the
              // analysis is sparse). Article and social bodies are written
              // later, on user approval, so this whole step is seconds —
              // not minutes. Keep a 30s floor so the bar doesn't snap to
              // 100% before the agent_runs row gets polled.
              registerRun("content", result.run_id, {
                label: `Content-plan · ${totalArticles} artiklar + ${totalSocial} inlägg`,
                expectedSeconds: 30,
              });
            }
          }}
        />
      )}
    </div>
  );
}

/* ── Combined history ─────────────────────────────────────────────────────────────────────── */

function CombinedHistory({
  tenantId,
  onOpenVisibility,
  onOpenAudit,
}: {
  tenantId: string;
  onOpenVisibility: (id: string) => void;
  onOpenAudit: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [visRuns, setVisRuns] = useState<AnalysisRunSummary[] | null>(null);
  const [auditRuns, setAuditRuns] = useState<SiteAuditRunSummary[] | null>(null);
  const [activeTab, setActiveTab] = useState<"visibility" | "audit">("visibility");

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      fetch("/api/analysis/runs?limit=20", { headers: { "X-Tenant-ID": tenantId } })
        .then((r) => r.json()).then((d) => setVisRuns(d.runs || [])).catch(() => setVisRuns([])),
      fetch("/api/site-audit/runs?limit=20", { headers: { "X-Tenant-ID": tenantId } })
        .then((r) => r.json()).then((d) => setAuditRuns(d.runs || [])).catch(() => setAuditRuns([])),
    ]);
  }, [tenantId]);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="flex border-b border-slate-100">
        {[
          { id: "visibility" as const, label: t.insights.tabVisibility, icon: Search },
          { id: "audit" as const, label: t.insights.tabAudit, icon: Globe },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === id ? "border-b-2 border-violet-600 text-violet-700" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === "visibility" && (
        visRuns === null ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
        ) : visRuns.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">{t.insights.historyNoVisibility}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">{t.insights.historyColDate}</th>
                <th className="text-left px-4 py-2 font-medium">{t.insights.historyColQueries}</th>
                <th className="text-left px-4 py-2 font-medium">{t.insights.historyColPlatforms}</th>
                <th className="text-left px-4 py-2 font-medium">{t.insights.historyColStatus}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visRuns.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">{new Date(r.started_at).toLocaleString("sv-SE")}</td>
                  <td className="px-4 py-2 text-slate-600">{r.query_count}</td>
                  <td className="px-4 py-2 text-slate-600">{r.platform_count}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                      r.status === "failed" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.status === "completed" && (
                      <button onClick={() => onOpenVisibility(r.id)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">
                        {t.insights.historyView}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {activeTab === "audit" && (
        auditRuns === null ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
        ) : auditRuns.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">{t.insights.historyNoAudit}</p>
        ) : (
          <>
            <AuditScoreTimeline runs={auditRuns} />
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">{t.insights.historyColDate}</th>
                  <th className="text-left px-4 py-2 font-medium">{t.insights.historyColPages}</th>
                  <th className="text-left px-4 py-2 font-medium">{t.insights.historyColScore}</th>
                  <th className="text-left px-4 py-2 font-medium">{t.insights.historyColStatus}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {auditRuns.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-600">{new Date(r.started_at).toLocaleString("sv-SE")}</td>
                    <td className="px-4 py-2 text-slate-600">{r.pages_analyzed}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {r.overall_score != null ? <span className="font-semibold">{r.overall_score}/100</span> : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        r.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                        r.status === "failed" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.status === "completed" && (
                        <button onClick={() => onOpenAudit(r.id)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">
                          {t.insights.historyView}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      )}
    </div>
  );
}

function AuditScoreTimeline({ runs }: { runs: SiteAuditRunSummary[] }) {
  const { t } = useLanguage();
  const points = runs
    .filter((r) => r.status === "completed" && typeof r.overall_score === "number")
    .map((r) => ({
      ts: new Date(r.started_at).getTime(),
      score: r.overall_score as number,
      label: new Date(r.started_at).toLocaleDateString("sv-SE", {
        day: "numeric",
        month: "short",
      }),
    }))
    .sort((a, b) => a.ts - b.ts);

  if (points.length < 2) {
    return null;
  }

  const W = 600;
  const H = 120;
  const PAD_X = 24;
  const PAD_Y = 16;
  const minScore = Math.min(...points.map((p) => p.score), 0);
  const maxScore = Math.max(...points.map((p) => p.score), 100);
  const span = Math.max(1, maxScore - minScore);

  const xFor = (i: number) =>
    PAD_X + (i * (W - 2 * PAD_X)) / Math.max(1, points.length - 1);
  const yFor = (s: number) =>
    H - PAD_Y - ((s - minScore) / span) * (H - 2 * PAD_Y);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.score).toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.score - first.score;

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{t.insights.scoreHistory}</h3>
          <p className="text-xs text-slate-500">
            {points.length} {t.insights.scoreHistoryDesc} — {first.label} → {last.label}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-2xl font-bold text-slate-900">{last.score}</span>
          <span
            className={`text-xs font-semibold ${
              delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-slate-400"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta} {t.insights.firstVs} första
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-32 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Audit-score över tid"
      >
        <line x1={PAD_X} x2={W - PAD_X} y1={yFor(80)} y2={yFor(80)} stroke="#e2e8f0" strokeDasharray="2 4" />
        <line x1={PAD_X} x2={W - PAD_X} y1={yFor(60)} y2={yFor(60)} stroke="#e2e8f0" strokeDasharray="2 4" />
        <path d={path} fill="none" stroke="#8b5cf6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.score)}
            r={3}
            fill="#fff"
            stroke="#8b5cf6"
            strokeWidth={2}
          >
            <title>{`${p.label}: ${p.score}/100`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{first.label}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}


type ResultsTab = "overview" | "matrix" | "gaps" | "recommendations";

function ResultsStage({ run }: { run: AnalysisRun }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<ResultsTab>("overview");
  const tabs: { id: ResultsTab; label: string; show: boolean }[] = [
    { id: "overview", label: t.insights.auditTabOverview, show: true },
    { id: "matrix", label: t.insights.auditTabMatrix, show: true },
    { id: "gaps", label: t.insights.auditTabGaps, show: true },
    { id: "recommendations", label: t.insights.auditTabRecommendations, show: true },
  ];

  const gapSummary = useMemo(() => buildGapSummary(run), [run]);
  const existingKeywords = useMemo(() => run.query_results.map((q) => q.query), [run]);

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.filter((tab) => tab.show).map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              tab === tabItem.id ? "text-violet-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tabItem.label}
            {tab === tabItem.id && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-violet-600 rounded-t-sm" />}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab run={run} />}
      {tab === "matrix" && <MatrixTab run={run} />}
      {tab === "gaps" && <GapsTab run={run} />}
      {tab === "recommendations" && (
        <KeywordGeoRecommendations
          existingKeywords={existingKeywords}
          gapSummary={gapSummary}
          title="Rekommenderade tillägg att spåra"
          description="Baserat på dina gap föreslår AI nya sökord och AI-frågor som du kan lägga till."
        />
      )}
    </div>
  );
}

function buildGapSummary(run: AnalysisRun): string {
  const lines: string[] = [];
  const o = run.overview;
  lines.push(
    `Brand visible in ${o.queries_with_presence}/${o.total_queries} queries; AI mention rate ${(o.overall_mention_rate * 100).toFixed(0)}%; Google top-10 coverage ${(o.seo_top10_coverage * 100).toFixed(0)}%.`,
  );

  const competitorWins = run.query_results.filter((q) => q.gap === "competitor_dominates").slice(0, 8);
  if (competitorWins.length) {
    lines.push("Queries where competitors dominate:");
    for (const q of competitorWins) {
      const comps = new Set<string>();
      q.ai_results.forEach((r) => r.competitors_mentioned?.forEach((c) => comps.add(c)));
      lines.push(`- "${q.query}" (competitors: ${[...comps].slice(0, 4).join(", ") || "n/a"})`);
    }
  }

  const bothLosers = run.query_results.filter((q) => q.gap === "both_losers").slice(0, 6);
  if (bothLosers.length) {
    lines.push("Queries where brand has no SEO or GEO presence:");
    for (const q of bothLosers) lines.push(`- "${q.query}"`);
  }

  if (o.top_opportunities.length) {
    lines.push("Top opportunities flagged:");
    for (const op of o.top_opportunities.slice(0, 5)) {
      lines.push(`- "${op.query}" — ${op.reason}`);
    }
  }
  return lines.join("\n");
}

function OverviewTab({ run }: { run: AnalysisRun }) {
  const o = run.overview;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="AI mention rate" value={`${(o.overall_mention_rate * 100).toFixed(0)}%`} hint={`across ${run.platforms.length} AI platforms`} />
        <Stat label="Google top-10 coverage" value={`${(o.seo_top10_coverage * 100).toFixed(0)}%`} hint="of analyzed queries" />
        <Stat label="Visible somewhere" value={`${o.queries_with_presence}/${o.total_queries}`} hint="queries where you appear" />
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Top opportunities</h3>
        {o.top_opportunities.length === 0 ? (
          <p className="text-sm text-slate-400">No standout gaps. See per-query view for full breakdown.</p>
        ) : (
          <ul className="space-y-2">
            {o.top_opportunities.map((op, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{op.query}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{op.reason}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MatrixTab({ run }: { run: AnalysisRun }) {
  const platforms = run.platforms;
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-slate-50 min-w-[260px]">Query</th>
              <th className="text-center px-3 py-2 font-medium">Google</th>
              {platforms.map((p) => (
                <th key={p} className="text-center px-3 py-2 font-medium">{AI_PLATFORM_LABELS[p]}</th>
              ))}
              <th className="text-left px-3 py-2 font-medium">Gap</th>
            </tr>
          </thead>
          <tbody>
            {run.query_results.map((q, idx) => (
              <tr key={idx} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700 sticky left-0 bg-white max-w-[260px] truncate" title={q.query}>{q.query}</td>
                <td className="px-3 py-2 text-center">
                  <SeoCell rank={q.seo_rank} />
                </td>
                {platforms.map((p) => {
                  const r = q.ai_results.find((x) => x.platform === p);
                  return (
                    <td key={p} className="px-3 py-2 text-center">
                      <AiCell mentioned={!!r?.mentioned} rank={r?.rank ?? null} cited={!!r?.cited_as_source} />
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <GapBadge gap={q.gap} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GapsTab({ run }: { run: AnalysisRun }) {
  const grouped = useMemo(() => {
    const map = new Map<GapCategory, typeof run.query_results>();
    for (const q of run.query_results) {
      const list = map.get(q.gap) || [];
      list.push(q);
      map.set(q.gap, list);
    }
    return map;
  }, [run]);

  const order: GapCategory[] = [
    "competitor_dominates",
    "seo_winner_geo_loser",
    "geo_winner_seo_loser",
    "both_losers",
    "both_winners",
  ];

  return (
    <div className="space-y-4">
      {order.map((cat) => {
        const items = grouped.get(cat) || [];
        if (items.length === 0) return null;
        const meta = GAP_LABELS[cat];
        const Icon = GAP_ICON[cat];
        const iconColor = {
          amber: "text-amber-600",
          rose: "text-rose-600",
          slate: "text-slate-500",
          emerald: "text-emerald-600",
          red: "text-red-600",
        }[meta.tone];
        return (
          <section key={cat} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${iconColor}`} />
                <h3 className="text-sm font-semibold text-slate-800">{meta.title}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{items.length}</span>
              </div>
              <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <FileText className="h-3.5 w-3.5" />
                {meta.cta}
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((q, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700 truncate flex-1 pr-4">{q.query}</span>
                  <span className="text-xs text-slate-400">
                    SEO {q.seo_rank ? `#${q.seo_rank}` : "—"} ·{" "}
                    AI {q.ai_results.filter((r) => r.mentioned).length}/{q.ai_results.length}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ── small UI helpers ───────────────────────────────────────────────────────────────────── */

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function SeoCell({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-slate-300">—</span>;
  const tone = rank <= 3 ? "bg-emerald-100 text-emerald-700" : rank <= 10 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500";
  return <span className={`inline-flex min-w-[28px] justify-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}`}>#{rank}</span>;
}

function AiCell({ mentioned, rank, cited }: { mentioned: boolean; rank: number | null; cited: boolean }) {
  if (!mentioned) return <span className="text-slate-300">—</span>;
  const tone = rank === 1 ? "bg-emerald-100 text-emerald-700" : rank && rank <= 3 ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      <CheckCircle2 className="h-3 w-3" />
      {rank ? `#${rank}` : "✓"}
      {cited && <span className="text-[9px] opacity-70">cite</span>}
    </span>
  );
}

function GapBadge({ gap }: { gap: GapCategory }) {
  const meta = GAP_LABELS[gap];
  const tone = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
  }[meta.tone];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}>{meta.title}</span>;
}
