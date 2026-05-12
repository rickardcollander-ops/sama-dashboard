"use client";

/**
 * AI-readability scorecard rendered on /c/geo (and reusable elsewhere).
 *
 * Pulls from the dashboard's own `/api/ai-readability/summary` proxy, which
 * forwards to the SAMA backend's `GET /api/ai-readability/summary?days=30`.
 * Hides itself when no audit has produced a score yet — the GEO page should
 * look identical to before for new tenants.
 */

import { Fragment, useEffect, useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useSite } from "@/lib/hooks/useSite";
import { useLanguage } from "@/lib/hooks/useLanguage";

interface SubScores {
  structure?: number | null;
  metadata?: number | null;
  chunking?: number | null;
  semantics?: number | null;
  navigation?: number | null;
}

interface ActionPoint {
  title: string;
  category: keyof SubScores;
  priority: "P1" | "P2";
  description: string;
  why?: string;
  code_example?: string | null;
  estimated_time?: string;
  estimated_impact?: string;
}

interface AIReadabilitySummary {
  audit_id: string | null;
  overall_score: number | null;
  sub_scores: SubScores;
  action_points: ActionPoint[];
  page_count: number;
  last_run_at: string | null;
  history: { date: string; score: number }[];
}

function scoreTone(score: number | null | undefined): {
  text: string;
  bg: string;
  border: string;
} {
  if (score == null) return { text: "text-slate-400", bg: "bg-slate-50", border: "border-slate-200" };
  if (score >= 80) return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (score >= 60) return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" };
  return { text: "text-red-700", bg: "bg-red-50", border: "border-red-200" };
}

const SUB_SCORE_KEYS: (keyof SubScores)[] = [
  "structure", "metadata", "chunking", "semantics", "navigation",
];

export default function AIReadabilityCard() {
  const { tenantClient, effectiveTenantId } = useSite();
  const { t } = useLanguage();
  const ar = (t as any).aiReadability ?? FALLBACK_TEXT;

  const [summary, setSummary] = useState<AIReadabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedActionId, setExpandedActionId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await tenantClient.get<AIReadabilitySummary>(
          "/api/ai-readability/summary?days=30",
        );
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantClient, effectiveTenantId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm flex items-center gap-3 text-sm text-slate-500">
        <RefreshCw className="h-4 w-4 animate-spin" />
        {ar.loadingText}
      </div>
    );
  }

  // No audit has produced a score yet — hide the section entirely so the
  // GEO page renders unchanged for tenants that haven't run an audit.
  if (!summary || summary.overall_score == null) {
    return null;
  }

  const tone = scoreTone(summary.overall_score);

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            {ar.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-xl">
            {ar.subtitle}
          </p>
        </div>
        <div className={`rounded-xl border ${tone.border} ${tone.bg} px-5 py-3 text-right`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {ar.scoreLabel}
          </p>
          <p className={`text-3xl font-bold ${tone.text}`}>
            {summary.overall_score}
          </p>
          <p className="text-xs text-slate-500">/ 100</p>
        </div>
      </div>

      {/* Sub-scores grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {SUB_SCORE_KEYS.map((key) => {
          const value = summary.sub_scores?.[key] ?? null;
          const t2 = scoreTone(value);
          return (
            <div
              key={key}
              className={`rounded-lg border ${t2.border} ${t2.bg} p-3`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {ar[`subScore_${key}`] ?? key}
              </p>
              <p className={`mt-1 text-xl font-bold ${t2.text}`}>
                {value == null ? "—" : value}
              </p>
            </div>
          );
        })}
      </div>

      {/* History sparkline */}
      {summary.history && summary.history.length > 1 && (
        <div className="mb-6 h-32 -mx-2">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
            <LineChart data={summary.history} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#f8fafc",
                  fontSize: "12px",
                }}
                formatter={(v) => [`${v}`, ar.scoreLabel]}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#8b5cf6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Action points */}
      {summary.action_points && summary.action_points.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 mb-3">
            {ar.actionPointsTitle}
          </h3>
          <ul className="space-y-2">
            {summary.action_points.map((ap, idx) => {
              const expanded = expandedActionId === idx;
              const isP1 = ap.priority === "P1";
              return (
                <Fragment key={idx}>
                  <li
                    className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50/60 cursor-pointer"
                    onClick={() => setExpandedActionId(expanded ? null : idx)}
                  >
                    <div className="flex items-start gap-3 p-3">
                      <span
                        className={`flex-shrink-0 inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          isP1
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {ap.priority}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{ap.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 capitalize">
                          {ar[`subScore_${ap.category}`] ?? ap.category}
                          {ap.estimated_time ? ` · ${ar.estTime}: ${ap.estimated_time}` : ""}
                          {ap.estimated_impact ? ` · ${ap.estimated_impact}` : ""}
                        </p>
                      </div>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                    {expanded && (
                      <div className="border-t border-slate-100 px-3 py-3 space-y-2 bg-slate-50/40">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {ar.descLabel}
                          </p>
                          <p className="text-sm text-slate-700">{ap.description}</p>
                        </div>
                        {ap.why && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {ar.why}
                            </p>
                            <p className="text-sm text-slate-700">{ap.why}</p>
                          </div>
                        )}
                        {ap.code_example && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {ar.codeExample}
                            </p>
                            <pre className="mt-1 overflow-x-auto rounded-md border border-slate-200 bg-white p-2 text-[12px] leading-relaxed text-slate-700">
                              <code>{ap.code_example}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </div>
      )}

      {summary.action_points.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {ar.noActionPoints}
        </div>
      )}

      <p className="mt-4 text-[11px] text-slate-400">
        {ar.basedOn} {summary.page_count}{" "}
        {summary.page_count === 1 ? ar.page : ar.pages}
        {summary.last_run_at && (
          <>
            {" · "}
            {ar.lastRun}{" "}
            {new Date(summary.last_run_at).toLocaleString(undefined, {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </>
        )}
      </p>
    </div>
  );
}

// English fallback so the card still renders if a locale is missing keys.
const FALLBACK_TEXT = {
  title: "AI readability",
  subtitle: "How well your pages are structured for AI assistants to ingest and cite.",
  scoreLabel: "Overall score",
  subScore_structure: "Structure",
  subScore_metadata: "Metadata",
  subScore_chunking: "Chunking",
  subScore_semantics: "Semantics",
  subScore_navigation: "Navigation",
  actionPointsTitle: "Action points",
  noActionPoints: "No action points right now — re-run the audit after content updates.",
  loadingText: "Loading AI readability…",
  estTime: "Est. time",
  why: "Why it matters",
  descLabel: "What to do",
  codeExample: "Code example",
  basedOn: "Based on",
  page: "page",
  pages: "pages",
  lastRun: "Last run",
};
