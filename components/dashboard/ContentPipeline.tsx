"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, CheckSquare, CalendarDays, ArrowRight } from "lucide-react";
import { tenantApi } from "@/lib/api";
import { useLanguage } from "@/lib/hooks/useLanguage";
import type { Language } from "@/lib/locales";

interface PieceRow {
  id: string;
  title: string;
  status: string;
  scheduled_for?: string | null;
  created_at?: string;
}

interface IdeaRow {
  id: string;
  title: string;
}

interface Props {
  tenantId: string;
  pieces: PieceRow[] | null;
  pendingApprovals: number;
}

const LOCALE_MAP: Record<Language, string> = {
  sv: "sv-SE",
  no: "nb-NO",
  da: "da-DK",
  en: "en-GB",
};

function fmtDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

export default function ContentPipeline({ tenantId, pieces, pendingApprovals }: Props) {
  const { language } = useLanguage();
  const locale = LOCALE_MAP[language];
  const [ideas, setIdeas] = useState<IdeaRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await tenantApi(tenantId).get<{ items?: IdeaRow[] }>(
          "/api/content/plan?status=idea",
        );
        if (!cancelled) setIdeas(data.items ?? []);
      } catch {
        if (!cancelled) setIdeas([]);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const ideaCount = ideas?.length ?? 0;

  const upcoming = (pieces ?? [])
    .filter((p) => p.status === "draft" || p.status === "review" || p.status === "scheduled")
    .sort((a, b) => {
      const ta = new Date(a.scheduled_for || a.created_at || 0).getTime();
      const tb = new Date(b.scheduled_for || b.created_at || 0).getTime();
      return ta - tb;
    })
    .slice(0, 3);

  // Don't render until pieces have loaded (null = still loading)
  if (pieces === null) {
    return <div className="h-28 animate-pulse rounded-xl border bg-white shadow-sm" />;
  }

  // Nothing to show at all — hide cleanly rather than render empty shell
  if (ideaCount === 0 && pendingApprovals === 0 && upcoming.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Innehållsflöde
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Ideas */}
        <Link
          href="/c/content?tab=ideas"
          className="group flex flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-amber-300"
        >
          <div>
            <div className="flex items-start justify-between">
              <span className="rounded-md bg-amber-50 p-1.5 text-amber-500">
                <Lightbulb className="h-4 w-4" />
              </span>
              {ideaCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {ideaCount}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {ideaCount > 0
                ? `${ideaCount} idé${ideaCount === 1 ? "" : "r"} i kön`
                : "Inga idéer ännu"}
            </p>
            <p className="text-xs text-slate-500">
              {ideaCount > 0 ? "Väntar på att draftas" : "Daglig körning kl 06:00"}
            </p>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 group-hover:text-amber-700">
            Se idéer <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        {/* Approvals */}
        <Link
          href="/c/approvals"
          className="group flex flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-purple-300"
        >
          <div>
            <div className="flex items-start justify-between">
              <span className="rounded-md bg-purple-50 p-1.5 text-purple-500">
                <CheckSquare className="h-4 w-4" />
              </span>
              {pendingApprovals > 0 && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
                  {pendingApprovals}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {pendingApprovals > 0
                ? `${pendingApprovals} att granska`
                : "Inget att granska"}
            </p>
            <p className="text-xs text-slate-500">
              {pendingApprovals > 0 ? "Kräver din handling" : "Allt är klart"}
            </p>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 group-hover:text-purple-700">
            Granska <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        {/* Upcoming */}
        <Link
          href="/c/content"
          className="group flex flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-blue-300"
        >
          <div>
            <div className="flex items-start justify-between">
              <span className="rounded-md bg-blue-50 p-1.5 text-blue-500">
                <CalendarDays className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">Kommande</p>
            {upcoming.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {upcoming.map((p) => (
                  <li key={p.id} className="text-xs text-slate-600">
                    <span className="font-medium text-slate-400">
                      {fmtDate(p.scheduled_for, locale)}
                    </span>
                    {p.scheduled_for && " · "}
                    <span className="line-clamp-1">{p.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Inga schemalagda artiklar</p>
            )}
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700">
            Se alla <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      </div>
    </section>
  );
}
