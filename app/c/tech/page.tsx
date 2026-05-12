"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Code2, Loader2, Sparkles, AlertCircle, X, CheckCircle, ExternalLink,
  Github, ArrowRight, Settings, AlertTriangle, Info, Wrench,
  FileDown, Eye,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import CodeBlock, { type CodeBlockLanguage } from "@/components/tech/CodeBlock";

interface TechSuggestion {
  title: string;
  description: string;
  rationale?: string | null;
  target_url?: string | null;
  file_hint?: string | null;
  change_type?: "edit" | "create" | "delete";
  language?: CodeBlockLanguage;
  current_snippet?: string | null;
  suggested_snippet?: string | null;
  finding_ref?: string | null;
  impact?: "low" | "medium" | "high" | null;
  effort?: "low" | "medium" | "high" | null;
}

interface FileChange {
  path: string;
  content: string;
}

interface PreviewResult {
  title: string;
  description: string;
  files: FileChange[];
  summary: string;
  // Echo of the snippet that produced this preview, when applicable —
  // exposed in the PDF so the customer's developer sees the before state
  // alongside the new file content.
  current_snippet?: string | null;
  suggested_snippet?: string | null;
  target_url?: string | null;
  language?: CodeBlockLanguage;
}

interface ExecuteResult {
  pr_url: string;
  branch: string;
  files_changed: string[];
}

interface GitHubStatus {
  connected: boolean;
  repo?: string;
  branch?: string;
}

interface AuditFinding {
  title: string;
  severity: "critical" | "warning" | "info";
  category?: string;
  description?: string;
  affected_urls?: string[];
  how_to_fix?: string | null;
}

interface SuggestResponse {
  suggestions?: TechSuggestion[];
  github_connected?: boolean;
  degraded?: boolean;
  audit_id?: string | null;
  error?: string;
}

const IMPACT_TONE: Record<NonNullable<TechSuggestion["impact"]>, string> = {
  high: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  low: "bg-slate-50 text-slate-600 border border-slate-200",
};

const EFFORT_TONE: Record<NonNullable<TechSuggestion["effort"]>, string> = {
  low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  high: "bg-rose-50 text-rose-700 border border-rose-200",
};

export default function TechAgentPage() {
  const { user, loading: userLoading } = useUser();
  const { tenantClient, effectiveTenantId } = useSite();

  const [ghStatus, setGhStatus] = useState<GitHubStatus | null>(null);
  const [suggestions, setSuggestions] = useState<TechSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);

  const [auditFindings, setAuditFindings] = useState<AuditFinding[]>([]);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [pending, setPending] = useState<TechSuggestion | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [results, setResults] = useState<ExecuteResult[]>([]);

  // Manual / preview mode
  const [previewing, setPreviewing] = useState<TechSuggestion | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // PDF export: accumulate previewed items
  const [exportItems, setExportItems] = useState<PreviewResult[]>([]);

  useEffect(() => {
    if (user) {
      loadGhStatus();
      loadAuditFindings();
    }
  }, [user]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const loadGhStatus = async () => {
    try {
      const data = await tenantClient.get<GitHubStatus>("/api/integrations/github/status");
      setGhStatus(data);
    } catch {
      setGhStatus({ connected: false });
    }
  };

  const loadAuditFindings = async () => {
    setLoadingAudit(true);
    try {
      // Hits the local Next.js route (always 200) — bypasses tenantClient so
      // we don't reach the backend at NEXT_PUBLIC_SAMA_API_URL, which doesn't
      // implement /latest and used to flood the console with 404s.
      const res = await fetch("/api/site-audit/latest", {
        headers: effectiveTenantId ? { "X-Tenant-ID": effectiveTenantId } : {},
      });
      if (res.ok) {
        const data = (await res.json()) as {
          run?: { id?: string; findings?: AuditFinding[] };
          findings?: AuditFinding[];
          id?: string;
        };
        setAuditFindings(data?.run?.findings || data?.findings || []);
        setAuditId(data?.run?.id || data?.id || null);
      }
    } catch {
      // no audit data yet
    }
    setLoadingAudit(false);
  };

  const loadSuggestions = async () => {
    setLoadingSuggest(true);
    setError(null);
    try {
      const res = await tenantClient.post<SuggestResponse>(
        "/api/tech/suggest",
        // Anchor the prompt to the audit run we just loaded so Claude can
        // quote real page contents instead of inventing brand-themed advice.
        auditId ? { audit_id: auditId } : {},
      );
      setSuggestions(res.suggestions || []);
      setDegraded(Boolean(res.degraded));
      if ((res.suggestions || []).length === 0) {
        setError(res.error || "No suggestions returned. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Could not fetch suggestions.");
    }
    setLoadingSuggest(false);
  };

  const executeSuggestion = async () => {
    if (!pending) return;
    setExecuting(true);
    setExecuteError(null);
    try {
      const res = await tenantClient.post<ExecuteResult>("/api/tech/execute", {
        title: pending.title,
        description: pending.description,
        file_hint: pending.file_hint || undefined,
        change_type: pending.change_type,
        // Forwarding these lets the backend splice the snippet into the
        // existing file deterministically — no second Claude call.
        target_url: pending.target_url || undefined,
        language: pending.language,
        current_snippet: pending.current_snippet || undefined,
        suggested_snippet: pending.suggested_snippet || undefined,
      });
      setResults((prev) => [res, ...prev]);
      setSuggestions((prev) => prev.filter((s) => s !== pending));
      setPending(null);
    } catch (err: any) {
      setExecuteError(err?.message || "Could not create PR.");
    }
    setExecuting(false);
  };

  const previewSuggestion = async (s: TechSuggestion) => {
    setPreviewing(s);
    setPreviewResult(null);
    setPreviewError(null);
    setLoadingPreview(true);
    try {
      const res = await tenantClient.post<PreviewResult>("/api/tech/preview", {
        title: s.title,
        description: s.description,
        file_hint: s.file_hint || undefined,
        change_type: s.change_type,
        target_url: s.target_url || undefined,
        language: s.language,
        current_snippet: s.current_snippet || undefined,
        suggested_snippet: s.suggested_snippet || undefined,
      });
      // Backend doesn't echo the snippets back, so attach them client-side
      // so the PDF export can show the before/after pair.
      const enriched: PreviewResult = {
        ...res,
        current_snippet: s.current_snippet ?? null,
        suggested_snippet: s.suggested_snippet ?? null,
        target_url: s.target_url ?? null,
        language: s.language,
      };
      setPreviewResult(enriched);
      setExportItems((prev) =>
        prev.find((i) => i.title === enriched.title) ? prev : [...prev, enriched]
      );
    } catch (err: any) {
      setPreviewError(err?.message || "Could not generate preview.");
    }
    setLoadingPreview(false);
  };

  const sendFindingToAgent = (finding: AuditFinding) => {
    // Promote the audit finding into a suggestion shell so the existing
    // execute/preview flow can pick it up. The backend will splice in
    // the how_to_fix template when generating the file change.
    const s: TechSuggestion = {
      title: finding.title,
      description: finding.description || finding.how_to_fix || finding.title,
      target_url: finding.affected_urls?.[0] ?? null,
    };
    if (ghStatus?.connected) {
      setPending(s);
    } else {
      previewSuggestion(s);
    }
  };

  const exportToPdf = () => {
    window.print();
  };

  const severityIcon = (severity: AuditFinding["severity"]) => {
    if (severity === "critical") return <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    if (severity === "warning") return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    return <Info className="h-4 w-4 text-blue-400 flex-shrink-0" />;
  };

  const severityLabel = (s: AuditFinding["severity"]) =>
    s === "critical" ? "Critical" : s === "warning" ? "Warning" : "Info";

  const criticalFindings = auditFindings.filter((f) => f.severity === "critical");
  const otherFindings = auditFindings.filter((f) => f.severity !== "critical");

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print stylesheet.
          We can't use `display: none` on body's children to hide everything
          except #pdf-export — Next.js nests #pdf-export deep inside several
          wrapper divs, and `display: none` on any ancestor prevents the
          descendant from rendering at all (the result is a blank page).
          `visibility: hidden` lets descendants opt back in with
          `visibility: visible`, even when their ancestors are hidden. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #pdf-export, #pdf-export * { visibility: visible !important; }
          #pdf-export {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            font-family: system-ui, sans-serif;
            padding: 2rem;
          }
        }
        @media screen {
          #pdf-export { display: none; }
        }
      `}</style>

      {/* PDF export document (hidden on screen, visible on print) */}
      <div id="pdf-export">
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
          Technical actions – SAMA
        </h1>
        <p style={{ color: "#64748b", marginBottom: "2rem", fontSize: "0.875rem" }}>
          Generated {new Date().toLocaleDateString()}
        </p>
        {exportItems.map((item, i) => (
          <div key={i} style={{ marginBottom: "2rem", pageBreakInside: "avoid" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.25rem" }}>
              {i + 1}. {item.title}
            </h2>
            <p style={{ color: "#475569", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
              {item.description}
            </p>
            {item.target_url && (
              <p style={{ color: "#7c3aed", marginBottom: "1rem", fontSize: "0.75rem" }}>
                Page: {item.target_url}
              </p>
            )}
            {item.current_snippet && (
              <div style={{ marginBottom: "0.75rem" }}>
                <p style={{ fontWeight: 600, fontSize: "0.75rem", color: "#475569", marginBottom: "0.25rem" }}>
                  Before (current code)
                </p>
                <pre style={{
                  background: "#fff1f2", border: "1px solid #fecdd3",
                  borderRadius: "0.375rem", padding: "0.75rem",
                  fontSize: "0.7rem", whiteSpace: "pre-wrap", wordBreak: "break-all",
                }}>
                  {item.current_snippet}
                </pre>
              </div>
            )}
            {item.suggested_snippet && (
              <div style={{ marginBottom: "0.75rem" }}>
                <p style={{ fontWeight: 600, fontSize: "0.75rem", color: "#065f46", marginBottom: "0.25rem" }}>
                  After (paste this)
                </p>
                <pre style={{
                  background: "#ecfdf5", border: "1px solid #a7f3d0",
                  borderRadius: "0.375rem", padding: "0.75rem",
                  fontSize: "0.7rem", whiteSpace: "pre-wrap", wordBreak: "break-all",
                }}>
                  {item.suggested_snippet}
                </pre>
              </div>
            )}
            {item.files.map((f, fi) => (
              <div key={fi} style={{ marginBottom: "1rem" }}>
                <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                  📄 {f.path}
                </p>
                <pre style={{
                  background: "#f8fafc", border: "1px solid #e2e8f0",
                  borderRadius: "0.375rem", padding: "1rem",
                  fontSize: "0.7rem", whiteSpace: "pre-wrap", wordBreak: "break-all",
                  maxHeight: "400px", overflow: "hidden",
                }}>
                  {f.content}
                </pre>
              </div>
            ))}
          </div>
        ))}
        {exportItems.length === 0 && (
          <p style={{ color: "#94a3b8" }}>
            No previewed changes yet. Click "Show code" on a suggestion and then export.
          </p>
        )}
      </div>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />

        <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Code2 className="h-7 w-7 text-slate-700" />
                Tech
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Technical findings and improvement suggestions for your website.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {exportItems.length > 0 && (
                <button
                  onClick={exportToPdf}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  <FileDown className="h-4 w-4" />
                  Export PDF ({exportItems.length})
                </button>
              )}
              <button
                onClick={loadSuggestions}
                disabled={loadingSuggest}
                className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50 shadow-sm transition-colors"
              >
                {loadingSuggest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loadingSuggest ? "Fetching..." : suggestions.length > 0 ? "Fetch new suggestions" : "Suggest improvements"}
              </button>
            </div>
          </div>

          {/* GitHub status */}
          {!ghStatus?.connected ? (
            <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-4">
                <Github className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">GitHub is not connected — manual mode active</p>
                  <p className="text-xs text-amber-800 mt-1">
                    You can still preview every code change and export it as a PDF to share with your developer.
                    Connect GitHub in Settings to open Pull Requests automatically.
                  </p>
                  <Link
                    href="/c/settings"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200 transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Connect GitHub
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div className="text-sm text-emerald-800">
                Connected to <span className="font-mono font-semibold">{ghStatus.repo}</span>
                {ghStatus.branch && <> · branch <span className="font-mono">{ghStatus.branch}</span></>}
              </div>
            </div>
          )}

          {/* Degraded banner — surfaces when /suggest couldn't ground itself
              against an audit run. The new onboarding flow always seeds one
              so this is a rare-but-possible state. */}
          {degraded && suggestions.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 flex items-start gap-2">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                These suggestions are generic — we couldn't find a recent site audit to ground them.{" "}
                <Link href="/c/analysis" className="font-semibold underline hover:text-amber-900">
                  Run a site analysis
                </Link>{" "}
                for site-specific suggestions with paste-ready code.
              </span>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* Audit findings */}
          {loadingAudit ? (
            <div className="mb-8 flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching findings from the latest analysis...
            </div>
          ) : auditFindings.length > 0 ? (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-slate-500" />
                  Findings from the latest analysis
                </h2>
                <Link href="/c/analysis" className="text-xs text-blue-600 hover:underline">
                  View in Insights →
                </Link>
              </div>
              <div className="space-y-2">
                {[...criticalFindings, ...otherFindings].map((finding, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${
                      finding.severity === "critical" ? "border-red-100 bg-red-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {severityIcon(finding.severity)}
                      <div className="min-w-0">
                        <span className={`text-xs font-semibold uppercase mr-2 ${
                          finding.severity === "critical" ? "text-red-600" : "text-slate-500"
                        }`}>{severityLabel(finding.severity)}</span>
                        {finding.category && <span className="text-xs text-slate-400 mr-2">{finding.category}</span>}
                        <p className="text-sm font-medium text-slate-900 mt-0.5">{finding.title}</p>
                        {finding.description && <p className="text-xs text-slate-500 mt-0.5">{finding.description}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => sendFindingToAgent(finding)}
                      className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        ghStatus?.connected
                          ? "bg-slate-800 hover:bg-slate-900 text-white"
                          : "border border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {ghStatus?.connected ? "Fix with PR" : <><Eye className="h-3.5 w-3.5" />Show code</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-8 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
              <Wrench className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No findings from analyses yet.</p>
              <Link href="/c/analysis" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                Run an analysis in Insights →
              </Link>
            </div>
          )}

          {/* Recent PRs */}
          {results.length > 0 && (
            <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-4">Recently created Pull Requests</h2>
              <ul className="space-y-2">
                {results.map((r) => (
                  <li key={r.pr_url} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.branch}</p>
                      <p className="text-xs text-slate-500">{r.files_changed.length} file(s)</p>
                    </div>
                    <a href={r.pr_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
                      Open PR <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-slate-500" />
                AI suggestions
              </h2>
              <div className="space-y-3">
                {suggestions.map((s, idx) => (
                  <SuggestionCard
                    key={idx}
                    suggestion={s}
                    githubConnected={!!ghStatus?.connected}
                    onPreview={() => previewSuggestion(s)}
                    onCreatePR={() => setPending(s)}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* GitHub PR confirmation modal */}
      {pending && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => !executing && setPending(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg rounded-2xl border bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-slate-700" />
                  Create Pull Request
                </h3>
                <button onClick={() => !executing && setPending(null)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-4">
                <p className="font-semibold text-slate-900 text-sm">{pending.title}</p>
                <p className="text-xs text-slate-600 mt-1">{pending.description}</p>
                {pending.target_url && (
                  <p className="mt-2 text-xs text-violet-600 break-all">{pending.target_url}</p>
                )}
                {pending.file_hint && <p className="text-xs text-slate-500 mt-2 font-mono">{pending.file_hint}</p>}
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Opens a Pull Request against <span className="font-mono">{ghStatus?.branch || "main"}</span>. Nothing is merged automatically.
              </p>
              {executeError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{executeError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setPending(null)} disabled={executing} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={executeSuggestion} disabled={executing} className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {executing ? "Creating PR..." : "Create PR"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Preview / Manual mode modal */}
      {previewing && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => !loadingPreview && setPreviewing(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-3xl rounded-2xl border bg-white shadow-xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              {/* Modal header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-slate-700 flex-shrink-0" />
                    {previewing.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">{previewing.description}</p>
                  {previewing.target_url && (
                    <a href={previewing.target_url} target="_blank" rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline break-all">
                      {previewing.target_url}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  )}
                </div>
                <button onClick={() => setPreviewing(null)} className="ml-4 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex-shrink-0">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingPreview && (
                  <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Generating code suggestions...</span>
                  </div>
                )}
                {previewError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />{previewError}
                  </div>
                )}
                {previewing.current_snippet && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-700">Current code</p>
                    <CodeBlock
                      code={previewing.current_snippet}
                      language={previewing.language}
                      copyKey="preview-current"
                      tone="danger"
                    />
                  </div>
                )}
                {previewing.suggested_snippet && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">Replace with</p>
                    <CodeBlock
                      code={previewing.suggested_snippet}
                      language={previewing.language}
                      copyKey="preview-suggested"
                      tone="success"
                    />
                  </div>
                )}
                {previewResult && previewResult.files.map((f, i) => (
                  <div key={i}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Full file
                    </p>
                    <CodeBlock
                      code={f.content}
                      label={f.path}
                      language={inferLanguage(f.path)}
                      copyKey={`preview-file-${i}`}
                      maxHeightClass="max-h-96"
                    />
                  </div>
                ))}
              </div>

              {/* Modal footer */}
              {previewResult && (
                <div className="border-t p-4 flex items-center justify-between gap-3 bg-slate-50 rounded-b-2xl">
                  <p className="text-xs text-slate-500">
                    {exportItems.find((i) => i.title === previewResult.title)
                      ? "✓ Added to PDF export"
                      : "Click 'Export PDF' to include in the report"}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportToPdf}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Export PDF
                    </button>
                    {ghStatus?.connected && (
                      <button
                        onClick={() => { setPreviewing(null); setPending(previewing); }}
                        className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                      >
                        Create PR instead
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Single suggestion row. Pulled out so the surrounding page logic stays
 * readable — each card is a richer block now (URL pill, impact/effort
 * badges, collapsible before/after snippets) than the old title-only design.
 */
function SuggestionCard({
  suggestion,
  githubConnected,
  onPreview,
  onCreatePR,
}: {
  suggestion: TechSuggestion;
  githubConnected: boolean;
  onPreview: () => void;
  onCreatePR: () => void;
}) {
  const s = suggestion;
  const hasSnippets = !!(s.current_snippet || s.suggested_snippet);
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase text-slate-700">
              {s.change_type === "create" ? "Create file" : s.change_type === "delete" ? "Delete" : "Edit"}
            </span>
            {s.file_hint && (
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{s.file_hint}</code>
            )}
            {s.target_url && (
              <a
                href={s.target_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100 max-w-xs truncate"
                title={s.target_url}
              >
                {prettyUrl(s.target_url)}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            )}
            {s.impact && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${IMPACT_TONE[s.impact]}`}>
                {s.impact} impact
              </span>
            )}
            {s.effort && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${EFFORT_TONE[s.effort]}`}>
                {s.effort} effort
              </span>
            )}
          </div>
          <p className="font-semibold text-slate-900">{s.title}</p>
          <p className="text-sm text-slate-600 mt-1">{s.description}</p>
          {s.rationale && (
            <p className="text-xs text-slate-400 mt-1 italic">{s.rationale}</p>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            onClick={onPreview}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            Show code
          </button>
          {githubConnected && (
            <button
              onClick={onCreatePR}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              Create PR
            </button>
          )}
        </div>
      </div>
      {hasSnippets && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 select-none">
            Show before / after code
          </summary>
          <div className="mt-3 space-y-3">
            {s.current_snippet && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-700">Current code</p>
                <CodeBlock
                  code={s.current_snippet}
                  language={s.language}
                  copyKey={`s-current-${s.title}`}
                  tone="danger"
                  maxHeightClass="max-h-48"
                />
              </div>
            )}
            {s.suggested_snippet && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Replace with</p>
                <CodeBlock
                  code={s.suggested_snippet}
                  language={s.language}
                  copyKey={`s-suggested-${s.title}`}
                  tone="success"
                  maxHeightClass="max-h-48"
                />
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

/** Trim the URL down to host+path so the pill doesn't spill across the row. */
function prettyUrl(u: string): string {
  try {
    const parsed = new URL(u);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.host}${path}`;
  } catch {
    return u;
  }
}

/** Best-effort language tag from a file extension — the CodeBlock is
 * dependency-free today, but storing the tag lets us light up syntax
 * highlighting later without revisiting every call site. */
function inferLanguage(path: string): CodeBlockLanguage {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
    case "htm":
      return "html";
    case "tsx":
      return "tsx";
    case "jsx":
      return "jsx";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "md":
    case "mdx":
      return "md";
    case "txt":
      return "text";
    default:
      return "other";
  }
}
