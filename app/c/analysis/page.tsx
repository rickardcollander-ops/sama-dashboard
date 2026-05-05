"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, Loader2, Play, RefreshCw, Plus, X, ChevronRight,
  CheckCircle2, AlertTriangle, TrendingUp, Crown, Skull, Trophy, FileText,
  History as HistoryIcon, Search, Globe,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import KeywordGeoRecommendations from "@/components/KeywordGeoRecommendations";
import { useUser } from "@/lib/hooks/useUser";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import SiteAuditReport from "@/components/analysis/SiteAuditReport";
import type { SiteAuditRun, SiteAuditRunSummary } from "./audit-types";

const getSupabase = getSupabaseBrowser;

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

/**
 * Persist a completed analysis run to the user's saved history. Best-effort:
 * failures are swallowed so the UI flow is unaffected if the save endpoint
 * is unavailable.
 */
async function persistAnalysisRun(run: AnalysisRun): Promise<void> {
  if (!run || run.status !== "completed") return;
  try {
    await fetch("/api/analysis/runs/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(run),
    });
  } catch {
    // best-effort persistence
  }
}

/**
 * Poll /api/analysis/runs/{id} until status leaves "running". Returns the
 * final run record (with full payload if completed). Times out at 15min.
 */
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
    } catch {
      // transient errors don't abort polling
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}
import {
  AI_PLATFORM_LABELS,
  GAP_LABELS,
  type AIPlatform,
  type AnalysisRun,
  type AuditCategory,
  type AuditSeverity,
  type GapCategory,
  type SiteAudit,
} from "./types";

type Stage = "setup" | "running" | "results" | "history";

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

type AnalysisMode = "visibility" | "audit";

export default function AnalysisPage() {
  const { user, loading: userLoading } = useUser();
  const [mode, setMode] = useState<AnalysisMode>("visibility");
  const [stage, setStage] = useState<Stage>("setup");
  const [brand, setBrand] = useState<BrandSettings | null>(null);
  const [queries, setQueries] = useState<string[]>([]);
  const [newQuery, setNewQuery] = useState("");
  const [platforms, setPlatforms] = useState<AIPlatform[]>(["chatgpt", "claude", "perplexity", "google_aio"]);
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase
          .from("user_settings")
          .select("settings")
          .eq("user_id", user.id)
          .single();
        const s = data?.settings || {};
        setBrand({
          brand_name: s.brand_name || "",
          domain: s.domain || "",
          brand_description: s.brand_description || "",
          unique_selling_points: s.unique_selling_points || "",
          target_audience: s.target_audience || "",
          competitors: Array.isArray(s.competitors) ? s.competitors : [],
        });
      } catch {
        setBrand({
          brand_name: "",
          domain: "",
          brand_description: "",
          unique_selling_points: "",
          target_audience: "",
          competitors: [],
        });
      }
    })();
  }, [user]);

  const handleGenerateQueries = async () => {
    if (!brand) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/analysis/generate-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": user?.id || "" },
        body: JSON.stringify(brand),
      });
      const data = (await res.json().catch(() => ({}))) as {
        queries?: string[];
        error?: string;
        upstream_status?: number;
        upstream_body?: string;
        _source?: "mock" | "live";
        _mock_reason?: string;
      };
      if (!res.ok) {
        const parts = [
          data.error || `Generate failed (HTTP ${res.status})`,
          data.upstream_status ? `upstream ${data.upstream_status}` : "",
          data.upstream_body ? `— ${data.upstream_body}` : "",
        ].filter(Boolean);
        throw new Error(parts.join(" "));
      }
      setQueries(data.queries || []);
      if (data._source === "mock" && data._mock_reason) {
        setError(`Using template queries: ${data._mock_reason}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not auto-generate queries.";
      setError(msg);
    }
    setGenerating(false);
  };

  const handleRun = async () => {
    if (!brand || queries.length === 0) return;
    setRunning(true);
    setStage("running");
    setError("");
    try {
      const res = await fetch("/api/analysis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": user?.id || "" },
        body: JSON.stringify({
          brand_name: brand.brand_name,
          domain: brand.domain,
          competitors: brand.competitors,
          queries,
          platforms,
        }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const detail = (data as { error?: string; upstream_status?: number; upstream_body?: string }) || {};
        const parts = [
          detail.error || `Analysis failed (HTTP ${res.status})`,
          detail.upstream_status ? `upstream ${detail.upstream_status}` : "",
          detail.upstream_body ? `— ${detail.upstream_body}` : "",
        ].filter(Boolean);
        throw new Error(parts.join(" "));
      }

      // Real backend returns {id, status: "running"} and we poll until done.
      // Mock backend returns a complete AnalysisRun synchronously (detected
      // by presence of query_results).
      if (data && Array.isArray((data as AnalysisRun).query_results)) {
        const completed = data as AnalysisRun;
        setRun(completed);
        setStage("results");
        void persistAnalysisRun(completed);
      } else if ((data as { id?: string }).id) {
        const finalRun = await pollAnalysisRun(user?.id || "", (data as { id: string }).id);
        if (finalRun?.status === "completed" && Array.isArray(finalRun.query_results)) {
          setRun(finalRun);
          setStage("results");
          void persistAnalysisRun(finalRun);
        } else {
          throw new Error(finalRun?.error || "Analysis did not complete");
        }
      } else {
        throw new Error("Unexpected response from backend");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setError(msg);
      setStage("setup");
    }
    setRunning(false);
  };

  const togglePlatform = (p: AIPlatform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
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

  const handleOpenRun = async (id: string) => {
    if (!user) return;
    setError("");
    try {
      const res = await fetch(`/api/analysis/runs/${id}`, {
        headers: { "X-Tenant-ID": user.id },
      });
      if (!res.ok) throw new Error("could not load run");
      const data = await res.json();
      if (data?.status === "completed" && Array.isArray(data.query_results)) {
        setRun(data);
        setStage("results");
      } else {
        setError(data?.error || "This run is not viewable yet.");
      }
    } catch {
      setError("Could not load this run.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerNav />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Header
          stage={stage}
          onReset={() => { setStage("setup"); setRun(null); }}
          onShowHistory={() => setStage("history")}
          mode={mode}
        />

        <ModeSwitcher mode={mode} onChange={setMode} />

        {mode === "audit" ? (
          <SiteAuditMode tenantId={user?.id || ""} brand={brand} />
        ) : (
          <>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {stage === "setup" && (
          <SetupStage
            brand={brand}
            queries={queries}
            setQueries={setQueries}
            newQuery={newQuery}
            setNewQuery={setNewQuery}
            platforms={platforms}
            togglePlatform={togglePlatform}
            generating={generating}
            onGenerate={handleGenerateQueries}
            onRun={handleRun}
          />
        )}

        {stage === "running" && <RunningStage queryCount={queries.length} platformCount={platforms.length} />}

        {stage === "results" && run && (
          <>
            {run._source === "mock" && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Showing mock data — not a real analysis.</div>
                  {run._mock_reason && <div className="text-xs opacity-80">{run._mock_reason}</div>}
                </div>
              </div>
            )}
            <ResultsStage run={run} />
          </>
        )}

        {stage === "history" && (
          <HistoryStage tenantId={user?.id || ""} onOpen={handleOpenRun} />
        )}

        {running && stage !== "running" && (
          <div className="mt-4 text-xs text-slate-400">Working…</div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Mode switcher ───────────────────────────────────────────────────────── */

function ModeSwitcher({
  mode, onChange,
}: { mode: AnalysisMode; onChange: (m: AnalysisMode) => void }) {
  const options: { id: AnalysisMode; label: string; icon: typeof Search; hint: string }[] = [
    { id: "visibility", label: "Visibility analysis", icon: Search,
      hint: "Per-query SEO + AI mention rate" },
    { id: "audit",      label: "Site audit",          icon: Globe,
      hint: "Full domain crawl with score gauges" },
  ];
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const Icon = o.icon;
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
              active
                ? "border-violet-300 bg-violet-50/50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className={`rounded-lg p-2 ${active ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${active ? "text-violet-900" : "text-slate-800"}`}>
                {o.label}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{o.hint}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Site audit mode ─────────────────────────────────────────────────────── */

type AuditStage = "setup" | "running" | "results" | "history";

async function pollSiteAuditRun(
  tenantId: string, runId: string,
): Promise<SiteAuditRun | null> {
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
    } catch {
      // transient errors don't abort polling
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

function SiteAuditMode({
  tenantId, brand,
}: { tenantId: string; brand: BrandSettings | null }) {
  const [stage, setStage] = useState<AuditStage>("setup");
  const [run, setRun] = useState<SiteAuditRun | null>(null);
  const [running, setRunning] = useState(false);
  const [domain, setDomain] = useState(brand?.domain || "");
  const [maxPages, setMaxPages] = useState(15);
  const [error, setError] = useState("");

  useEffect(() => {
    if (brand?.domain && !domain) setDomain(brand.domain);
  }, [brand, domain]);

  const handleRun = async () => {
    if (!domain) {
      setError("Domain is required.");
      return;
    }
    setRunning(true);
    setStage("running");
    setError("");
    try {
      const res = await fetch("/api/site-audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": tenantId },
        body: JSON.stringify({ domain, max_pages: maxPages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Audit failed to start (HTTP ${res.status})`);
      }
      if (!data?.id) throw new Error(data?.error || "Backend did not return an audit id");
      const final = await pollSiteAuditRun(tenantId, data.id);
      if (final?.status === "completed") {
        setRun(final);
        setStage("results");
      } else {
        throw new Error(final?.error || "Audit did not complete in time");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
      setStage("setup");
    }
    setRunning(false);
  };

  const handleOpen = async (id: string) => {
    setError("");
    try {
      const res = await fetch(`/api/site-audit/runs/${id}`, {
        headers: { "X-Tenant-ID": tenantId },
      });
      if (!res.ok) throw new Error("could not load audit");
      const data = await res.json();
      if (data?.status === "completed") {
        setRun(data);
        setStage("results");
      } else {
        setError(data?.error || "This audit is not viewable yet.");
      }
    } catch {
      setError("Could not load this audit.");
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {stage === "setup" && (
        <SiteAuditSetup
          domain={domain}
          setDomain={setDomain}
          maxPages={maxPages}
          setMaxPages={setMaxPages}
          onRun={handleRun}
          onShowHistory={() => setStage("history")}
        />
      )}

      {stage === "running" && <SiteAuditRunning domain={domain} maxPages={maxPages} />}

      {stage === "results" && run && (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              onClick={() => { setRun(null); setStage("setup"); }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> New audit
            </button>
          </div>
          <SiteAuditReport run={run} />
        </div>
      )}

      {stage === "history" && (
        <SiteAuditHistory tenantId={tenantId} onOpen={handleOpen} onBack={() => setStage("setup")} />
      )}

      {running && stage !== "running" && (
        <div className="mt-4 text-xs text-slate-400">Working…</div>
      )}
    </div>
  );
}

function SiteAuditSetup({
  domain, setDomain, maxPages, setMaxPages, onRun, onShowHistory,
}: {
  domain: string;
  setDomain: (v: string) => void;
  maxPages: number;
  setMaxPages: (v: number) => void;
  onRun: () => void;
  onShowHistory: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Audit configuration</h2>
          <button
            onClick={onShowHistory}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            <HistoryIcon className="h-3.5 w-3.5" /> History
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr,auto]">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 font-medium mb-1">
              Domain
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Discovered via sitemap.xml; falls back to crawling links from the homepage.
            </p>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 font-medium mb-1">
              Max pages
            </label>
            <select
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">What this audit checks</h3>
        <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />Technical SEO — HTTPS, robots.txt, sitemap, viewport, canonical, lang</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />On-page SEO — titles, meta descriptions, headings, word count, alt text</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />GEO readiness — schema.org, OpenGraph, llms.txt, AI-citable structure</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />Link health — HEAD-checks outbound links for 4xx/5xx</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />Performance — server response time across pages</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />Per-page findings + prioritised recommendations</li>
        </ul>
      </section>

      <div className="flex justify-end">
        <button
          onClick={onRun}
          disabled={!domain.trim()}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-700 hover:to-blue-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" /> Run site audit
        </button>
      </div>
    </div>
  );
}

function SiteAuditRunning({ domain, maxPages }: { domain: string; maxPages: number }) {
  return (
    <div className="rounded-xl border bg-white p-12 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-600 mb-4" />
        <h2 className="text-lg font-semibold text-slate-900">Auditing {domain}…</h2>
        <p className="mt-1 text-sm text-slate-500">
          Discovering pages, fetching HTML, parsing on-page signals, and checking links.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Up to {maxPages} pages · typically takes 30–90 seconds.
        </p>
      </div>
    </div>
  );
}

function SiteAuditHistory({
  tenantId, onOpen, onBack,
}: { tenantId: string; onOpen: (id: string) => void; onBack: () => void }) {
  const [runs, setRuns] = useState<SiteAuditRunSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const res = await fetch("/api/site-audit/runs?limit=20", {
          headers: { "X-Tenant-ID": tenantId },
        });
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as { runs: SiteAuditRunSummary[] };
        setRuns(data.runs || []);
      } catch {
        setError("Could not load history.");
        setRuns([]);
      }
    })();
  }, [tenantId]);

  if (runs === null) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> New audit
        </button>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {runs.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-slate-500">
          <HistoryIcon className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">No audits yet. Run your first one to see it here.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Domain</th>
                <th className="text-left px-4 py-2 font-medium">Pages</th>
                <th className="text-left px-4 py-2 font-medium">Score</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const completed = r.status === "completed";
                const failed = r.status === "failed";
                const statusTone = completed
                  ? "bg-emerald-100 text-emerald-700"
                  : failed
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700";
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-600">
                      {new Date(r.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{r.domain || "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{r.pages_analyzed}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {r.overall_score !== null && r.overall_score !== undefined
                        ? <span className="font-semibold">{r.overall_score}/100</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {completed && (
                        <button
                          onClick={() => onOpen(r.id)}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          Open
                        </button>
                      )}
                      {failed && r.error && (
                        <span className="text-xs text-red-500" title={r.error}>error</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistoryStage({ tenantId, onOpen }: { tenantId: string; onOpen: (id: string) => void }) {
  const [runs, setRuns] = useState<AnalysisRunSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const res = await fetch("/api/analysis/runs?limit=20", {
          headers: { "X-Tenant-ID": tenantId },
        });
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as { runs: AnalysisRunSummary[] };
        setRuns(data.runs || []);
      } catch {
        setError("Could not load history.");
        setRuns([]);
      }
    })();
  }, [tenantId]);

  if (runs === null) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-12 text-center text-slate-500">
        <HistoryIcon className="h-8 w-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">No analyses yet. Run your first one to see it here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Date</th>
            <th className="text-left px-4 py-2 font-medium">Brand</th>
            <th className="text-left px-4 py-2 font-medium">Queries</th>
            <th className="text-left px-4 py-2 font-medium">Platforms</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const completed = r.status === "completed";
            const failed = r.status === "failed";
            const statusTone = completed
              ? "bg-emerald-100 text-emerald-700"
              : failed
              ? "bg-red-100 text-red-700"
              : "bg-yellow-100 text-yellow-700";
            return (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-600">
                  {new Date(r.started_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-slate-700">{r.brand_name || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{r.query_count}</td>
                <td className="px-4 py-2 text-slate-600">{r.platform_count}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {completed && (
                    <button
                      onClick={() => onOpen(r.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Open
                    </button>
                  )}
                  {failed && r.error && (
                    <span className="text-xs text-red-500" title={r.error}>error</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Header({
  stage,
  onReset,
  onShowHistory,
  mode,
}: {
  stage: Stage;
  onReset: () => void;
  onShowHistory: () => void;
  mode: AnalysisMode;
}) {
  const isAudit = mode === "audit";
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Sparkles className="h-6 w-6 text-violet-600" />
          Insikter — översikt
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAudit
            ? "Heltäckande sajt-revision: teknik, sidinnehåll, AI-synlighet och länk-hälsa."
            : "Samlad synlighetsrapport för Google och AI-assistenter — hitta gap, skapa content."}
        </p>
      </div>
      {!isAudit && (
        <div className="flex items-center gap-2">
          {stage !== "history" && (
            <button
              onClick={onShowHistory}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <HistoryIcon className="h-4 w-4" /> Historik
            </button>
          )}
          {(stage === "results" || stage === "history") && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Ny analys
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SetupStage(props: {
  brand: BrandSettings;
  queries: string[];
  setQueries: (q: string[]) => void;
  newQuery: string;
  setNewQuery: (v: string) => void;
  platforms: AIPlatform[];
  togglePlatform: (p: AIPlatform) => void;
  generating: boolean;
  onGenerate: () => void;
  onRun: () => void;
}) {
  const { brand, queries, setQueries, newQuery, setNewQuery, platforms, togglePlatform, generating, onGenerate, onRun } = props;
  const canRun = queries.length > 0 && platforms.length > 0 && brand.brand_name && brand.domain;

  return (
    <div className="space-y-6">
      {/* Brand summary */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Varumärkeskontext</h2>
        {!brand.brand_name || !brand.domain ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Varumärkesnamn och domän saknas. <a href="/c/settings" className="underline font-medium">Komplettera i Inställningar</a> för att aktivera AI-genererade frågor.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <Field label="Varumärke" value={brand.brand_name} />
            <Field label="Domän" value={brand.domain} />
            <Field label="Målgrupp" value={brand.target_audience || "—"} />
            <Field label="Konkurrenter" value={brand.competitors.length ? brand.competitors.join(", ") : "—"} />
          </div>
        )}
      </section>

      {/* Queries */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Frågor att analysera</h2>
          <button
            onClick={onGenerate}
            disabled={generating || !brand.brand_name}
            className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Auto-generera
          </button>
        </div>

        {queries.length === 0 ? (
          <p className="text-xs text-slate-400 mb-3">
            Inga frågor än. Klicka <em>Auto-generera</em> för att skapa 10 köpintresse-frågor från ert sammanhang, eller lägg till manuellt nedan.
          </p>
        ) : (
          <ul className="mb-3 space-y-1">
            {queries.map((q, idx) => (
              <li key={idx} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-1.5 text-sm">
                <span className="flex-1 text-slate-700">{q}</span>
                <button
                  onClick={() => setQueries(queries.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-red-500"
                  title="Ta bort"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newQuery.trim()) {
                e.preventDefault();
                setQueries([...queries, newQuery.trim()]);
                setNewQuery("");
              }
            }}
            placeholder="Lägg till en fråga (t.ex. 'bästa frisören i Stockholm')…"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            onClick={() => {
              if (!newQuery.trim()) return;
              setQueries([...queries, newQuery.trim()]);
              setNewQuery("");
            }}
            className="rounded-lg bg-slate-100 px-3 text-slate-600 hover:bg-slate-200"
            title="Lägg till"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{queries.length}/25 queries · max 25 per analysis</p>
      </section>

      {/* Platforms */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">AI platforms to include</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_PLATFORMS.map((p) => {
            const active = platforms.includes(p);
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {AI_PLATFORM_LABELS[p]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Each query is run on Google (SerpAPI) plus the selected AI platforms.
        </p>
      </section>

      {/* Run */}
      <div className="flex justify-end">
        <button
          onClick={onRun}
          disabled={!canRun}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-700 hover:to-blue-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" /> Run analysis
          <span className="text-[11px] font-normal opacity-80 ml-1">
            ({queries.length} queries × {platforms.length} platforms)
          </span>
        </button>
      </div>
    </div>
  );
}

function RunningStage({ queryCount, platformCount }: { queryCount: number; platformCount: number }) {
  const totalChecks = queryCount * (1 + platformCount);
  return (
    <div className="rounded-xl border bg-white p-12 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-600 mb-4" />
        <h2 className="text-lg font-semibold text-slate-900">Running analysis…</h2>
        <p className="mt-1 text-sm text-slate-500">
          Querying Google search and {platformCount} AI platform{platformCount === 1 ? "" : "s"} for {queryCount} queries,
          and crawling your domain for a full SEO + GEO audit.
        </p>
        <p className="mt-3 text-xs text-slate-400">~{totalChecks} AI checks plus a 25-page crawl. This typically takes 1–2 minutes.</p>
      </div>
    </div>
  );
}

type ResultsTab = "overview" | "audit" | "matrix" | "gaps" | "recommendations";

function ResultsStage({ run }: { run: AnalysisRun }) {
  const [tab, setTab] = useState<ResultsTab>("overview");
  const tabs: { id: ResultsTab; label: string; show: boolean }[] = [
    { id: "overview", label: "Översikt", show: true },
    { id: "audit", label: "Sajt-revision", show: !!run.site_audit },
    { id: "matrix", label: "Per fråga", show: true },
    { id: "gaps", label: "Gap-analys", show: true },
    { id: "recommendations", label: "Rekommendationer", show: true },
  ];

  const gapSummary = useMemo(() => buildGapSummary(run), [run]);
  const existingKeywords = useMemo(() => run.query_results.map((q) => q.query), [run]);

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "text-violet-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-violet-600 rounded-t-sm" />}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab run={run} />}
      {tab === "audit" && run.site_audit && <SiteAuditTab audit={run.site_audit} />}
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

function SiteAuditTab({ audit }: { audit: SiteAudit }) {
  const sevTone: Record<AuditSeverity, string> = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-slate-50 text-slate-600 border-slate-200",
  };
  const catLabel: Record<AuditCategory, string> = {
    technical: "Teknik",
    geo: "AI-synlighet",
    content: "Innehåll",
    links: "Länkar",
  };
  const scoreTone = (n: number) =>
    n >= 80 ? "text-emerald-600" : n >= 60 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Poäng</h3>
          <span className="text-xs text-slate-400">{audit.pages_crawled} sidor genomsökta · {audit.domain}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {(["overall", "technical", "geo", "content", "links"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 text-center">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{k}</div>
              <div className={`mt-1 text-2xl font-bold ${scoreTone(audit.scores[k])}`}>{audit.scores[k]}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
          <span>robots.txt: {audit.robots_txt.present ? "present" : "missing"}</span>
          <span>sitemap: {audit.sitemap.present ? `${audit.sitemap.url_count} URLs` : "missing"}</span>
          <span>broken links: {audit.broken_links.broken_count} of {audit.broken_links.checked} checked</span>
          <span>avg word count: {audit.scores.details.avg_word_count ?? "—"}</span>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Issues <span className="ml-1 text-xs text-slate-400">({audit.issues.length})</span>
        </h3>
        {audit.issues.length === 0 ? (
          <p className="text-sm text-slate-400">No issues detected.</p>
        ) : (
          <ul className="space-y-2">
            {audit.issues.map((iss, i) => (
              <li key={i} className={`rounded-lg border px-3 py-2 text-sm ${sevTone[iss.severity]}`}>
                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide">
                  <span>{iss.severity}</span>
                  <span className="opacity-60">· {catLabel[iss.category]}</span>
                </div>
                <div className="mt-0.5 font-medium text-slate-900">{iss.title}</div>
                <div className="text-xs text-slate-600 mt-0.5">{iss.detail}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {audit.broken_links.broken.length > 0 && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Broken links</h3>
          <ul className="space-y-1 text-xs">
            {audit.broken_links.broken.slice(0, 20).map((b) => (
              <li key={b.url} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5">
                <span className="truncate text-slate-700" title={b.url}>{b.url}</span>
                <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-700">{b.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Pages</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">URL</th>
                <th className="text-right px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Score</th>
                <th className="text-right px-3 py-2 font-medium">Words</th>
                <th className="text-right px-3 py-2 font-medium">Issues</th>
              </tr>
            </thead>
            <tbody>
              {audit.pages.map((p) => (
                <tr key={p.url} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700 max-w-[360px] truncate" title={p.url}>{p.url}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">{p.status_code ?? "—"}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${scoreTone(p.page_score)}`}>{p.page_score}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{p.word_count}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{p.issues.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
  const audit = run.site_audit;
  const cols = audit ? "sm:grid-cols-4" : "sm:grid-cols-3";
  return (
    <div className="space-y-6">
      <div className={`grid gap-4 ${cols}`}>
        <Stat label="AI mention rate" value={`${(o.overall_mention_rate * 100).toFixed(0)}%`} hint={`across ${run.platforms.length} AI platforms`} />
        <Stat label="Google top-10 coverage" value={`${(o.seo_top10_coverage * 100).toFixed(0)}%`} hint="of analyzed queries" />
        <Stat label="Visible somewhere" value={`${o.queries_with_presence}/${o.total_queries}`} hint="queries where you appear" />
        {audit && (
          <Stat
            label="Site audit score"
            value={`${audit.scores.overall}`}
            hint={`${audit.pages_crawled} pages crawled · see Site audit tab`}
          />
        )}
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

/* ── small UI helpers ───────────────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
      <div className="text-slate-700 mt-0.5 truncate" title={value}>{value}</div>
    </div>
  );
}

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
