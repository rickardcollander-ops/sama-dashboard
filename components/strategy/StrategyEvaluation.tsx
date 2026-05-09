"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle, ArrowRight, CheckCircle2, Loader2, MinusCircle,
  RefreshCw, Sparkles, TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { tenantApi } from "@/lib/api";

// Sprint 5 (S2) — strategi-utvärdering: per topic, hur har det gått?

interface TopicRow {
  topic: string;
  ai_checks?: number;
  ai_mention_rate?: number | null;
  seo_keywords?: number;
  seo_avg_position?: number | null;
  seo_total_clicks?: number;
  content_pieces?: number;
  content_published?: number;
  status?: "winning" | "mixed" | "lagging" | "untracked" | string;
}

interface EvaluationResponse {
  strategy_id?: string | null;
  generated_at?: string | null;
  topics?: TopicRow[];
}

interface Props {
  tenantId: string;
}

const STATUS_META: Record<
  string,
  { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  winning: {
    label: "Vinnande",
    tone: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
    icon: CheckCircle2,
  },
  mixed: {
    label: "Mixed",
    tone: "border-amber-200 bg-amber-50/60 text-amber-700",
    icon: MinusCircle,
  },
  lagging: {
    label: "Behind",
    tone: "border-red-200 bg-red-50/60 text-red-700",
    icon: TrendingDown,
  },
  untracked: {
    label: "Not measured",
    tone: "border-slate-200 bg-slate-50 text-slate-500",
    icon: AlertCircle,
  },
};

function fmtPct(n?: number | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

export default function StrategyEvaluation({ tenantId }: Props) {
  const [data, setData] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tenantApi(tenantId).get<EvaluationResponse>(
        "/api/strategy/evaluation",
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fetch evaluation");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (tenantId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Evaluation
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            How have the topics in your strategy performed? Measured against AI mentions,
            Google ranking and published content.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading outcomes…
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {data && (data.topics?.length ?? 0) === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-sm text-slate-500">
          No topics to measure yet. Generate a strategy first — we'll then link your
          AI visibility, SEO data and content to each topic.
        </div>
      )}

      {data && (data.topics?.length ?? 0) > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-medium">Topic</th>
                <th className="px-3 py-2 font-medium">AI mentions</th>
                <th className="px-3 py-2 font-medium">Google pos</th>
                <th className="px-3 py-2 font-medium">Content</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.topics ?? []).map((t, i) => {
                const meta = STATUS_META[t.status ?? "untracked"] ?? STATUS_META.untracked;
                const Icon = meta.icon;
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-slate-800">{t.topic}</p>
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">
                      <span className="font-medium">{fmtPct(t.ai_mention_rate)}</span>
                      {t.ai_checks ? (
                        <span className="text-xs text-slate-400"> · {t.ai_checks} checks</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">
                      {t.seo_avg_position ? (
                        <>
                          <span className="font-medium">{t.seo_avg_position.toFixed(1)}</span>
                          <span className="text-xs text-slate-400"> · {t.seo_keywords ?? 0} keywords</span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">
                      {t.content_pieces ? (
                        <>
                          <span className="font-medium">{t.content_pieces}</span>
                          {(t.content_published ?? 0) > 0 && (
                            <span className="text-xs text-emerald-600">
                              {" "}
                              · {t.content_published} published
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.tone}`}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && (data.topics?.length ?? 0) > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
          <span>
            <strong className="text-slate-700">Tip:</strong> Topics marked &quot;Behind&quot; need
            content that answers the question. Click{" "}
            <Link
              href="/c/content"
              className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:text-blue-800"
            >
              Create content
              <ArrowRight className="h-2.5 w-2.5" />
            </Link>{" "}
            and suggest with AI — the gap list is your entry point.
          </span>
        </div>
      )}
    </section>
  );
}
