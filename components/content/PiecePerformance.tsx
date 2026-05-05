"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle, Bot, CheckCircle2, ExternalLink, Loader2,
  MinusCircle, MousePointerClick, Search, TrendingDown, TrendingUp,
} from "lucide-react";
import { tenantApi } from "@/lib/api";

// Sprint 4 (C6) — Per-piece performance summary.
//
// Renders a single card with three KPIs (snittposition, AI-omnämnandegrad,
// klick) plus a verdict and a few of the matching sökord/AI-kontroller.

interface KeywordRow {
  keyword: string;
  position?: number | null;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
}

interface AiCheckRow {
  prompt: string;
  ai_engine?: string | null;
  mentioned: boolean;
  checked_at?: string | null;
}

interface PerfResponse {
  piece_id: string;
  title?: string;
  status?: string;
  verdict: "winning" | "mixed" | "lagging" | "untracked" | string;
  keywords: string[];
  seo: {
    keywords: KeywordRow[];
    avg_position?: number;
    total_clicks?: number;
    total_impressions?: number;
  };
  ai: {
    checks: AiCheckRow[];
    mention_rate?: number | null;
  };
  traffic: {
    clicks_30d: number;
    impressions_30d: number;
  };
}

interface Props {
  tenantId: string;
  pieceId: string;
}

const VERDICT_META: Record<
  string,
  { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  winning: {
    label: "Vinnande",
    tone: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
    icon: TrendingUp,
  },
  mixed: {
    label: "Blandat",
    tone: "border-amber-200 bg-amber-50/60 text-amber-700",
    icon: MinusCircle,
  },
  lagging: {
    label: "Bakåt",
    tone: "border-red-200 bg-red-50/60 text-red-700",
    icon: TrendingDown,
  },
  untracked: {
    label: "Inget mätt än",
    tone: "border-slate-200 bg-slate-50 text-slate-500",
    icon: AlertCircle,
  },
};

function fmtPct(n?: number | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

export default function PiecePerformance({ tenantId, pieceId }: Props) {
  const [data, setData] = useState<PerfResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await tenantApi(tenantId).get<PerfResponse>(
          `/api/content/pieces/${pieceId}/performance`,
        );
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Kunde inte hämta utfall");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, pieceId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Hämtar utfall…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const v = VERDICT_META[data.verdict] ?? VERDICT_META.untracked;
  const Icon = v.icon;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-700">Utfall</h4>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${v.tone}`}
        >
          <Icon className="h-3 w-3" />
          {v.label}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Google-position"
          icon={<Search className="h-3.5 w-3.5 text-slate-400" />}
          value={
            data.seo.avg_position && data.seo.avg_position > 0
              ? data.seo.avg_position.toFixed(1)
              : "—"
          }
          hint={
            data.seo.keywords.length > 0
              ? `${data.seo.keywords.length} matchande sökord`
              : "Inga matchande sökord"
          }
        />
        <Kpi
          label="AI-omnämnande"
          icon={<Bot className="h-3.5 w-3.5 text-slate-400" />}
          value={fmtPct(data.ai.mention_rate)}
          hint={
            data.ai.checks.length > 0
              ? `${data.ai.checks.length} matchande kontroller`
              : "Inga matchande kontroller"
          }
        />
        <Kpi
          label="Klick (30d)"
          icon={<MousePointerClick className="h-3.5 w-3.5 text-slate-400" />}
          value={(data.traffic.clicks_30d ?? 0).toLocaleString()}
          hint={
            (data.traffic.impressions_30d ?? 0) > 0
              ? `${data.traffic.impressions_30d.toLocaleString()} visningar`
              : undefined
          }
        />
      </div>

      {data.seo.keywords.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
            Sökord som drar trafik ({data.seo.keywords.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {data.seo.keywords.slice(0, 6).map((k, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1"
              >
                <span className="truncate text-slate-700">{k.keyword}</span>
                <span className="flex items-center gap-3 text-slate-500">
                  {k.position && k.position > 0 ? (
                    <span>#{k.position.toFixed(1)}</span>
                  ) : null}
                  {(k.clicks ?? 0) > 0 ? <span>{k.clicks} klick</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {data.ai.checks.length > 0 && (
        <details className="mt-2 group">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
            Senaste AI-kontroller ({data.ai.checks.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {data.ai.checks.slice(0, 6).map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md bg-slate-50 px-2 py-1"
              >
                {c.mentioned ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-300" />
                )}
                <span className="flex-1 truncate text-slate-700" title={c.prompt}>
                  {c.prompt}
                </span>
                <span className="text-[10px] uppercase text-slate-400">
                  {c.ai_engine || "ai"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {data.verdict === "lagging" && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-100 bg-red-50/60 p-2 text-xs text-red-800">
          <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>
            Synligheten är låg. Pröva en revidering med AI — kort på &quot;Förbättra med AI&quot; på utkastet.
          </span>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  icon,
  value,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
      {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
}
