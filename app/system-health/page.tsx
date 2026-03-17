"use client";

import { useState, useEffect } from "react";
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Database, Globe, Clock, Cpu, Server,
} from "lucide-react";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

interface EndpointDetail {
  name: string;
  path: string;
  status_code: number;
  ok: boolean;
  critical?: boolean;
  error?: string;
}

interface TableDetail {
  table: string;
  exists: boolean;
  row_count?: number;
  error?: string;
}

interface JobDetail {
  job_id: string;
  last_run: string | null;
  last_status: string | null;
  last_error: string | null;
}

interface HealthReport {
  started_at: string;
  finished_at?: string;
  summary: {
    total_checks: number;
    passed: number;
    failed: number;
    health_pct: number;
    status: "healthy" | "degraded" | "unhealthy";
  };
  endpoints: {
    total: number;
    passed: number;
    failed: number;
    details: EndpointDetail[];
    errors: { name: string; path: string; status_code: number; error?: string }[];
  };
  database: {
    total: number;
    passed: number;
    failed: number;
    connected: boolean;
    tables: TableDetail[];
  };
  scheduler: {
    total: number;
    passed: number;
    failed: number;
    scheduler_running: boolean;
    jobs: JobDetail[];
  };
  event_bus: {
    connected: boolean;
    type?: string;
    error?: string;
  };
  agents: {
    total: number;
    importable: number;
    details: { module: string; ok: boolean; error?: string }[];
  };
}

const STATUS_STYLES = {
  healthy: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2 },
  degraded: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: AlertTriangle },
  unhealthy: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status as keyof typeof STATUS_STYLES] || STATUS_STYLES.unhealthy;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${s.bg} ${s.text} ${s.border} border`}>
      <Icon className="h-4 w-4" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, passed, total }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  passed?: number;
  total?: number;
}) {
  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {total !== undefined && passed !== undefined && (
          <span className={`text-xs font-medium ${passed === total ? "text-emerald-600" : "text-amber-600"}`}>
            {passed}/{total} passed
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function SystemHealthPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/dev-agent/health-check/latest`);
      if (res.ok) {
        const data = await res.json();
        if (data.summary) setReport(data);
        else if (data.report?.summary) setReport(data.report);
      }
    } catch { /* silent */ }
  };

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/dev-agent/health-check`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        setError(`Health check returned ${res.status}`);
      }
    } catch (e) {
      setError(`Failed to connect: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  const fmtTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "medium" });
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Health</h1>
          <p className="text-sm text-slate-500">Dev Agent — automated system diagnostics</p>
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Running..." : "Run Health Check"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!report && !loading && !error && (
        <div className="rounded-xl border bg-white p-12 text-center">
          <Activity className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-sm text-slate-500">No health check report available yet.</p>
          <button
            onClick={runCheck}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Run First Check
          </button>
        </div>
      )}

      {report && (
        <>
          {/* Summary Banner */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <StatusBadge status={report.summary.status} />
                  <span className="text-2xl font-bold text-slate-900">{report.summary.health_pct}%</span>
                </div>
                <ProgressBar pct={report.summary.health_pct} />
                <p className="mt-2 text-xs text-slate-500">
                  {report.summary.passed} of {report.summary.total_checks} checks passed
                  {report.started_at && ` · Last run: ${fmtTime(report.started_at)}`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{report.summary.passed}</p>
                  <p className="text-xs text-slate-500">Passed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{report.summary.failed}</p>
                  <p className="text-xs text-slate-500">Failed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-600">{report.summary.total_checks}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Endpoints */}
            <SectionCard
              title="API Endpoints"
              icon={Globe}
              passed={report.endpoints.passed}
              total={report.endpoints.total}
            >
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {report.endpoints.details.map((ep) => (
                  <div
                    key={ep.name}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                      ep.ok ? "bg-slate-50" : "bg-red-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {ep.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                      )}
                      <span className="font-medium text-slate-700 truncate">{ep.name}</span>
                      {ep.critical && (
                        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                          critical
                        </span>
                      )}
                    </div>
                    <span className={`font-mono ${ep.ok ? "text-slate-400" : "text-red-600"}`}>
                      {ep.status_code || "ERR"}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Database */}
            <SectionCard
              title="Database Tables"
              icon={Database}
              passed={report.database.passed}
              total={report.database.total}
            >
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {!report.database.connected && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    Database connection failed
                  </div>
                )}
                {report.database.tables.map((t) => (
                  <div
                    key={t.table}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                      t.exists ? "bg-slate-50" : "bg-red-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {t.exists ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span className="font-medium text-slate-700">{t.table}</span>
                    </div>
                    {t.exists ? (
                      <span className="text-slate-400">{t.row_count ?? "?"} rows</span>
                    ) : (
                      <span className="text-red-600">missing</span>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Scheduler */}
            <SectionCard
              title="Scheduled Jobs"
              icon={Clock}
              passed={report.scheduler.passed}
              total={report.scheduler.total}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    report.scheduler.scheduler_running ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                <span className="text-xs text-slate-600">
                  Scheduler {report.scheduler.scheduler_running ? "running" : "stopped"}
                </span>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {report.scheduler.jobs.map((j) => (
                  <div
                    key={j.job_id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                      j.last_status === "error" ? "bg-red-50" : "bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {j.last_status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      ) : j.last_status === "error" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      )}
                      <span className="font-medium text-slate-700 truncate">{j.job_id}</span>
                    </div>
                    <span className="text-slate-400 whitespace-nowrap ml-2">
                      {j.last_run ? fmtTime(j.last_run) : "never"}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Agents & Event Bus */}
            <SectionCard title="Agents & Infrastructure" icon={Cpu}>
              <div className="space-y-3">
                {/* Event Bus */}
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-slate-500" />
                    <span className="font-medium text-slate-700">Event Bus</span>
                  </div>
                  <span className={report.event_bus.connected ? "text-emerald-600" : "text-red-600"}>
                    {report.event_bus.connected ? report.event_bus.type : "disconnected"}
                  </span>
                </div>

                {/* Agent Imports */}
                <p className="text-xs font-medium text-slate-600 mt-3">
                  Agent Modules ({report.agents.importable}/{report.agents.total})
                </p>
                <div className="space-y-1.5">
                  {report.agents.details.map((a) => (
                    <div
                      key={a.module}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                        a.ok ? "bg-slate-50" : "bg-red-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {a.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                        <span className="font-medium text-slate-700">{a.module.replace("agents.", "")}</span>
                      </div>
                      {!a.ok && a.error && (
                        <span className="text-red-600 truncate max-w-[200px]" title={a.error}>
                          {a.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
