"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
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
  CalendarClock,
  CalendarCheck,
  ListChecks,
} from "lucide-react";
import TmActivityPanel from "@/components/tm/ActivityPanel";
import LeadDrawer from "@/components/tm/LeadDrawer";
import {
  type Lead,
  type CallStatus,
  type LeadActivity,
  CALL_STATUS_OPTIONS,
  callStatusLabel,
  callStatusTone,
  scoreTone,
  toE164,
  buildGmailCompose,
  buildMailto,
  contactName,
} from "@/lib/tm/leads";
import { fmtDateTime, isOverdue } from "@/lib/tm/format";

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
  const [statusFilter, setStatusFilter] = useState<CallStatus | "all">("all");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleLeads = useMemo(
    () =>
      leads
        .filter((l) => statusFilter === "all" || l.call_status === statusFilter)
        .filter((l) => !duplicatesOnly || (l.prior_campaigns ?? []).length > 0),
    [leads, statusFilter, duplicatesOnly],
  );

  const duplicateCount = leads.filter((l) => (l.prior_campaigns ?? []).length > 0).length;

  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.call_status] = (acc[l.call_status] ?? 0) + 1;
    return acc;
  }, {});

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

  // Deep-link from the worklist: /tm/{id}?lead={leadId} opens that lead's card.
  // Read from window to avoid the useSearchParams Suspense requirement.
  useEffect(() => {
    if (typeof window === "undefined" || leads.length === 0) return;
    const wanted = new URLSearchParams(window.location.search).get("lead");
    if (wanted && leads.some((l) => l.id === wanted)) setSelectedId(wanted);
    // run once leads are first available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length]);

  const updateLead = async (
    leadId: string,
    patch: Partial<Pick<Lead, "call_status" | "call_notes" | "callback_at" | "meeting_at">>,
  ) => {
    // Optimistic — merge immediately so the drawer + table reflect the change.
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...patch } : l)));
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara");
      void load(); // re-sync on failure
    }
  };

  const addNote = async (leadId: string, body: string, operator?: string) => {
    try {
      const res = await fetch(`/api/tm/campaigns/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, operator }),
      });
      if (!res.ok) {
        const r = await res.json().catch(() => ({}));
        throw new Error(r.error || `HTTP ${res.status}`);
      }
      const activity = (await res.json()) as LeadActivity;
      // Optimistic: prepend the activity and mirror call_notes (matches server).
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                call_notes: body,
                activities: [activity, ...(l.activities ?? [])],
              }
            : l,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara anteckning");
    }
  };

  const handleDial = (lead: Lead) => {
    if (lead.call_status === "new") {
      void updateLead(lead.id, { call_status: "called" });
    }
  };

  // Drawer navigation within the currently filtered list.
  const selectedIndex = visibleLeads.findIndex((l) => l.id === selectedId);
  const selectedLead = selectedIndex >= 0 ? visibleLeads[selectedIndex] : null;

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/tm"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Tillbaka till kampanjer
        </Link>
        <Link
          href="/tm/worklist"
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
        >
          <ListChecks className="h-3.5 w-3.5" /> Att ringa idag
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
              const name = contactName(lead);
              const phoneE164 = toE164(lead.contact_phone);
              const callbackOverdue = isOverdue(lead.callback_at);
              return (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className={`cursor-pointer align-top transition-colors hover:bg-violet-50/40 ${
                    selectedId === lead.id ? "bg-violet-50/60" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" /> {lead.company_name}
                    </div>
                    {lead.domain && (
                      <a
                        href={`https://${lead.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
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
                    {(lead.callback_at || lead.meeting_at) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {lead.callback_at && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              callbackOverdue
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            <CalendarClock className="h-3 w-3" /> {fmtDateTime(lead.callback_at)}
                          </span>
                        )}
                        {lead.meeting_at && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                            <CalendarCheck className="h-3 w-3" /> {fmtDateTime(lead.meeting_at)}
                          </span>
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
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100"
                          >
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                            {p.campaign_name}
                            <span
                              className={`ml-0.5 rounded-full px-1.5 py-px text-[10px] font-medium ${callStatusTone(p.call_status)}`}
                            >
                              {callStatusLabel(p.call_status)}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {name ? (
                      <>
                        <div className="font-medium text-slate-700 text-xs flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {name}
                        </div>
                        {lead.contact_title && (
                          <div className="text-xs text-slate-400">{lead.contact_title}</div>
                        )}
                        {lead.contact_phone ? (
                          phoneE164 ? (
                            <a
                              href={`tel:${phoneE164}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDial(lead);
                              }}
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
                        onClick={(e) => e.stopPropagation()}
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
                          onClick={(e) => e.stopPropagation()}
                          title="Öppna fullständig rapport"
                          className={`inline-flex items-center gap-1 text-2xl font-bold tabular-nums hover:underline ${scoreTone(lead.audit_score)}`}
                        >
                          {lead.audit_score}
                          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                        </a>
                      ) : (
                        <div className={`text-2xl font-bold tabular-nums ${scoreTone(lead.audit_score)}`}>
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
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        void updateLead(lead.id, { call_status: e.target.value as CallStatus })
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDial(lead);
                          }}
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
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-violet-700 hover:bg-violet-100"
                            title="Öppna ett färdigt mail i Gmail"
                          >
                            <Mail className="h-3 w-3" /> Gmail
                          </a>
                          <a
                            href={buildMailto(lead)}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center border-l border-violet-200 px-2 py-1 text-xs text-violet-700 hover:bg-violet-100"
                            title="Öppna i standardmailklient"
                          >
                            mailto
                          </a>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(lead.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Öppna kort
                        {(lead.activities?.length ?? 0) > 0 && (
                          <span className="rounded-full bg-slate-100 px-1 text-[10px] text-slate-500">
                            {lead.activities!.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedId(null)}
        onPatch={updateLead}
        onAddNote={addNote}
        onPrev={() => {
          if (selectedIndex > 0) setSelectedId(visibleLeads[selectedIndex - 1].id);
        }}
        onNext={() => {
          if (selectedIndex >= 0 && selectedIndex < visibleLeads.length - 1)
            setSelectedId(visibleLeads[selectedIndex + 1].id);
        }}
        hasPrev={selectedIndex > 0}
        hasNext={selectedIndex >= 0 && selectedIndex < visibleLeads.length - 1}
      />
    </main>
  );
}
