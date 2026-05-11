"use client";

import { Fragment, useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertCircle, X, Phone, Play, RefreshCw,
  FileText, CheckCircle2, XCircle, Clock, ExternalLink, Mail,
  Globe, Building2, MapPin, User, FileDown,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { isAdminEmail } from "@/lib/admin";

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

type CallStatus = "new" | "called" | "callback" | "not_interested" | "meeting_booked" | "converted";

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
  audit_id: string | null;
  audit_status: "pending" | "running" | "completed" | "failed" | "skipped";
  audit_error: string | null;
  audit_score: number | null;
  audited_at: string | null;
  call_status: CallStatus;
  call_notes: string | null;
  pdf_sent_at: string | null;
}

const CALL_STATUS_OPTIONS: { value: CallStatus; label: string; tone: string }[] = [
  { value: "new",            label: "New",            tone: "bg-slate-100 text-slate-700" },
  { value: "called",         label: "Called",         tone: "bg-blue-100 text-blue-700" },
  { value: "callback",       label: "Callback",       tone: "bg-amber-100 text-amber-700" },
  { value: "not_interested", label: "Not interested", tone: "bg-rose-100 text-rose-700" },
  { value: "meeting_booked", label: "Meeting booked", tone: "bg-violet-100 text-violet-700" },
  { value: "converted",      label: "Converted",      tone: "bg-emerald-100 text-emerald-700" },
];

function callStatusTone(s: CallStatus): string {
  return CALL_STATUS_OPTIONS.find((o) => o.value === s)?.tone ?? "bg-slate-100 text-slate-700";
}

function scoreTone(s: number | null): string {
  if (s == null) return "text-slate-400";
  if (s >= 80) return "text-emerald-600";
  if (s >= 50) return "text-amber-600";
  return "text-rose-600";
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = use(params);
  const { user, loading } = useUser();
  const router = useRouter();
  const isAdmin = isAdminEmail(user?.email);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [auditingLeadId, setAuditingLeadId] = useState<string | null>(null);
  const [pdfLeadId, setPdfLeadId] = useState<string | null>(null);
  const [activeNotes, setActiveNotes] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { campaign: Campaign; leads: Lead[] };
      setCampaign(body.campaign);
      setLeads(body.leads);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load campaign");
    } finally {
      setFetching(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/c/login"); return; }
    if (!isAdmin) { router.push("/c/dashboard"); return; }
    void load();
  }, [user, loading, isAdmin, router, load]);

  // Auto-refresh while running so the UI shows progress without manual reload.
  useEffect(() => {
    if (!campaign || campaign.status !== "running") return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [campaign, load]);

  const runBatch = async () => {
    if (!campaign) return;
    setRunning(true);
    try {
      // Loop until no work left or we hit a hard stop.
      for (let i = 0; i < 200; i++) {
        const res = await fetch(`/api/admin/campaigns/${campaignId}/run`, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        await load();
        const pendingLeft = (body.pending ?? 0);
        const ranThisRound = (body.ran ?? 0) + (body.failed_in_batch ?? 0);
        if (pendingLeft === 0 || ranThisRound === 0) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
      void load();
    }
  };

  const reauditLead = async (leadId: string) => {
    setAuditingLeadId(leadId);
    setError("");
    try {
      const res = await fetch(`/api/admin/campaigns/leads/${leadId}/audit`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-audit failed");
    } finally {
      setAuditingLeadId(null);
    }
  };

  const downloadPdf = async (lead: Lead) => {
    setPdfLeadId(lead.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/campaigns/leads/${lead.id}/pdf`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${lead.company_name.replace(/[^a-z0-9._-]+/gi, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Mark as sent so the UI shows a "PDF generated" timestamp.
      await fetch(`/api/admin/campaigns/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_sent: true }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setPdfLeadId(null);
    }
  };

  const updateLead = async (leadId: string, patch: Partial<Pick<Lead, "call_status" | "call_notes">>) => {
    try {
      const res = await fetch(`/api/admin/campaigns/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, ...patch } : l));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };

  if (loading || (!user && !loading) || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </main>
      </div>
    );
  }

  const pending = (campaign?.total_leads ?? 0) - (campaign?.audited_leads ?? 0) - (campaign?.failed_leads ?? 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4">
          <Link href="/c/admin/campaigns" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Campaigns
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              disabled={fetching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              onClick={() => void runBatch()}
              disabled={running || pending === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Running audits…" : pending === 0 ? "All audited" : `Run ${pending} pending audits`}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
          </div>
        )}

        {campaign && (
          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <Stat label="Total leads" value={campaign.total_leads} />
            <Stat label="Audited" value={campaign.audited_leads} tone="emerald" />
            <Stat label="Failed" value={campaign.failed_leads} tone={campaign.failed_leads > 0 ? "rose" : "slate"} />
            <Stat label="Pending" value={Math.max(pending, 0)} tone={pending > 0 ? "violet" : "slate"} />
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Audit</th>
                <th className="px-4 py-3">Call status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.length === 0 && !fetching && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No leads in this campaign.</td></tr>
              )}
              {leads.map((lead) => {
                const contactName = [lead.contact_first_name, lead.contact_last_name].filter(Boolean).join(" ");
                const isAuditing = auditingLeadId === lead.id;
                const isDownloading = pdfLeadId === lead.id;
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
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600"
                          >
                            <Globe className="h-3 w-3" /> {lead.domain} <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {(lead.industry || lead.city) && (
                          <div className="mt-0.5 text-xs text-slate-400 flex items-center gap-1">
                            {lead.industry && <span>{lead.industry}</span>}
                            {lead.industry && lead.city && <span>·</span>}
                            {lead.city && <><MapPin className="h-3 w-3" /> {lead.city}{lead.country && `, ${lead.country}`}</>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {contactName ? (
                          <>
                            <div className="font-medium text-slate-700 text-xs flex items-center gap-1"><User className="h-3 w-3" />{contactName}</div>
                            {lead.contact_title && (
                              <div className="text-xs text-slate-400">{lead.contact_title}</div>
                            )}
                            {lead.contact_email && (
                              <a href={`mailto:${lead.contact_email}`} className="text-xs text-violet-600 hover:underline flex items-center gap-1"><Mail className="h-3 w-3" />{lead.contact_email}</a>
                            )}
                            {lead.contact_phone && (
                              <a href={`tel:${lead.contact_phone}`} className="text-xs text-slate-600 flex items-center gap-1"><Phone className="h-3 w-3" />{lead.contact_phone}</a>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.audit_score != null ? (
                          <div className={`text-2xl font-bold tabular-nums ${scoreTone(lead.audit_score)}`}>
                            {lead.audit_score}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AuditStatusBadge lead={lead} />
                        {lead.audit_error && (
                          <div className="mt-1 text-xs text-rose-500 max-w-xs truncate" title={lead.audit_error}>
                            {lead.audit_error}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.call_status}
                          onChange={(e) => void updateLead(lead.id, { call_status: e.target.value as CallStatus })}
                          className={`rounded-lg border-0 px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-violet-500 ${callStatusTone(lead.call_status)}`}
                        >
                          {CALL_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {lead.pdf_sent_at && (
                          <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />PDF generated</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {lead.audit_id && (
                            <Link
                              href={`/c/audit/r/${lead.audit_id}?tm=1`}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                              title="Open the full audit report"
                            >
                              <FileText className="h-3 w-3" /> View
                            </Link>
                          )}
                          {lead.audit_status === "completed" && (
                            <button
                              onClick={() => void downloadPdf(lead)}
                              disabled={isDownloading}
                              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-700 disabled:opacity-50"
                              title="Download PDF report"
                            >
                              {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                              PDF
                            </button>
                          )}
                          {(lead.audit_status === "failed" || lead.audit_status === "pending") && lead.domain && (
                            <button
                              onClick={() => void reauditLead(lead.id)}
                              disabled={isAuditing}
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                              title={lead.audit_status === "failed" ? "Retry audit" : "Run audit"}
                            >
                              {isAuditing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                              {lead.audit_status === "failed" ? "Retry" : "Audit"}
                            </button>
                          )}
                          <button
                            onClick={() => setActiveNotes(activeNotes === lead.id ? null : lead.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Notes
                          </button>
                        </div>
                      </td>
                    </tr>
                    {activeNotes === lead.id && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={6} className="px-4 py-3">
                          <textarea
                            defaultValue={lead.call_notes || ""}
                            onBlur={(e) => {
                              if (e.target.value !== (lead.call_notes || "")) {
                                void updateLead(lead.id, { call_notes: e.target.value });
                              }
                            }}
                            placeholder="Notes from the call — saved when you click outside the box."
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
    </div>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "emerald" | "rose" | "violet" }) {
  const toneClass = {
    slate:   "text-slate-900",
    emerald: "text-emerald-600",
    rose:    "text-rose-600",
    violet:  "text-violet-600",
  }[tone];
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function AuditStatusBadge({ lead }: { lead: Lead }) {
  switch (lead.audit_status) {
    case "completed":
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" />Completed</span>;
    case "running":
      return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"><Loader2 className="h-3 w-3 animate-spin" />Running</span>;
    case "failed":
      return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"><XCircle className="h-3 w-3" />Failed</span>;
    case "skipped":
      return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Skipped (no domain)</span>;
    default:
      return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"><Clock className="h-3 w-3" />Pending</span>;
  }
}
