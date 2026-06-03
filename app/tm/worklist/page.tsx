"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  RefreshCw,
  Phone,
  CalendarClock,
  CalendarCheck,
  Sparkles,
  Building2,
  ExternalLink,
} from "lucide-react";
import TmNav from "@/components/tm/TmNav";
import { toE164, scoreTone, callStatusLabel, callStatusTone } from "@/lib/tm/leads";
import { fmtDateTime, isOverdue } from "@/lib/tm/format";

interface WorkItem {
  id: string;
  company_name: string;
  domain: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  audit_score: number | null;
  audit_id: string | null;
  call_status: string;
  callback_at: string | null;
  meeting_at: string | null;
  campaign_id: string;
  campaign_name: string | null;
}

interface Worklist {
  due_callbacks: WorkItem[];
  meetings: WorkItem[];
  new_leads: WorkItem[];
}

export default function TmWorklistPage() {
  const [data, setData] = useState<Worklist | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/tm/worklist`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData((await res.json()) as Worklist);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte ladda arbetslistan");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <TmNav />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <CalendarClock className="h-6 w-6 text-violet-600" /> Att ringa idag
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

      <div className="space-y-6">
        <Section
          title="Försenade återuppringningar"
          icon={<CalendarClock className="h-4 w-4 text-rose-600" />}
          items={data?.due_callbacks ?? []}
          timeField="callback_at"
          emptyText="Inga försenade återuppringningar — bra jobbat!"
          loading={fetching}
        />
        <Section
          title="Dagens & kommande möten"
          icon={<CalendarCheck className="h-4 w-4 text-violet-600" />}
          items={data?.meetings ?? []}
          timeField="meeting_at"
          emptyText="Inga bokade möten framåt."
          loading={fetching}
        />
        <Section
          title="Nya leads att ringa"
          icon={<Sparkles className="h-4 w-4 text-emerald-600" />}
          items={data?.new_leads ?? []}
          emptyText="Inga nya leads i kö."
          loading={fetching}
        />
      </div>
    </main>
  );
}

function Section({
  title,
  icon,
  items,
  timeField,
  emptyText,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  items: WorkItem[];
  timeField?: "callback_at" | "meeting_at";
  emptyText: string;
  loading: boolean;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon} {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {items.length}
        </span>
      </h2>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm divide-y divide-slate-100">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">
            {loading ? "Laddar…" : emptyText}
          </p>
        ) : (
          items.map((item) => {
            const name = [item.contact_first_name, item.contact_last_name]
              .filter(Boolean)
              .join(" ");
            const phoneE164 = toE164(item.contact_phone);
            const time = timeField ? item[timeField] : null;
            const overdue = timeField === "callback_at" && isOverdue(time);
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50/60"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/tm/${item.campaign_id}?lead=${item.id}`}
                    className="flex items-center gap-1.5 font-medium text-slate-900 hover:text-violet-700"
                  >
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{item.company_name}</span>
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                    {name && <span>{name}</span>}
                    {item.campaign_name && <span>· {item.campaign_name}</span>}
                  </div>
                </div>

                {time && (
                  <div
                    className={`text-xs font-medium ${overdue ? "text-rose-600" : "text-slate-600"}`}
                  >
                    {fmtDateTime(time)}
                  </div>
                )}

                {item.audit_score != null && (
                  <div className={`text-lg font-bold tabular-nums ${scoreTone(item.audit_score)}`}>
                    {item.audit_score}
                  </div>
                )}

                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${callStatusTone(item.call_status)}`}
                >
                  {callStatusLabel(item.call_status)}
                </span>

                {phoneE164 ? (
                  <a
                    href={`tel:${phoneE164}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    <Phone className="h-3 w-3" /> Ring
                  </a>
                ) : (
                  <span className="text-xs text-orange-500">Tel saknas</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
