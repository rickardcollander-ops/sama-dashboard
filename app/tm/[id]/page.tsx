"use client";

import { Fragment, useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  X,
  Phone,
  RefreshCw,
  Mail,
  Globe,
  Building2,
  MapPin,
  User,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

interface Campaign {
  id: string;
  name: string;
  source_filename: string | null;
  status: "pending" | "running" | "completed" | "failed";
  total_leads: number;
  audited_leads: number;
  failed_leads: number;
  created_at: string;
}

type CallStatus =
  | "new"
  | "called"
  | "callback"
  | "not_interested"
  | "meeting_booked"
  | "converted";

interface Lead {
  id: string;
  company_name: string;
  domain: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry: string | null;
  company_size: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  audit_score: number | null;
  audited_at: string | null;
  call_status: CallStatus;
  call_notes: string | null;
}

const CALL_STATUS_OPTIONS: { value: CallStatus; label: string; tone: string }[] = [
  { value: "new", label: "Ny", tone: "bg-slate-100 text-slate-700" },
  { value: "called", label: "Uppringd", tone: "bg-blue-100 text-blue-700" },
  { value: "callback", label: "Ring tillbaka", tone: "bg-amber-100 text-amber-700" },
  { value: "not_interested", label: "Ej intresserad", tone: "bg-rose-100 text-rose-700" },
  { value: "meeting_booked", label: "Möte bokat", tone: "bg-violet-100 text-violet-700" },
  { value: "converted", label: "Konverterad", tone: "bg-emerald-100 text-emerald-700" },
];

function callStatusTone(s: CallStatus): string {
  return (
    CALL_STATUS_OPTIONS.find((o) => o.value === s)?.tone ?? "bg-slate-100 text-slate-700"
  );
}

function scoreTone(s: number | null): string {
  if (s == null) return "text-slate-400";
  if (s >= 80) return "text-emerald-600";
  if (s >= 50) return "text-amber-600";
  return "text-rose-600";
}

export default function TmCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [activeNotes, setActiveNotes] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/tm/campaigns/${campaignId}`, { cache: "no-store" });
      if (res.status === 401) {
        router.push("/tm/login");
        return;
      }
      if (res.status === 403) {
        setError("Ditt konto har inte tillgång till TM-portalen.");
        setFetching(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { campaign: Campaign; leads: Lead[] };
      setCampaign(body.campaign);
      setLeads(body.leads);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte ladda kampanjen");
    } finally {
      setFetching(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateLead = async (
    leadId: string,
    patch: Partial<Pick<Lead, "call_status" | "call_notes">>,
  ) => {
    try {
      const res = await fetch(`/api/tm/campaigns/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...patch } : l)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara");
    }
  };

  const handleSignOut = async () => {
    await getSupabaseBrowser().auth.signOut();
    router.push("/tm/login");
  };

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/tm"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Tillbaka till kampanjer
        </Link>
        <button
          onClick={() => void handleSignOut()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <LogOut className="h-3.5 w-3.5" /> Logga ut
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Phone className="h-6 w-6 text-violet-600" />
            {campaign?.name ?? "…"}
          </h1>
          {campaign?.source_filename && (
            <p className="mt-1 text-xs text-slate-400">{campaign.source_filename}</p>
          )}
        </div>
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
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Företag</th>
              <th className="px-4 py-3">Kontakt</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Anteckningar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.length === 0 && !fetching && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Inga leads i denna kampanj.
                </td>
              </tr>
            )}
            {leads.map((lead) => {
              const contactName = [lead.contact_first_name, lead.contact_last_name]
                .filter(Boolean)
                .join(" ");
              return (
                <Fragment key={lead.id}>
                  <tr className="hover:bg-slate-50/60 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" /> {lead.company_name}
                      </div>
                      {lead.domain && (
                        <a
                          href={`https://${lead.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600"
                        >
                          <Globe className="h-3 w-3" /> {lead.domain}{" "}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {(lead.industry || lead.city) && (
                        <div className="mt-0.5 text-xs text-slate-400 flex items-center gap-1">
                          {lead.industry && <span>{lead.industry}</span>}
                          {lead.industry && lead.city && <span>·</span>}
                          {lead.city && (
                            <>
                              <MapPin className="h-3 w-3" /> {lead.city}
                              {lead.country && `, ${lead.country}`}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {contactName ? (
                        <>
                          <div className="font-medium text-slate-700 text-xs flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {contactName}
                          </div>
                          {lead.contact_title && (
                            <div className="text-xs text-slate-400">{lead.contact_title}</div>
                          )}
                          {lead.contact_email && (
                            <a
                              href={`mailto:${lead.contact_email}`}
                              className="text-xs text-violet-600 hover:underline flex items-center gap-1"
                            >
                              <Mail className="h-3 w-3" />
                              {lead.contact_email}
                            </a>
                          )}
                          {lead.contact_phone && (
                            <a
                              href={`tel:${lead.contact_phone}`}
                              className="text-xs text-slate-600 flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" />
                              {lead.contact_phone}
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.audit_score != null ? (
                        <div
                          className={`text-2xl font-bold tabular-nums ${scoreTone(lead.audit_score)}`}
                        >
                          {lead.audit_score}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.call_status}
                        onChange={(e) =>
                          void updateLead(lead.id, {
                            call_status: e.target.value as CallStatus,
                          })
                        }
                        className={`rounded-lg border-0 px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-violet-500 ${callStatusTone(lead.call_status)}`}
                      >
                        {CALL_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() =>
                            setActiveNotes(activeNotes === lead.id ? null : lead.id)
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          {activeNotes === lead.id ? "Dölj" : "Anteckningar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {activeNotes === lead.id && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={5} className="px-4 py-3">
                        <textarea
                          defaultValue={lead.call_notes || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (lead.call_notes || "")) {
                              void updateLead(lead.id, { call_notes: e.target.value });
                            }
                          }}
                          placeholder="Anteckningar från samtalet — sparas när du klickar utanför rutan."
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
