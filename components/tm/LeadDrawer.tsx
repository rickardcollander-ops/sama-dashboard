"use client";

import { useEffect, useState } from "react";
import {
  X,
  ChevronUp,
  ChevronDown,
  Phone,
  Mail,
  Globe,
  Building2,
  MapPin,
  User,
  ExternalLink,
  AlertTriangle,
  Linkedin,
  CalendarClock,
  CalendarCheck,
  Trash2,
} from "lucide-react";
import {
  type Lead,
  type CallStatus,
  CALL_STATUS_OPTIONS,
  callStatusLabel,
  callStatusTone,
  scoreTone,
  toE164,
  buildGmailCompose,
  buildMailto,
  contactName,
} from "@/lib/tm/leads";
import {
  fmtDateTime,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  isOverdue,
} from "@/lib/tm/format";

type Patch = Partial<Pick<Lead, "call_status" | "callback_at" | "meeting_at">>;

interface Props {
  lead: Lead | null;
  onClose: () => void;
  onPatch: (leadId: string, patch: Patch) => void | Promise<void>;
  onAddNote: (leadId: string, body: string, operator?: string) => void | Promise<void>;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function LeadDrawer({
  lead,
  onClose,
  onPatch,
  onAddNote,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: Props) {
  const [noteText, setNoteText] = useState("");
  const [operator, setOperator] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset the note composer whenever we switch leads.
  useEffect(() => {
    setNoteText("");
  }, [lead?.id]);

  // Keyboard: Esc closes, Alt+Arrow navigates between leads.
  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (typing) return;
      if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && hasPrev) onPrev();
      if ((e.key === "ArrowDown" || e.key === "ArrowRight") && hasNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead, onClose, onPrev, onNext, hasPrev, hasNext]);

  if (!lead) return null;

  const name = contactName(lead);
  const phoneE164 = toE164(lead.contact_phone);
  const activities = lead.activities ?? [];

  const saveNote = async () => {
    const text = noteText.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await onAddNote(lead.id, text, operator.trim() || undefined);
      setNoteText("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md sm:max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-lg font-bold text-slate-900">
              <Building2 className="h-4 w-4 flex-shrink-0 text-violet-600" />
              <span className="truncate">{lead.company_name}</span>
            </h2>
            {lead.domain && (
              <a
                href={`https://${lead.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600"
              >
                <Globe className="h-3 w-3" /> {lead.domain}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              title="Föregående lead (↑)"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              title="Nästa lead (↓)"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              title="Stäng (Esc)"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Company meta */}
          {(lead.industry || lead.city || lead.company_size || lead.linkedin_url) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              {lead.industry && <span>{lead.industry}</span>}
              {lead.company_size && <span>· {lead.company_size}</span>}
              {lead.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {lead.city}
                  {lead.country && `, ${lead.country}`}
                </span>
              )}
              {lead.linkedin_url && (
                <a
                  href={lead.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-violet-600 hover:underline"
                >
                  <Linkedin className="h-3 w-3" /> LinkedIn
                </a>
              )}
            </div>
          )}

          {/* Contact + audit */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {name ? (
                <>
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <User className="h-3.5 w-3.5 text-slate-400" /> {name}
                  </div>
                  {lead.contact_title && (
                    <div className="text-xs text-slate-400">{lead.contact_title}</div>
                  )}
                </>
              ) : (
                <span className="text-sm text-slate-400">Ingen kontaktperson</span>
              )}
              <div className="mt-1 space-y-0.5">
                {lead.contact_phone ? (
                  phoneE164 ? (
                    <a
                      href={`tel:${phoneE164}`}
                      className="flex items-center gap-1 text-sm text-slate-600 hover:text-violet-600"
                    >
                      <Phone className="h-3.5 w-3.5" /> {lead.contact_phone}
                    </a>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-slate-600">
                      <Phone className="h-3.5 w-3.5" /> {lead.contact_phone}
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-1 text-sm text-orange-600">
                    <Phone className="h-3.5 w-3.5" /> Telefon saknas
                  </span>
                )}
                {lead.contact_email && (
                  <a
                    href={`mailto:${lead.contact_email}`}
                    className="flex items-center gap-1 text-sm text-violet-600 hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" /> {lead.contact_email}
                  </a>
                )}
              </div>
            </div>
            {lead.audit_score != null && (
              <div className="text-right">
                {lead.audit_id ? (
                  <a
                    href={`/audit/r/${lead.audit_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Öppna fullständig rapport"
                    className={`inline-flex items-center gap-1 text-3xl font-bold tabular-nums hover:underline ${scoreTone(lead.audit_score)}`}
                  >
                    {lead.audit_score}
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                ) : (
                  <div className={`text-3xl font-bold tabular-nums ${scoreTone(lead.audit_score)}`}>
                    {lead.audit_score}
                  </div>
                )}
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Score</div>
              </div>
            )}
          </div>

          {/* Prior campaigns (duplicate warnings) */}
          {(lead.prior_campaigns ?? []).length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Finns i tidigare kampanjer
              </div>
              <div className="flex flex-wrap gap-1">
                {lead.prior_campaigns.map((p) => (
                  <a
                    key={p.campaign_id}
                    href={`/tm/${p.campaign_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100"
                  >
                    {p.campaign_name}
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-px text-[10px] font-medium ${callStatusTone(p.call_status)}`}
                    >
                      {callStatusLabel(p.call_status)}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {phoneE164 && (
              <a
                href={`tel:${phoneE164}`}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <Phone className="h-3.5 w-3.5" /> Ring upp
              </a>
            )}
            {lead.contact_email && (
              <>
                <a
                  href={buildGmailCompose(lead)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100"
                >
                  <Mail className="h-3.5 w-3.5" /> Gmail
                </a>
                <a
                  href={buildMailto(lead)}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100"
                >
                  mailto
                </a>
              </>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
            <select
              value={lead.call_status}
              onChange={(e) => void onPatch(lead.id, { call_status: e.target.value as CallStatus })}
              className={`rounded-lg border-0 px-2.5 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-violet-500 ${callStatusTone(lead.call_status)}`}
            >
              {CALL_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scheduling: callback + meeting */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ScheduleField
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              label="Ring tillbaka"
              value={lead.callback_at}
              overdue={isOverdue(lead.callback_at)}
              onChange={(iso) => void onPatch(lead.id, { callback_at: iso })}
            />
            <ScheduleField
              icon={<CalendarCheck className="h-3.5 w-3.5" />}
              label="Bokat möte"
              value={lead.meeting_at}
              onChange={(iso) => void onPatch(lead.id, { meeting_at: iso })}
            />
          </div>

          {/* Call log */}
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">Samtalslogg</div>
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Anteckning från samtalet…"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <div className="flex items-center gap-2">
                <input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  placeholder="Init."
                  maxLength={40}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  onClick={() => void saveNote()}
                  disabled={!noteText.trim() || saving}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
                >
                  {saving ? "Sparar…" : "Spara anteckning"}
                </button>
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              {activities.length === 0 && (
                <li className="text-xs italic text-slate-400">Inga loggade samtal ännu.</li>
              )}
              {activities.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>{fmtDateTime(a.created_at)}</span>
                    {a.operator && (
                      <span className="rounded-full bg-slate-200 px-1.5 py-px font-medium text-slate-600">
                        {a.operator}
                      </span>
                    )}
                  </div>
                  {a.body && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}

function ScheduleField({
  icon,
  label,
  value,
  overdue,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  overdue?: boolean;
  onChange: (iso: string | null) => void;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
        {icon} {label}
        {overdue && (
          <span className="rounded-full bg-rose-100 px-1.5 py-px text-[10px] font-medium text-rose-700">
            försenad
          </span>
        )}
      </label>
      <div className="flex items-center gap-1">
        <input
          type="datetime-local"
          value={toDatetimeLocalValue(value)}
          onChange={(e) => onChange(fromDatetimeLocalValue(e.target.value))}
          className={`w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 ${overdue ? "border-rose-300 bg-rose-50" : "border-slate-200"}`}
        />
        {value && (
          <button
            onClick={() => onChange(null)}
            title="Rensa"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
