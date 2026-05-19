"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart2, FileText } from "lucide-react";
import { tenantApi } from "@/lib/api";
import { useLanguage } from "@/lib/hooks/useLanguage";
import type { Language } from "@/lib/locales";

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
  // When the dashboard already fetched /api/content/pieces, it threads the
  // result through so this component doesn't refetch the same endpoint.
  // `null` means "still loading"; an array (possibly empty) means "done".
  pieces?: PieceRow[] | null;
}

const LOCALE_MAP: Record<Language, string> = {
  sv: "sv-SE",
  no: "nb-NO",
  da: "da-DK",
  en: "en-GB",
};

export default function RecentOutcomes({ tenantId, pieces: piecesProp }: RecentOutcomesProps) {
  const { t, language } = useLanguage();
  const [pieces, setPieces] = useState<PieceRow[] | null>(null);
  const usingParentPieces = piecesProp !== undefined;

  function fmtRelative(iso?: string | null): string {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${Math.max(1, mins)}${t.time.minutesSuffix}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}${t.time.hoursSuffix}`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}${t.time.daysSuffix}`;
    return new Date(iso).toLocaleDateString(LOCALE_MAP[language], { day: "numeric", month: "short" });
  }

  useEffect(() => {
    if (usingParentPieces) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await tenantApi(tenantId).get<{ pieces?: PieceRow[] }>(
          "/api/content/pieces?limit=50",
        );
        if (cancelled) return;
        setPieces(data.pieces || []);
      } catch {
        if (!cancelled) setPieces([]);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, usingParentPieces]);

  const source = usingParentPieces ? piecesProp : pieces;
  if (source == null) return null;
  const published = source
    .filter((p) => p.status === "published")
    .sort((a, b) => {
      const ta = new Date(a.published_at || a.created_at || 0).getTime();
      const tb = new Date(b.published_at || b.created_at || 0).getTime();
      return tb - ta;
    })
    .slice(0, 3);
  if (published.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t.recentOutcomes.title}
      </h2>
      <ul className="space-y-2">
        {published.map((p) => {
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
                    {t.recentOutcomes.published} {fmtRelative(p.published_at || p.created_at)}
                    {motivation ? ` · ${t.recentOutcomes.createdFrom} "${motivation}"` : ""}
                  </p>
                  {(impressions > 0 || clicks > 0) && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <BarChart2 className="h-3 w-3" />
                      {impressions.toLocaleString()} {t.recentOutcomes.impressions} · {clicks.toLocaleString()} {t.recentOutcomes.clicks} (30d)
                    </p>
                  )}
                </div>
                <Link
                  href="/c/content"
                  className="ml-2 inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  {t.recentOutcomes.seeResults}
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
