"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { tenantApi } from "@/lib/api";
import { useLanguage } from "@/lib/hooks/useLanguage";
import type { Language } from "@/lib/locales";

interface PieceRow {
  id: string;
  title: string;
  type?: string;
  content_type?: string;
  status: string;
  scheduled_for?: string | null;
  created_at?: string;
}

interface UpcomingDraftsProps {
  tenantId: string;
}

const LOCALE_MAP: Record<Language, string> = {
  sv: "sv-SE",
  no: "nb-NO",
  da: "da-DK",
  en: "en-GB",
};

export default function UpcomingDrafts({ tenantId }: UpcomingDraftsProps) {
  const { language } = useLanguage();
  const [pieces, setPieces] = useState<PieceRow[] | null>(null);

  function fmtDate(iso?: string | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(LOCALE_MAP[language], {
      day: "numeric",
      month: "short",
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await tenantApi(tenantId).get<{ pieces?: PieceRow[] }>(
          "/api/content/pieces?limit=50",
        );
        if (cancelled) return;
        const drafts = (data.pieces || [])
          .filter((p) => p.status === "draft" || p.status === "review")
          .sort((a, b) => {
            const ta = new Date(a.scheduled_for || a.created_at || 0).getTime();
            const tb = new Date(b.scheduled_for || b.created_at || 0).getTime();
            return ta - tb;
          })
          .slice(0, 2);
        setPieces(drafts);
      } catch {
        if (!cancelled) setPieces([]);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  if (pieces === null || pieces.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Kommande artiklar
      </h2>
      <ul className="space-y-2">
        {pieces.map((p) => {
          const dateStr = fmtDate(p.scheduled_for || p.created_at);
          const typeLabel = p.content_type || p.type || "artikel";
          return (
            <li key={p.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md bg-purple-50 p-1.5 text-purple-600">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500">
                    {p.status === "review" ? "Redo att granska" : "Utkast"}
                    {dateStr ? ` · ${dateStr}` : ""}
                    {typeLabel ? ` · ${typeLabel}` : ""}
                  </p>
                </div>
                <Link
                  href="/c/content"
                  className="ml-2 inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900"
                >
                  Öppna
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
