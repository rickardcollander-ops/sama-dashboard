"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  RefreshCw,
  Users,
  PhoneCall,
  CalendarCheck,
  Trophy,
  CalendarClock,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import TmActivityPanel from "@/components/tm/ActivityPanel";
import TmNav from "@/components/tm/TmNav";
import { CALL_STATUS_OPTIONS, callStatusTone } from "@/lib/tm/leads";

interface Totals {
  leads: number;
  campaigns: number;
  contacted: number;
  meetings_booked: number;
  converted: number;
  due_callbacks: number;
  upcoming_meetings: number;
  by_status: Record<string, number>;
}

interface CampaignStat {
  id: string;
  name: string;
  created_at: string;
  total: number;
  contacted: number;
  meetings_booked: number;
  converted: number;
  due_callbacks: number;
}

interface Overview {
  totals: Totals | null;
  campaigns: CampaignStat[];
}

// Solid bar tones reused from the activity panel's status palette.
const STATUS_BAR_BG: Record<string, string> = {
  new: "bg-slate-400",
  called: "bg-blue-500",
  no_answer_1: "bg-yellow-500",
  no_answer_2: "bg-orange-500",
  no_answer_3: "bg-rose-400",
  callback: "bg-amber-500",
  phone_missing: "bg-orange-500",
  answering_machine: "bg-yellow-500",
  not_interested: "bg-rose-500",
  meeting_booked: "bg-violet-500",
  converted: "bg-emerald-500",
};

function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

export default function TmOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/tm/overview`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData((await res.json()) as Overview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte ladda översikten");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const t = data?.totals;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <TmNav />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <BarChart3 className="h-6 w-6 text-violet-600" /> Översikt
        </h1>
        <button
          onClick={() => void load()}
          disabled={fetching}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
          Uppdatera
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Leads totalt"
          value={t?.leads ?? 0}
          sub={`${t?.campaigns ?? 0} kampanjer`}
          tone="text-slate-700"
        />
        <Kpi
          icon={<PhoneCall className="h-4 w-4" />}
          label="Kontaktade"
          value={t?.contacted ?? 0}
          sub={t ? pct(t.contacted, t.leads) : "—"}
          tone="text-blue-600"
        />
        <Kpi
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Möten bokade"
          value={t?.meetings_booked ?? 0}
          sub={t ? pct(t.meetings_booked, t.leads) : "—"}
          tone="text-violet-600"
        />
        <Kpi
          icon={<Trophy className="h-4 w-4" />}
          label="Konverterade"
          value={t?.converted ?? 0}
          sub={t ? pct(t.converted, t.leads) : "—"}
          tone="text-emerald-600"
        />
        <Kpi
          icon={<CalendarClock className="h-4 w-4" />}
          label="Försenade callbacks"
          value={t?.due_callbacks ?? 0}
          sub="att ringa nu"
          tone="text-rose-600"
        />
        <Kpi
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Kommande möten"
          value={t?.upcoming_meetings ?? 0}
          sub="framåt"
          tone="text-amber-600"
        />
      </div>

      {/* Status funnel / breakdown */}
      {t && t.leads > 0 && (
        <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Fördelning per status</h2>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {CALL_STATUS_OPTIONS.map((o) => {
              const count = t.by_status[o.value] ?? 0;
              if (count === 0) return null;
              return (
                <div
                  key={o.value}
                  className={STATUS_BAR_BG[o.value] ?? "bg-slate-300"}
                  style={{ width: `${(count / t.leads) * 100}%` }}
                  title={`${o.label}: ${count}`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {CALL_STATUS_OPTIONS.map((o) => {
              const count = t.by_status[o.value] ?? 0;
              if (count === 0) return null;
              return (
                <span
                  key={o.value}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${callStatusTone(o.value)}`}
                >
                  <span className={`inline-block h-2 w-2 rounded-sm ${STATUS_BAR_BG[o.value] ?? "bg-slate-300"}`} />
                  {o.label}
                  <span className="font-bold tabular-nums">{count}</span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Activity (last 30 days) */}
      <TmActivityPanel days={30} />

      {/* Per-campaign breakdown */}
      <section className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Per kampanj</h2>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Kampanj</th>
              <th className="px-4 py-3 text-right">Leads</th>
              <th className="px-4 py-3 text-right">Kontaktade</th>
              <th className="px-4 py-3 text-right">Möten</th>
              <th className="px-4 py-3 text-right">Konv.</th>
              <th className="px-4 py-3 text-right">Callbacks</th>
              <th className="px-4 py-3 text-right">Öppna</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data?.campaigns ?? []).length === 0 && !fetching && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Inga kampanjer ännu.
                </td>
              </tr>
            )}
            {(data?.campaigns ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <Link href={`/tm/${c.id}`} className="font-medium text-slate-900 hover:text-violet-700">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.total}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                  {c.contacted}
                  <span className="ml-1 text-xs text-slate-400">{pct(c.contacted, c.total)}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-violet-700">
                  {c.meetings_booked}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700">
                  {c.converted}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.due_callbacks > 0 ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                      {c.due_callbacks}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <Link
                      href={`/tm/${c.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-700 hover:bg-violet-100"
                    >
                      Öppna <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className={`flex items-center gap-1.5 text-xs font-medium text-slate-400`}>
        <span className={tone}>{icon}</span>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}
