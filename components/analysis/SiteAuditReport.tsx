"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle2, Info, ExternalLink,
  Globe, FileWarning, ChevronRight, Lightbulb, Activity, Zap,
} from "lucide-react";
import Gauge from "./Gauge";
import {
  AuditCategory,
  AuditPriority,
  AuditSeverity,
  SCORE_CATEGORY_META,
  SiteAuditFinding,
  SiteAuditPage,
  SiteAuditRun,
} from "@/app/c/analysis/audit-types";

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  technical: "Technical",
  on_page: "On-page",
  geo: "GEO",
  links: "Links",
  performance: "Performance",
};

const SEVERITY_TONE: Record<AuditSeverity, { bg: string; text: string; border: string; icon: typeof AlertCircle }> = {
  critical: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     icon: AlertCircle },
  warning:  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   icon: AlertTriangle },
  info:     { bg: "bg-slate-50",   text: "text-slate-700",   border: "border-slate-200",   icon: Info },
  success:  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2 },
};

const PRIORITY_TONE: Record<AuditPriority, string> = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-slate-100 text-slate-600",
};

export default function SiteAuditReport({ run }: { run: SiteAuditRun }) {
  const [tab, setTab] = useState<"overview" | "findings" | "pages" | "links">("overview");

  const tabs: { id: typeof tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "findings", label: "Findings", count: run.findings.length },
    { id: "pages", label: "Pages", count: run.summary.pages_analyzed },
    { id: "links", label: "Broken links", count: run.broken_links.length },
  ];

  return (
    <div className="space-y-6">
      <ReportHeader run={run} />

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "text-violet-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {t.count}
              </span>
            )}
            {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-violet-600 rounded-t-sm" />}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab run={run} />}
      {tab === "findings" && <FindingsTab findings={run.findings} />}
      {tab === "pages" && <PagesTab pages={run.pages} />}
      {tab === "links" && <BrokenLinksTab broken={run.broken_links} />}
    </div>
  );
}

/* ── Report header ────────────────────────────────────────────────────────── */

function ReportHeader({ run }: { run: SiteAuditRun }) {
  return (
    <section className="rounded-xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-violet-100 p-2">
            <Globe className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{run.domain}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {run.summary.pages_analyzed} pages analyzed
              {run.summary.total_pages_discovered > run.summary.pages_analyzed
                ? ` of ${run.summary.total_pages_discovered} discovered`
                : ""}
              {" · "}
              {(run.summary.audit_duration_ms / 1000).toFixed(1)}s
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Pill ok={run.summary.https} label="HTTPS" />
          <Pill ok={run.summary.has_robots_txt} label="robots.txt" />
          <Pill ok={run.summary.has_sitemap_xml} label="sitemap.xml" />
          <Pill ok={run.summary.has_llms_txt} label="llms.txt" tone="optional" />
        </div>
      </div>
    </section>
  );
}

function Pill({ ok, label, tone }: { ok: boolean; label: string; tone?: "optional" }) {
  const cls = ok
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : tone === "optional"
    ? "bg-slate-50 text-slate-500 border-slate-200"
    : "bg-rose-50 text-rose-700 border-rose-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${cls}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

/* ── Overview tab ─────────────────────────────────────────────────────────── */

function OverviewTab({ run }: { run: SiteAuditRun }) {
  const subScores: (keyof typeof run.scores)[] = [
    "technical_seo", "on_page_seo", "geo_readiness", "link_health", "performance",
  ];

  return (
    <div className="space-y-6">
      {/* Hero gauge + 5 subgauges */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[auto,1fr] lg:items-center">
          <div className="flex justify-center lg:justify-start">
            <Gauge
              score={run.scores.overall}
              label={SCORE_CATEGORY_META.overall.label}
              description={SCORE_CATEGORY_META.overall.description}
              size="lg"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {subScores.map((key) => (
              <Gauge
                key={key}
                score={run.scores[key]}
                label={SCORE_CATEGORY_META[key].label}
                description={SCORE_CATEGORY_META[key].description}
                size="sm"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid gap-4 sm:grid-cols-4">
        <Stat
          icon={Activity}
          label="Avg response time"
          value={`${run.summary.avg_response_ms} ms`}
        />
        <Stat
          icon={Zap}
          label="Pages analyzed"
          value={`${run.summary.pages_analyzed}`}
        />
        <Stat
          icon={ExternalLink}
          label="Links checked"
          value={`${run.summary.total_links_checked}`}
        />
        <Stat
          icon={FileWarning}
          label="Broken links"
          value={`${run.summary.broken_links_count}`}
          tone={run.summary.broken_links_count > 0 ? "rose" : "emerald"}
        />
      </section>

      {/* Top recommendations */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-slate-700">Top recommendations</h3>
        </div>
        {run.recommendations.length === 0 ? (
          <p className="text-sm text-slate-400">
            No actionable issues detected on the audited pages. Nice work.
          </p>
        ) : (
          <ul className="space-y-2">
            {run.recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3"
              >
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_TONE[rec.priority]}`}>
                  {rec.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{rec.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{rec.description}</p>
                </div>
                {rec.affected_count > 0 && (
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {rec.affected_count} affected
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-300 mt-0.5" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, tone = "slate",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "rose";
}) {
  const valueColor = tone === "emerald" ? "text-emerald-700"
    : tone === "rose" ? "text-rose-700"
    : "text-slate-900";
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}

/* ── Findings tab ─────────────────────────────────────────────────────────── */

function FindingsTab({ findings }: { findings: SiteAuditFinding[] }) {
  const grouped = useMemo(() => {
    const map = new Map<AuditCategory, SiteAuditFinding[]>();
    for (const f of findings) {
      const list = map.get(f.category) || [];
      list.push(f);
      map.set(f.category, list);
    }
    return map;
  }, [findings]);

  const order: AuditCategory[] = ["technical", "on_page", "geo", "links", "performance"];
  const sevOrder: Record<AuditSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-12 text-center text-slate-500">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
        <p className="text-sm">No findings — your site looks healthy on the audited pages.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {order.map((cat) => {
        const items = (grouped.get(cat) || []).slice().sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
        if (items.length === 0) return null;
        return (
          <section key={cat} className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-700">{CATEGORY_LABEL[cat]}</h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((f, i) => {
                const tone = SEVERITY_TONE[f.severity];
                const Icon = tone.icon;
                return (
                  <li key={i} className="flex items-start gap-3 px-5 py-3">
                    <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md ${tone.bg} ${tone.border} border`}>
                      <Icon className={`h-3.5 w-3.5 ${tone.text}`} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{f.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{f.description}</p>
                    </div>
                    {f.affected_pages > 0 && (
                      <span className="text-xs text-slate-400 whitespace-nowrap mt-0.5">
                        {f.affected_pages} {f.affected_pages === 1 ? "page" : "pages"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ── Pages tab ────────────────────────────────────────────────────────────── */

function PagesTab({ pages }: { pages: SiteAuditPage[] }) {
  if (pages.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-12 text-center text-slate-500">
        <p className="text-sm">No pages were audited.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-slate-50 min-w-[280px]">Page</th>
              <th className="text-center px-2 py-2 font-medium">Status</th>
              <th className="text-center px-2 py-2 font-medium">Title</th>
              <th className="text-center px-2 py-2 font-medium">Meta</th>
              <th className="text-center px-2 py-2 font-medium">H1</th>
              <th className="text-center px-2 py-2 font-medium">Words</th>
              <th className="text-center px-2 py-2 font-medium">Schema</th>
              <th className="text-center px-2 py-2 font-medium">Links</th>
              <th className="text-center px-2 py-2 font-medium">Issues</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-3 py-2 sticky left-0 bg-white max-w-[280px] truncate" title={p.url}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                     className="text-slate-700 hover:text-violet-700 inline-flex items-center gap-1">
                    {pathOf(p.url)}
                    <ExternalLink className="h-3 w-3 opacity-50 flex-shrink-0" />
                  </a>
                </td>
                <td className="px-2 py-2 text-center">
                  <StatusBadge code={p.status_code} />
                </td>
                <td className="px-2 py-2 text-center">
                  <LengthCell length={p.title_length} good={[30, 65]} unit="ch" />
                </td>
                <td className="px-2 py-2 text-center">
                  <LengthCell length={p.meta_description_length} good={[80, 165]} unit="ch" />
                </td>
                <td className="px-2 py-2 text-center">
                  <CountBadge value={p.h1_count} good={[1, 1]} />
                </td>
                <td className="px-2 py-2 text-center text-slate-600">{p.word_count}</td>
                <td className="px-2 py-2 text-center">
                  {p.has_schema ? (
                    <span className="text-emerald-600" title={p.schema_types.join(", ") || "schema present"}>
                      <CheckCircle2 className="h-4 w-4 inline" />
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center text-slate-600">
                  {p.internal_links}
                  <span className="text-slate-300"> / </span>
                  {p.external_links}
                </td>
                <td className="px-2 py-2 text-center">
                  {p.issues.length === 0 ? (
                    <span className="text-emerald-600"><CheckCircle2 className="h-4 w-4 inline" /></span>
                  ) : (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700"
                          title={p.issues.join(", ")}>
                      {p.issues.length}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? `${u.host}/` : u.pathname;
  } catch {
    return url;
  }
}

function StatusBadge({ code }: { code: number }) {
  if (code === 0) return <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">err</span>;
  const tone = code < 300 ? "bg-emerald-100 text-emerald-700"
    : code < 400 ? "bg-blue-100 text-blue-700"
    : "bg-rose-100 text-rose-700";
  return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}>{code}</span>;
}

function LengthCell({ length, good, unit }: { length: number; good: [number, number]; unit: string }) {
  if (length === 0) return <span className="text-rose-500" title="missing">—</span>;
  const inRange = length >= good[0] && length <= good[1];
  return (
    <span className={`text-[11px] ${inRange ? "text-emerald-700" : "text-amber-700"}`} title={`${length} ${unit}`}>
      {length}
    </span>
  );
}

function CountBadge({ value, good }: { value: number; good: [number, number] }) {
  const ok = value >= good[0] && value <= good[1];
  return (
    <span className={`text-[11px] font-semibold ${ok ? "text-emerald-700" : value === 0 ? "text-rose-600" : "text-amber-700"}`}>
      {value}
    </span>
  );
}

/* ── Broken links tab ─────────────────────────────────────────────────────── */

function BrokenLinksTab({ broken }: { broken: SiteAuditRun["broken_links"] }) {
  if (broken.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-12 text-center text-slate-500">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
        <p className="text-sm">No broken links detected in the audited sample.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Broken URL</th>
            <th className="text-left px-4 py-2 font-medium w-20">Status</th>
            <th className="text-left px-4 py-2 font-medium">Found on</th>
          </tr>
        </thead>
        <tbody>
          {broken.map((b, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-4 py-2">
                <a href={b.url} target="_blank" rel="noopener noreferrer"
                   className="text-slate-700 hover:text-violet-700 inline-flex items-center gap-1 max-w-[440px] truncate"
                   title={b.url}>
                  {b.url}
                  <ExternalLink className="h-3 w-3 opacity-50 flex-shrink-0" />
                </a>
              </td>
              <td className="px-4 py-2">
                <StatusBadge code={b.status_code} />
              </td>
              <td className="px-4 py-2 text-xs text-slate-500">
                {b.found_on.length === 0
                  ? "—"
                  : (
                    <span className="truncate inline-block max-w-[280px]" title={b.found_on.join("\n")}>
                      {pathOf(b.found_on[0])}
                      {b.found_on.length > 1 && ` +${b.found_on.length - 1} more`}
                    </span>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
