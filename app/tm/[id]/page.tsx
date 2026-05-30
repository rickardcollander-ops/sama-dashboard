"use client";

import { Fragment, useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  X,
  Phone,
  RefreshCw,
  Mail,
  Globe,
  Building2,
  MapPin,
  User,
  ExternalLink,
} from "lucide-react";
import TmActivityPanel from "@/components/tm/ActivityPanel";

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
  | "phone_missing"
  | "answering_machine"
  | "not_interested"
  | "meeting_booked"
  | "converted";

interface PriorCampaign {
  campaign_id: string;
  campaign_name: string;
  call_status: string;
}

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
  audit_id: string | null;
  audited_at: string | null;
  call_status: CallStatus;
  call_notes: string | null;
  prior_campaigns: PriorCampaign[];
}

const CALL_STATUS_OPTIONS: { value: CallStatus; label: string; tone: string }[] = [
  { value: "new", label: "Ny", tone: "bg-slate-100 text-slate-700" },
  { value: "called", label: "Uppringd", tone: "bg-blue-100 text-blue-700" },
  { value: "callback", label: "Ring tillbaka", tone: "bg-amber-100 text-amber-700" },
  { value: "phone_missing", label: "Telefonnummer saknas", tone: "bg-orange-100 text-orange-700" },
  { value: "answering_machine", label: "Telesvarare", tone: "bg-yellow-100 text-yellow-700" },
  { value: "not_interested", label: "Ej intresserad", tone: "bg-rose-100 text-rose-700" },
  { value: "meeting_booked", label: "Möte bokat", tone: "bg-violet-100 text-violet-700" },
  { value: "converted", label: "Konverterad", tone: "bg-emerald-100 text-emerald-700" },
];

function callStatusTone(s: CallStatus): string {
  return (
    CALL_STATUS_OPTIONS.find((o) => o.value === s)?.tone ?? "bg-slate-100 text-slate-700"
  );
}

// Normaliserar svenska/internationella nummer till E.164. Phone Link kräver
// detta format för att uppringningen ska fungera tillförlitligt.
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    return /^\d{6,15}$/.test(digits) ? `+${digits}` : null;
  }
  if (cleaned.startsWith("00")) {
    const digits = cleaned.slice(2);
    return /^\d{6,15}$/.test(digits) ? `+${digits}` : null;
  }
  const stripped = cleaned.replace(/^0+/, "");
  return /^\d{6,15}$/.test(stripped) ? `+46${stripped}` : null;
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

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [activeNotes, setActiveNotes] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CallStatus | "all">("all");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);

  const visibleLeads = leads
    .filter((l) => statusFilter === "all" || l.call_status === statusFilter)
    .filter((l) => !duplicatesOnly || (l.prior_campaigns ?? []).length > 0);

  const duplicateCount = leads.filter((l) => (l.prior_campaigns ?? []).length > 0).length;

  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.call_status] = (acc[l.call_status] ?? 0) + 1;
    return acc;
  }, {});

  const buildEmailParts = (lead: Lead): { to: string; subject: string; body: string } => {
    const to = lead.contact_email ?? "";
    const company = lead.company_name || lead.domain || "";
    const subject = `Information om er sajt${company ? ` — ${company}` : ""}`;
    const greeting = lead.contact_first_name ? `Hej ${lead.contact_first_name},` : "Hej,";
    const auditLine = lead.audit_score != null
      ? `Vi körde en snabb AI-läsbarhetsanalys av ${lead.domain || "er sajt"} och fick en score på ${lead.audit_score}/100. Jag tänkte dela vad vi hittade och prata om hur ni kan lyfta synligheten.`
      : `Vi har tittat på ${lead.domain || "er sajt"} och har några konkreta förbättringar för synlighet i Google och AI-assistenter (ChatGPT, Claude, Perplexity).`;
    const body = `${greeting}\n\n${auditLine}\n\nFinns det 15 minuter nästa vecka för en kort genomgång?\n\n— SAMA-teamet`;
    return { to, subject, body };
  };

  const buildMailto = (lead: Lead): string => {
    const { to, subject, body } = buildEmailParts(lead);
    return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const buildGmailCompose = (lead: Lead): string => {
    const { to, subject, body } = buildEmailParts(lead);
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/tm/campaigns/${campaignId}`, { cache: "no-store" });
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
  }, [campaignId]);

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

  const handleDial = (lead: Lead) => {
    if (lead.call_status === "new") {
      void updateLead(lead.id, { call_status: "called" });
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-4">
        <Link
          href="/tm"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Tillbaka till kampanjer
        </Link>
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

      <TmActivityPanel campaignId={campaignId} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Filter:</span>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            statusFilter === "all"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Alla ({leads.length})
        </button>
        {CALL_STATUS_OPTIONS.map((o) => {
          const count = statusCounts[o.value] ?? 0;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setStatusFilter(o.value)}
              disabled={count === 0 && statusFilter !== o.value}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === o.value
                  ? "bg-slate-900 text-white"
                  : count === 0
                    ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"
                    : `${o.tone} hover:opacity-80`
              }`}
            >
              {o.label} ({count})
            </button>
          );
        })}
        {duplicateCount > 0 && (
          <button
            type="button"
            onClick={() => setDuplicatesOnly((v) => !v)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              duplicatesOnly
                ? "bg-slate-900 text-white"
                : "bg-amber-100 text-amber-700 border border-amber-200 hover:opacity-80"
            }`}
          >
            Dubbletter ({duplicateCount})
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Företag</th>
              <th className="px-4 py-3">Kontakt</th>
              <th className="px-4 py-3">E-post</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Åtgärder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleLeads.length === 0 && !fetching && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {leads.length === 0
                    ? "Inga leads i denna kampanj."
                    : "Inga leads matchar valt filter."}
                </td>
              </tr>
            )}
            {visibleLeads.map((lead) => {
              const contactName = [lead.contact_first_name, lead.contact_last_name]
                .filter(Boolean)
                .join(" ");
              const phoneE164 = toE164(lead.contact_phone);
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
                      {(lead.prior_campaigns ?? []).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {lead.prior_campaigns.map((p) => (
                            <a
                              key={p.campaign_id}
                              href={`/tm/${p.campaign_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100"
                            >
                              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                              {p.campaign_name}
                              <span className={`ml-0.5 rounded-full px-1.5 py-px text-[10px] font-medium ${callStatusTone(p.call_status as CallStatus)}`}>
                                {CALL_STATUS_OPTIONS.find((o) => o.value === p.call_status)?.label ?? p.call_status}
                              </span>
                            </a>
                          ))}
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
                          {lead.contact_phone ? (
                            phoneE164 ? (
                              <a
                                href={`tel:${phoneE164}`}
                                onClick={() => handleDial(lead)}
                                className="text-xs text-slate-600 flex items-center gap-1 hover:text-violet-600"
                              >
                                <Phone className="h-3 w-3" />
                                {lead.contact_phone}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-600 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {lead.contact_phone}
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-orange-600 flex items-center gap-1">
                              <Phone className="h-3 w-3" /> saknas
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.contact_email ? (
                        <a
                          href={`mailto:${lead.contact_email}`}
                          className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {lead.contact_email}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.audit_score != null ? (
                        lead.audit_id ? (
                          <a
                            href={`/audit/r/${lead.audit_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Öppna fullständig rapport"
                            className={`inline-flex items-center gap-1 text-2xl font-bold tabular-nums hover:underline ${scoreTone(lead.audit_score)}`}
                          >
                            {lead.audit_score}
                            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                          </a>
                        ) : (
                          <div
                            className={`text-2xl font-bold tabular-nums ${scoreTone(lead.audit_score)}`}
                          >
                            {lead.audit_score}
                          </div>
                        )
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
                      <div className="flex justify-end gap-1.5">
                        {phoneE164 && (
                          <a
                            href={`tel:${phoneE164}`}
                            onClick={() => handleDial(lead)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            title="Ring via Phone Link (Länk till Windows)"
                          >
                            <Phone className="h-3 w-3" /> Ring upp
                          </a>
                        )}
                        {lead.contact_email && (
                          <div className="inline-flex rounded-lg border border-violet-200 bg-violet-50 overflow-hidden">
                            <a
                              href={buildGmailCompose(lead)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-violet-700 hover:bg-violet-100"
                              title="Öppna ett färdigt mail i Gmail"
                            >
                              <Mail className="h-3 w-3" /> Gmail
                            </a>
                            <a
                              href={buildMailto(lead)}
                              className="inline-flex items-center border-l border-violet-200 px-2 py-1 text-xs text-violet-700 hover:bg-violet-100"
                              title="Öppna i standardmailklient"
                            >
                              mailto
                            </a>
                          </div>
                        )}
                          <button
                            onClick={() => setActiveNotes(activeNotes === lead.id ? null : lead.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            {activeNotes === lead.id ? "Dölj" : "Anteckningar"}
                          </button>
                      </div>
                    </td>
                  </tr>
                  <tr className="bg-slate-50/60">
                    <td colSpan={6} className="px-4 py-3">
                      {activeNotes === lead.id ? (
                        <textarea
                          autoFocus
                          defaultValue={lead.call_notes || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (lead.call_notes || "")) {
                              void updateLead(lead.id, { call_notes: e.target.value });
                            }
                            setActiveNotes(null);
                          }}
                          placeholder="Anteckningar från samtalet — sparas när du klickar utanför rutan."
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      ) : (
                        <p className="min-h-[1.25rem] text-sm text-slate-600 whitespace-pre-wrap">
                          {lead.call_notes || <span className="text-slate-400 italic">Inga anteckningar</span>}
                        </p>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
