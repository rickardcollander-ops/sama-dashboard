"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle2, Info, ExternalLink,
  Globe, FileWarning, Lightbulb, Activity, Zap,
  Search as SearchIcon, Rocket, Hammer, Eye, Target,
} from "lucide-react";
import Gauge from "./Gauge";
import {
  AuditCategory,
  AuditPriority,
  AuditSeverity,
  KEYWORD_INTENT_META,
  KeywordIntent,
  KeywordOpportunities,
  KeywordOpportunity,
  RECOMMENDATION_GROUP_META,
  RecommendationGroup,
  SCORE_CATEGORY_META,
  SiteAuditFinding,
  SiteAuditPage,
  SiteAuditRecommendation,
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

type AuditTab = "overview" | "findings" | "keywords" | "pages" | "links";

export default function SiteAuditReport({ run }: { run: SiteAuditRun }) {
  const [tab, setTab] = useState<AuditTab>("overview");

  const unreachable = run.summary.reachable === false
    || (typeof run.summary.pages_loaded === "number"
        && run.summary.pages_loaded === 0
        && run.summary.pages_analyzed > 0);

  const kw = run.keyword_opportunities || null;
  const kwCount = kw ? kw.opportunities.length : 0;

  const tabs: { id: AuditTab; label: string; count?: number; show: boolean }[] = [
    { id: "overview",  label: "Overview",      show: true },
    { id: "findings",  label: "Findings",      count: run.findings.length, show: true },
    // Only show the keywords tab when the agent produced data — otherwise it
    // would render an empty section that signals nothing useful to the user.
    { id: "keywords",  label: "Keywords",      count: kwCount, show: !!kw && kwCount > 0 },
    { id: "pages",     label: "Pages",         count: run.summary.pages_analyzed, show: true },
    { id: "links",     label: "Broken links",  count: run.broken_links.length, show: true },
  ];

  return (
    <div className="space-y-6">
      <ReportHeader run={run} unreachable={unreachable} />

      {unreachable && <UnreachableBanner run={run} />}

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.filter((t) => t.show).map((t) => (
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

      {tab === "overview" && <OverviewTab run={run} unreachable={unreachable} />}
      {tab === "findings" && <FindingsTab findings={run.findings} />}
      {tab === "keywords" && kw && <KeywordsTab data={kw} />}
      {tab === "pages" && <PagesTab pages={run.pages} />}
      {tab === "links" && <BrokenLinksTab broken={run.broken_links} />}
    </div>
  );
}

function UnreachableBanner({ run }: { run: SiteAuditRun }) {
  const meta = run.summary.meta_files || {};
  const diagnostics: string[] = [];
  for (const [label, info] of [
    ["robots.txt", meta.robots_txt],
    ["sitemap.xml", meta.sitemap_xml],
    ["llms.txt", meta.llms_txt],
  ] as const) {
    if (!info) continue;
    const samples = info.attempts && info.attempts.length > 0 ? info.attempts : [info];
    for (const s of samples) {
      if (s.error) { diagnostics.push(`${label}: ${s.error}`); break; }
      if (typeof s.status === "number" && s.status >= 500) {
        diagnostics.push(`${label}: HTTP ${s.status}`);
        break;
      }
    }
  }
  const uniqueDiagnostics = Array.from(new Set(diagnostics));

  return (
    <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-rose-100">
          <AlertCircle className="h-5 w-5 text-rose-700" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-rose-900">
            We couldn&rsquo;t reach {run.domain}
          </h3>
          <p className="mt-1 text-xs text-rose-800/90 leading-relaxed">
            Every audited URL failed to load, so the scores below have nothing
            to measure against. Confirm the domain is correct and publicly
            reachable over HTTPS, then re-run the audit.
          </p>
          {uniqueDiagnostics.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-rose-700/80 font-mono">
              {uniqueDiagnostics.map((d, i) => (
                <li key={i}>· {d}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Report header ────────────────────────────────────────────────────────── */

function ReportHeader({ run, unreachable }: { run: SiteAuditRun; unreachable: boolean }) {
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
          <Pill ok={run.summary.https} label="HTTPS" unknown={unreachable} />
          <Pill ok={run.summary.has_robots_txt} label="robots.txt" unknown={unreachable} />
          <Pill ok={run.summary.has_sitemap_xml} label="sitemap.xml" unknown={unreachable} />
          <Pill ok={run.summary.has_llms_txt} label="llms.txt" tone="optional" unknown={unreachable} />
        </div>
      </div>
    </section>
  );
}

function Pill({ ok, label, tone, unknown }: { ok: boolean; label: string; tone?: "optional"; unknown?: boolean }) {
  if (unknown) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium bg-slate-50 text-slate-400 border-slate-200"
            title="Not checked — site was unreachable">
        <Info className="h-3 w-3" />
        {label}
      </span>
    );
  }
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

function OverviewTab({ run, unreachable }: { run: SiteAuditRun; unreachable?: boolean }) {
  const subScores: (keyof typeof run.scores)[] = [
    "technical_seo", "on_page_seo", "geo_readiness", "link_health", "performance",
  ];

  return (
    <div className="space-y-6">
      {/* Hero gauge + 5 subgauges — hidden when unreachable since they'd be
          meaningless against a site that didn't actually load. */}
      {!unreachable && (
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
      )}

      {/* Quick stats */}
      <section className="grid gap-4 sm:grid-cols-4">
        <Stat
          icon={Activity}
          label="Avg response time"
          value={unreachable ? "—" : `${run.summary.avg_response_ms} ms`}
        />
        <Stat
          icon={Zap}
          label={unreachable ? "Pages reached" : "Pages analyzed"}
          value={
            unreachable
              ? `0 / ${run.summary.pages_analyzed}`
              : `${run.summary.pages_analyzed}`
          }
          tone={unreachable ? "rose" : "slate"}
        />
        <Stat
          icon={ExternalLink}
          label="Links checked"
          value={unreachable ? "—" : `${run.summary.total_links_checked}`}
        />
        <Stat
          icon={FileWarning}
          label="Broken links"
          value={unreachable ? "—" : `${run.summary.broken_links_count}`}
          tone={unreachable ? "slate" : run.summary.broken_links_count > 0 ? "rose" : "emerald"}
        />
      </section>

      {/* Recommendations grouped by execution profile */}
      <RecommendationsGrouped run={run} />
    </div>
  );
}

/* ── Grouped recommendations (Quick wins / Strategic / Technical debt / Monitoring) ─── */

const GROUP_ORDER: RecommendationGroup[] = ["quick_win", "strategic", "technical_debt", "monitoring"];
const GROUP_ICON: Record<RecommendationGroup, typeof Rocket> = {
  quick_win:      Rocket,
  strategic:      Target,
  technical_debt: Hammer,
  monitoring:     Eye,
};
const IMPACT_TONE: Record<string, string> = {
  high:   "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-slate-100 text-slate-600",
};

function RecommendationsGrouped({ run }: { run: SiteAuditRun }) {
  // If the backend didn't supply grouped recs (older agent versions), derive
  // the buckets client-side from the flat recommendations[] using each
  // recommendation's `group` field; default to technical_debt.
  const grouped = useMemo(() => {
    if (run.recommendation_groups) return run.recommendation_groups;
    const out: Partial<Record<RecommendationGroup, SiteAuditRecommendation[]>> = {};
    for (const r of run.recommendations || []) {
      const g = (r.group || "technical_debt") as RecommendationGroup;
      (out[g] ||= []).push(r);
    }
    return out;
  }, [run]);

  const totalActionable = (run.recommendations || []).filter(
    (r) => (r.group || "technical_debt") !== "monitoring"
  ).length;

  if (totalActionable === 0) {
    return (
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-slate-700">Recommendations</h3>
        </div>
        <p className="text-sm text-slate-400">
          No actionable issues detected on the audited pages. Nice work.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-slate-700">Recommendations</h3>
        <span className="ml-1 text-xs text-slate-400">{totalActionable} total</span>
      </div>

      {GROUP_ORDER.map((g) => {
        const items = grouped[g] || [];
        if (items.length === 0) return null;
        const Icon = GROUP_ICON[g];
        const meta = RECOMMENDATION_GROUP_META[g];
        return (
          <div key={g} className="rounded-lg border border-slate-100 bg-slate-50/40">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-white rounded-t-lg">
              <Icon className="h-4 w-4 text-violet-600" />
              <h4 className="text-sm font-semibold text-slate-800">{meta.label}</h4>
              <span className="text-xs text-slate-400">· {meta.description}</span>
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {items.length}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((rec, i) => (
                <RecommendationRow key={i} rec={rec} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function RecommendationRow({ rec }: { rec: SiteAuditRecommendation }) {
  const [open, setOpen] = useState(false);
  const hasExamples = !!(rec.examples && rec.examples.length > 0);
  const hasDetail = !!(
    rec.how_to_fix ||
    hasExamples ||
    (rec.affected_urls && rec.affected_urls.length > 0)
  );
  // Index examples by URL so we can show concrete values (e.g. "Hem — 3
  // chars") next to each affected URL when both are present.
  const detailByUrl = new Map<string, string>();
  if (rec.examples) {
    for (const ex of rec.examples) {
      if (ex.url && ex.detail) detailByUrl.set(ex.url, ex.detail);
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_TONE[rec.priority]}`}>
          {rec.priority}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">{rec.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{rec.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            {rec.impact && (
              <span className={`rounded-full px-2 py-0.5 font-semibold ${IMPACT_TONE[rec.impact] || ""}`}>
                Impact: {rec.impact}
              </span>
            )}
            {rec.effort && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                Effort: {rec.effort}
              </span>
            )}
            {rec.affected_count > 0 && (
              <span className="text-slate-400">{rec.affected_count} affected</span>
            )}
          </div>
        </div>
        {hasDetail && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-violet-600 hover:text-violet-800 font-medium whitespace-nowrap"
          >
            {open ? "Hide" : "How to fix"}
          </button>
        )}
      </div>
      {open && hasDetail && (
        <div className="mt-3 ml-8 space-y-2 text-xs">
          {rec.how_to_fix && (
            <div className="rounded-md bg-white border border-slate-200 px-3 py-2">
              <div className="font-semibold text-slate-700 mb-1">Fix</div>
              <p className="text-slate-600 leading-relaxed whitespace-pre-line">{rec.how_to_fix}</p>
            </div>
          )}
          {rec.affected_urls && rec.affected_urls.length > 0 && (
            <div className="rounded-md bg-white border border-slate-200 px-3 py-2">
              <div className="font-semibold text-slate-700 mb-1">Affected URLs</div>
              <ul className="space-y-0.5">
                {rec.affected_urls.slice(0, 8).map((u, i) => {
                  const detail = detailByUrl.get(u);
                  return (
                    <li key={i} className="flex items-center gap-2">
                      <a href={u} target="_blank" rel="noopener noreferrer"
                         className="text-violet-700 hover:underline inline-flex items-center gap-1 truncate max-w-[300px]"
                         title={u}>
                        {u}
                        <ExternalLink className="h-3 w-3 opacity-60 flex-shrink-0" />
                      </a>
                      {detail && (
                        <span className="text-slate-500 truncate" title={detail}>
                          — {detail}
                        </span>
                      )}
                    </li>
                  );
                })}
                {rec.affected_urls.length > 8 && (
                  <li className="text-slate-400">+{rec.affected_urls.length - 8} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
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

/* ── Keywords tab ─────────────────────────────────────────────────────────── */

const INTENT_BADGE: Record<KeywordIntent, string> = {
  informational: "bg-blue-100 text-blue-700",
  commercial:    "bg-violet-100 text-violet-700",
  transactional: "bg-emerald-100 text-emerald-700",
  navigational:  "bg-slate-100 text-slate-600",
};

const DIFFICULTY_BADGE: Record<string, string> = {
  low:    "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high:   "bg-rose-100 text-rose-700",
};

function KeywordsTab({ data }: { data: KeywordOpportunities }) {
  const [intentFilter, setIntentFilter] = useState<"all" | KeywordIntent>("all");
  const filtered = useMemo(
    () => data.opportunities.filter((o) => intentFilter === "all" || o.intent === intentFilter),
    [data.opportunities, intentFilter],
  );
  const intents: ("all" | KeywordIntent)[] = ["all", "informational", "commercial", "transactional", "navigational"];

  return (
    <div className="space-y-6">
      {/* Header explaining what this tab is */}
      <section className="rounded-xl border bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <SearchIcon className="h-4 w-4 text-violet-700" />
          <h3 className="text-sm font-semibold text-slate-800">Keyword opportunities</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Phrases the audit pulled out of your site, suggested keywords to grow organic + AI traffic,
          and topic clusters you can build pillar content around. Treat this as a starting point —
          tweak based on your business priorities.
        </p>
      </section>

      {/* Current targeting + related searches in a 2-column layout */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">What you already target</h4>
          {data.current_keywords.length === 0 ? (
            <p className="text-xs text-slate-400">
              We couldn&rsquo;t extract clear topic signals from the audited pages.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.current_keywords.slice(0, 10).map((k) => (
                <li key={k.phrase} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-slate-800 truncate" title={k.phrase}>{k.phrase}</span>
                  <span className="text-slate-400 whitespace-nowrap">
                    {k.page_count} {k.page_count === 1 ? "page" : "pages"} · score {k.score}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">
            Related searches{data.primary_seed && ` for "${data.primary_seed}"`}
          </h4>
          {data.related_searches.length === 0 ? (
            <p className="text-xs text-slate-400">
              No related-search data — connect ValueSERP to enable Google&rsquo;s &ldquo;people also ask&rdquo;
              and &ldquo;related searches&rdquo; signals.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {data.related_searches.map((q) => (
                <li key={q} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700">
                  {q}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Suggested opportunities */}
      <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <h4 className="text-sm font-semibold text-slate-700">
            Suggested keywords ({filtered.length})
          </h4>
          <div className="ml-auto flex flex-wrap gap-1">
            {intents.map((i) => (
              <button
                key={i}
                onClick={() => setIntentFilter(i)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  intentFilter === i
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {i === "all" ? "All" : KEYWORD_INTENT_META[i].label}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No opportunities for this intent — try another filter.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((o, i) => <OpportunityRow key={i} opp={o} />)}
          </ul>
        )}
      </section>

      {/* Topic clusters */}
      {data.clusters.length > 0 && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Topic clusters</h4>
          <p className="text-xs text-slate-500 mb-4">
            Group these keywords behind a pillar page that links to supporting articles.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {data.clusters.map((c, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/40 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Pillar</div>
                <div className="text-sm font-semibold text-slate-900">{c.pillar}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.supporting.map((s) => (
                    <span key={s} className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-slate-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Competitor gaps */}
      {data.competitor_gap.length > 0 && (
        <section className="rounded-xl border bg-amber-50/60 border-amber-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-amber-900 mb-2">Competitors ranking on your topics</h4>
          <ul className="space-y-2">
            {data.competitor_gap.map((g, i) => (
              <li key={i} className="text-xs">
                <div className="font-semibold text-slate-900">{g.keyword}</div>
                <div className="text-slate-600 mt-0.5">{g.note}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {g.competitors_in_top10.map((c) => (
                    <span key={c} className="rounded-full bg-white border border-amber-200 px-2 py-0.5 text-[11px] text-amber-800">
                      {c}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OpportunityRow({ opp }: { opp: KeywordOpportunity }) {
  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[220px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{opp.keyword}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${INTENT_BADGE[opp.intent] || INTENT_BADGE.informational}`}>
              {KEYWORD_INTENT_META[opp.intent]?.label || opp.intent}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_BADGE[opp.difficulty] || DIFFICULTY_BADGE.medium}`}>
              {opp.difficulty}
            </span>
            {opp.is_long_tail && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                long-tail
              </span>
            )}
          </div>
          {opp.reasoning && (
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{opp.reasoning}</p>
          )}
          <p className="mt-1.5 text-[11px] text-slate-500">
            {opp.target_status === "existing_page" && opp.target_url ? (
              <>
                Target:{" "}
                <a href={opp.target_url} target="_blank" rel="noopener noreferrer"
                   className="text-violet-700 hover:underline inline-flex items-center gap-1">
                  {pathOf(opp.target_url)}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>{" "}
                — {opp.target_note}
              </>
            ) : (
              <span className="text-amber-700">{opp.target_note}</span>
            )}
          </p>
        </div>
      </div>
    </li>
  );
}
