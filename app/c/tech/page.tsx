"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Code2, Loader2, Sparkles, AlertCircle, X, CheckCircle, ExternalLink,
  Github, ArrowRight, Settings, AlertTriangle, Info, Wrench, Copy, Check,
  FileDown, Eye,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";

interface TechSuggestion {
  title: string;
  description: string;
  file_hint?: string;
  change_type?: "edit" | "create";
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
}

export default function TechAgentPage() {
  const { user, loading: userLoading } = useUser();
  const { tenantClient, effectiveTenantId } = useSite();

  const [ghStatus, setGhStatus] = useState<GitHubStatus | null>(null);
  const [suggestions, setSuggestions] = useState<TechSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [auditFindings, setAuditFindings] = useState<AuditFinding[]>([]);
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
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

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
          run?: { findings?: AuditFinding[] };
          findings?: AuditFinding[];
        };
        setAuditFindings(data?.run?.findings || data?.findings || []);
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
      const res = await tenantClient.post<{ suggestions?: TechSuggestion[] }>(
        "/api/tech/suggest", {}
      );
      setSuggestions(res.suggestions || []);
      if ((res.suggestions || []).length === 0) setError("No suggestions returned. Please try again.");
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
        file_hint: pending.file_hint,
        change_type: pending.change_type,
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
        file_hint: s.file_hint,
        change_type: s.change_type,
      });
      setPreviewResult(res);
      // Add to export list if not already there
      setExportItems((prev) =>
        prev.find((i) => i.title === res.title) ? prev : [...prev, res]
      );
    } catch (err: any) {
      setPreviewError(err?.message || "Could not generate preview.");
    }
    setLoadingPreview(false);
  };

  const copyToClipboard = async (text: string, path: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const sendFindingToAgent = (finding: AuditFinding) => {
    const s: TechSuggestion = {
      title: finding.title,
      description: finding.description || finding.title,
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
            <p style={{ color: "#475569", marginBottom: "1rem", fontSize: "0.875rem" }}>
              {item.description}
            </p>
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
                  <div key={idx} className="rounded-xl border bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase text-slate-700">
                            {s.change_type === "create" ? "Create file" : "Edit"}
                          </span>
                          {s.file_hint && (
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{s.file_hint}</code>
                          )}
                        </div>
                        <p className="font-semibold text-slate-900">{s.title}</p>
                        <p className="text-sm text-slate-600 mt-1">{s.description}</p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <button
                          onClick={() => previewSuggestion(s)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Show code
                        </button>
                        {ghStatus?.connected && (
                          <button
                            onClick={() => setPending(s)}
                            className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                          >
                            Create PR
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
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
                </div>
                <button onClick={() => setPreviewing(null)} className="ml-4 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex-shrink-0">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto p-6">
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
                {previewResult && previewResult.files.map((f, i) => (
                  <div key={i} className={i > 0 ? "mt-6" : ""}>
                    <div className="flex items-center justify-between mb-2">
                      <code className="text-xs font-mono text-slate-600 bg-slate-100 rounded px-2 py-1">{f.path}</code>
                      <button
                        onClick={() => copyToClipboard(f.content, f.path)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        {copiedPath === f.path ? <><Check className="h-3.5 w-3.5 text-emerald-500" />Copied!</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
                      </button>
                    </div>
                    <pre className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed text-slate-800 max-h-96">
                      {f.content}
                    </pre>
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
