"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Code2, Loader2, Sparkles, AlertCircle, X, CheckCircle, ExternalLink,
  Github, ArrowRight, Settings, AlertTriangle, Info, Wrench,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { tenantApi } from "@/lib/api";

interface TechSuggestion {
  title: string;
  description: string;
  file_hint?: string;
  change_type?: "edit" | "create";
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
  const { tenantClient } = useSite();

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
    if (!user) return;
    try {
      const data = await tenantClient.get<GitHubStatus>("/api/integrations/github/status");
      setGhStatus(data);
    } catch {
      setGhStatus({ connected: false });
    }
  };

  const loadAuditFindings = async () => {
    if (!user) return;
    setLoadingAudit(true);
    try {
      const data = await tenantClient.get<{ run?: { findings?: AuditFinding[] }; findings?: AuditFinding[] }>(
        "/api/site-audit/latest"
      );
      const findings = data?.run?.findings || data?.findings || [];
      setAuditFindings(findings);
    } catch {
      // No audit data available yet
    }
    setLoadingAudit(false);
  };

  const loadSuggestions = async () => {
    if (!user) return;
    setLoadingSuggest(true);
    setError(null);
    try {
      const res = await tenantClient.post<{ suggestions?: TechSuggestion[]; github_connected?: boolean }>(
        "/api/tech/suggest", {}
      );
      setSuggestions(res.suggestions || []);
      if ((res.suggestions || []).length === 0) {
        setError("Inga förslag returnerades. Försök igen om en stund.");
      }
    } catch (err: any) {
      setError(err?.message || "Kunde inte hämta förslag.");
    }
    setLoadingSuggest(false);
  };

  const executeSuggestion = async () => {
    if (!user || !pending) return;
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
      setExecuteError(err?.message || "Kunde inte skapa PR.");
    }
    setExecuting(false);
  };

  const sendFindingToAgent = (finding: AuditFinding) => {
    setPending({
      title: finding.title,
      description: finding.description || finding.title,
    });
  };

  const severityIcon = (severity: AuditFinding["severity"]) => {
    if (severity === "critical") return <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    if (severity === "warning") return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    return <Info className="h-4 w-4 text-blue-400 flex-shrink-0" />;
  };

  const severityLabel = (severity: AuditFinding["severity"]) => {
    if (severity === "critical") return "Kritisk";
    if (severity === "warning") return "Varning";
    return "Info";
  };

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
              Tekniska fynd från analyser och AI-förslag som kan åtgärdas direkt via Pull Requests.
            </p>
          </div>
          <button
            onClick={loadSuggestions}
            disabled={loadingSuggest || !ghStatus?.connected}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50 shadow-sm transition-colors"
          >
            {loadingSuggest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loadingSuggest ? "Hämtar..." : suggestions.length > 0 ? "Hämta nya förslag" : "Föreslå förbättringar"}
          </button>
        </div>

        {/* GitHub status */}
        {!ghStatus?.connected ? (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-4">
              <Github className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">GitHub är inte anslutet</p>
                <p className="text-xs text-amber-800 mt-1">
                  Tech-agenten skriver alla ändringar som Pull Requests. Anslut din GitHub-token och välj ett repo i Settings för att börja.
                </p>
                <Link
                  href="/c/settings"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200 transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Gå till Settings
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div className="text-sm text-emerald-800">
              Ansluten till <span className="font-mono font-semibold">{ghStatus.repo || "(repo)"}</span>
              {ghStatus.branch && <> · branch <span className="font-mono">{ghStatus.branch}</span></>}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Audit findings from Insikter */}
        {loadingAudit ? (
          <div className="mb-8 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Hämtar fynd från senaste analys...
          </div>
        ) : auditFindings.length > 0 ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-500" />
                Fynd från senaste analys
              </h2>
              <Link href="/c/analysis" className="text-xs text-blue-600 hover:underline">
                Visa i Insikter →
              </Link>
            </div>

            {criticalFindings.length > 0 && (
              <div className="mb-3 space-y-2">
                {criticalFindings.map((finding, idx) => (
                  <div key={idx} className="rounded-xl border border-red-100 bg-red-50 p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {severityIcon(finding.severity)}
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-red-600 uppercase mr-2">{severityLabel(finding.severity)}</span>
                        {finding.category && (
                          <span className="text-xs text-red-400 mr-2">{finding.category}</span>
                        )}
                        <p className="text-sm font-medium text-slate-900 mt-0.5">{finding.title}</p>
                        {finding.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{finding.description}</p>
                        )}
                      </div>
                    </div>
                    {ghStatus?.connected && (
                      <button
                        onClick={() => sendFindingToAgent(finding)}
                        className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                      >
                        Åtgärda med PR
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {otherFindings.length > 0 && (
              <div className="space-y-2">
                {otherFindings.map((finding, idx) => (
                  <div key={idx} className="rounded-xl border bg-white p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {severityIcon(finding.severity)}
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-500 uppercase mr-2">{severityLabel(finding.severity)}</span>
                        {finding.category && (
                          <span className="text-xs text-slate-400 mr-2">{finding.category}</span>
                        )}
                        <p className="text-sm font-medium text-slate-900 mt-0.5">{finding.title}</p>
                        {finding.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{finding.description}</p>
                        )}
                      </div>
                    </div>
                    {ghStatus?.connected && (
                      <button
                        onClick={() => sendFindingToAgent(finding)}
                        className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors"
                      >
                        Åtgärda med PR
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-8 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <Wrench className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Inga fynd från analyser ännu.</p>
            <Link href="/c/analysis" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
              Kör en analys i Insikter →
            </Link>
          </div>
        )}

        {/* Recent PRs */}
        {results.length > 0 && (
          <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">Senast skapade Pull Requests</h2>
            <ul className="space-y-2">
              {results.map((r) => (
                <li key={r.pr_url} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.branch}</p>
                    <p className="text-xs text-slate-500">{r.files_changed.length} fil(er)</p>
                  </div>
                  <a
                    href={r.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    Öppna PR <ExternalLink className="h-3 w-3" />
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
              AI-förslag
            </h2>
            <div className="space-y-3">
              {suggestions.map((s, idx) => (
                <div key={idx} className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase text-slate-700">
                          {s.change_type === "create" ? "Skapa fil" : "Redigera"}
                        </span>
                        {s.file_hint && (
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{s.file_hint}</code>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900">{s.title}</p>
                      <p className="text-sm text-slate-600 mt-1">{s.description}</p>
                    </div>
                    <button
                      onClick={() => setPending(s)}
                      disabled={!ghStatus?.connected}
                      className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                    >
                      Skapa PR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmation modal */}
        {pending && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => !executing && setPending(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="relative w-full max-w-lg rounded-2xl border bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-slate-700" />
                    Skapa Pull Request
                  </h3>
                  <button
                    onClick={() => !executing && setPending(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-4">
                  <p className="font-semibold text-slate-900 text-sm">{pending.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{pending.description}</p>
                  {pending.file_hint && (
                    <p className="text-xs text-slate-500 mt-2 font-mono">{pending.file_hint}</p>
                  )}
                </div>

                <p className="text-sm text-slate-600 mb-4">
                  Vill du att Tech-agenten genererar ändringen och öppnar en Pull Request mot{" "}
                  <span className="font-mono">{ghStatus?.branch || "main"}</span>?
                  Inget merges automatiskt — du granskar och godkänner i GitHub.
                </p>

                {executeError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {executeError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPending(null)}
                    disabled={executing}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={executeSuggestion}
                    disabled={executing}
                    className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
                  >
                    {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    {executing ? "Skapar PR..." : "Skapa PR"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
