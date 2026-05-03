"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, Loader2, Play, RefreshCw, Plus, X, ChevronRight,
  CheckCircle2, AlertTriangle, TrendingUp, Crown, Skull, Trophy, FileText,
  History as HistoryIcon, Gauge, Link2, Globe, ShieldCheck, AlertCircle,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import KeywordGeoRecommendations from "@/components/KeywordGeoRecommendations";
import { useUser } from "@/lib/hooks/useUser";
import { tenantApi } from "@/lib/api";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

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
  type AuditIssue,
  type AuditPageReport,
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

export default function AnalysisPage() {
  const { user, loading: userLoading } = useUser();
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
        const supabase = getSupabaseBrowser();
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
      if (!res.ok) throw new Error("generate failed");
      const data = (await res.json()) as { queries: string[] };
      setQueries(data.queries || []);
    } catch {
      setError("Could not auto-generate queries. Add some manually below.");
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
      if (!res.ok) throw new Error("run failed");
      const data = await res.json();

      // Real backend returns {id, status: "running"} and we poll until done.
      // Mock backend returns a complete AnalysisRun synchronously (detected
      // by presence of query_results).
      if (data && Array.isArray(data.query_results)) {
        setRun(data as AnalysisRun);
        setStage("results");
      } else if (data?.id) {
        const finalRun = await pollAnalysisRun(user?.id || "", data.id);
        if (finalRun?.status === "completed" && Array.isArray(finalRun.query_results)) {
          setRun(finalRun);
          setStage("results");
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
        />

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

        {stage === "results" && run && <ResultsStage run={run} />}

        {stage === "history" && (
          <HistoryStage tenantId={user?.id || ""} onOpen={handleOpenRun} />
        )}

        {running && stage !== "running" && (
          <div className="mt-4 text-xs text-slate-400">Working…</div>
        )}
      </div>
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
}: {
  stage: Stage;
  onReset: () => void;
  onShowHistory: () => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Sparkles className="h-6 w-6 text-violet-600" />
          SEO + GEO Analysis
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Unified visibility report across Google search and AI assistants. Find gaps, drive content.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {stage !== "history" && (
          <button
            onClick={onShowHistory}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <HistoryIcon className="h-4 w-4" /> History
          </button>
        )}
        {(stage === "results" || stage === "history") && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> New analysis
          </button>
        )}
      </div>
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
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Brand context</h2>
        {!brand.brand_name || !brand.domain ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Brand name and domain are missing. <a href="/c/settings" className="underline font-medium">Complete in Settings</a> to enable auto-generated queries.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <Field label="Brand" value={brand.brand_name} />
            <Field label="Domain" value={brand.domain} />
            <Field label="Audience" value={brand.target_audience || "—"} />
            <Field label="Competitors" value={brand.competitors.length ? brand.competitors.join(", ") : "—"} />
          </div>
        )}
      </section>

      {/* Queries */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Queries to analyze</h2>
          <button
            onClick={onGenerate}
            disabled={generating || !brand.brand_name}
            className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Auto-generate
          </button>
        </div>

        {queries.length === 0 ? (
          <p className="text-xs text-slate-400 mb-3">
            No queries yet. Click <em>Auto-generate</em> to draft 10 buyer-intent queries from your brand context, or add manually below.
          </p>
        ) : (
          <ul className="mb-3 space-y-1">
            {queries.map((q, idx) => (
              <li key={idx} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-1.5 text-sm">
                <span className="flex-1 text-slate-700">{q}</span>
                <button
                  onClick={() => setQueries(queries.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-red-500"
                  title="Remove"
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
            placeholder="Add a query (e.g. 'best CRM for B2B SaaS')…"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            onClick={() => {
              if (!newQuery.trim()) return;
              setQueries([...queries, newQuery.trim()]);
              setNewQuery("");
            }}
            className="rounded-lg bg-slate-100 px-3 text-slate-600 hover:bg-slate-200"
            title="Add"
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

function ResultsStage({ run }: { run: AnalysisRun }) {
  const [tab, setTab] = useState<"overview" | "matrix" | "gaps" | "audit" | "recommendations">("overview");
  const tabs: { id: typeof tab; label: string; show: boolean }[] = [
    { id: "overview", label: "Overview", show: true },
    { id: "audit", label: "Site Audit", show: !!run.site_audit },
    { id: "matrix", label: "Per query", show: true },
    { id: "gaps", label: "Gap analysis", show: true },
    { id: "recommendations", label: "Recommendations", show: true },
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
          title="Recommended additions to track"
          description="Based on your analysis gaps, AI proposes new keywords and GEO queries you can add to your tracking."
        />
      )}
    </div>
  );
}

function SiteAuditTab({ audit }: { audit: SiteAudit }) {
  const issuesBySeverity = useMemo(() => {
    const buckets: Record<AuditSeverity, AuditIssue[]> = { high: [], medium: [], low: [] };
    for (const issue of audit.issues) {
      buckets[issue.severity].push(issue);
    }
    return buckets;
  }, [audit.issues]);

  const categoryLabel: Record<AuditCategory, string> = {
    technical: "Technical",
    geo: "GEO",
    content: "Content",
    links: "Links",
  };
  const sevTone: Record<AuditSeverity, string> = {
    high: "border-red-200 bg-red-50 text-red-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    low: "border-slate-200 bg-slate-50 text-slate-600",
  };

  const ScoreCard = ({ label, value }: { label: string; value: number }) => {
    const tone = value >= 80 ? "text-emerald-700" : value >= 60 ? "text-amber-700" : "text-red-700";
    return (
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-5">
        <ScoreCard label="Overall" value={audit.scores.overall} />
        <ScoreCard label="Technical" value={audit.scores.technical} />
        <ScoreCard label="GEO" value={audit.scores.geo} />
        <ScoreCard label="Content" value={audit.scores.content} />
        <ScoreCard label="Links" value={audit.scores.links} />
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Globe className="h-4 w-4 text-slate-400" />
            Crawl summary — {audit.domain}
          </h3>
          <span className="text-xs text-slate-500">{audit.pages_crawled} pages crawled</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-slate-500">robots.txt</p>
            <p className="font-medium text-slate-700 mt-0.5">{audit.robots_txt.present ? "Present" : "Missing"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Sitemap</p>
            <p className="font-medium text-slate-700 mt-0.5">
              {audit.sitemap.present ? `${audit.sitemap.url_count} URLs` : "Missing"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Broken links</p>
            <p className="font-medium text-slate-700 mt-0.5">
              {audit.broken_links.broken_count} / {audit.broken_links.checked}
            </p>
          </div>
        </div>
      </section>

      {(["high", "medium", "low"] as AuditSeverity[]).map((sev) => {
        const issues = issuesBySeverity[sev];
        if (issues.length === 0) return null;
        return (
          <section key={sev} className={`rounded-xl border p-5 shadow-sm ${sevTone[sev]}`}>
            <h3 className="text-sm font-semibold mb-3 capitalize flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {sev} priority — {issues.length} {issues.length === 1 ? "issue" : "issues"}
            </h3>
            <ul className="space-y-2">
              {issues.map((issue, i) => (
                <li key={i} className="rounded-lg bg-white border border-slate-100 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {categoryLabel[issue.category]}
                    </span>
                    <p className="text-sm font-medium text-slate-900">{issue.title}</p>
                  </div>
                  <p className="text-xs text-slate-600">{issue.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {audit.pages.length > 0 && (
        <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-slate-400" />
              Per-page scores
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">URL</th>
                  <th className="text-right px-3 py-2 font-medium">Score</th>
                  <th className="text-right px-3 py-2 font-medium">Status</th>
                  <th className="text-right px-3 py-2 font-medium">Words</th>
                  <th className="text-left px-3 py-2 font-medium">Top issue</th>
                </tr>
              </thead>
              <tbody>
                {audit.pages.slice(0, 20).map((p) => (
                  <tr key={p.url} className="border-t border-slate-100">
                    <td className="px-3 py-2 truncate max-w-[300px] text-slate-700" title={p.url}>{p.url}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${
                        p.page_score >= 80 ? "bg-emerald-100 text-emerald-700" :
                        p.page_score >= 60 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{p.page_score}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{p.status_code ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{p.word_count}</td>
                    <td className="px-3 py-2 text-slate-600 truncate max-w-[260px]">
                      {p.issues[0] || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
