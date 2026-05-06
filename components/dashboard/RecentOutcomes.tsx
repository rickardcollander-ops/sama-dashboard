"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart2, FileText } from "lucide-react";
import { tenantApi } from "@/lib/api";

// Sprint 3 (K-13) — "Senaste utfall" on Hem.
//
// Lists up to three most-recently published content pieces with the source
// surface that motivated each one (gap title or strategy topic). Click
// jumps to Content. We deliberately don't try to render full impact
// numbers here — that lives on the article view via PiecePerformance —
// but the link gives the user a fast path into it.

interface PieceRow {
  id: string;
  title: string;
  type?: string;
  status: string;
  published_at?: string | null;
  created_at?: string;
  source_gap_id?: string | null;
  source_gap_title?: string | null;
  source_strategy_topic?: string | null;
  impressions_30d?: number;
  clicks_30d?: number;
}

interface RecentOutcomesProps {
  tenantId: string;
}

function fmtRelative(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m sen`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sen`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d sen`;
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export default function RecentOutcomes({ tenantId }: RecentOutcomesProps) {
  const [pieces, setPieces] = useState<PieceRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await tenantApi(tenantId).get<{ pieces?: PieceRow[] }>(
          "/api/content/pieces?limit=50",
        );
        if (cancelled) return;
        const published = (data.pieces || [])
          .filter((p) => p.status === "published")
          .sort((a, b) => {
            const ta = new Date(a.published_at || a.created_at || 0).getTime();
            const tb = new Date(b.published_at || b.created_at || 0).getTime();
            return tb - ta;
          })
          .slice(0, 3);
        setPieces(published);
      } catch {
        if (!cancelled) setPieces([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (pieces === null || pieces.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Senaste utfall
      </h2>
      <ul className="space-y-2">
        {pieces.map((p) => {
          const motivation = p.source_gap_title || p.source_strategy_topic;
          const impressions = p.impressions_30d ?? 0;
          const clicks = p.clicks_30d ?? 0;
          return (
            <li key={p.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md bg-emerald-50 p-1.5 text-emerald-600">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500">
                    Publicerad {fmtRelative(p.published_at || p.created_at)}
                    {motivation ? ` · skapad utifrån "${motivation}"` : ""}
                  </p>
                  {(impressions > 0 || clicks > 0) && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <BarChart2 className="h-3 w-3" />
                      {impressions.toLocaleString()} visningar · {clicks.toLocaleString()} klick (30d)
                    </p>
                  )}
                </div>
                <Link
                  href="/c/content"
                  className="ml-2 inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Se utfall
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
