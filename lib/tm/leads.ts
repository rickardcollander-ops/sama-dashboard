// Shared TM (telemarketing) lead types and pure helpers.
//
// These used to live inside app/tm/[id]/page.tsx. They're lifted here so the
// campaign table, the LeadDrawer (kundkort), and the worklist page all share a
// single source of truth for the Lead shape and the email/phone helpers.

export type CallStatus =
  | "new"
  | "called"
  | "no_answer_1"
  | "no_answer_2"
  | "no_answer_3"
  | "callback"
  | "phone_missing"
  | "answering_machine"
  | "not_interested"
  | "meeting_booked"
  | "converted";

export interface PriorCampaign {
  campaign_id: string;
  campaign_name: string;
  call_status: string;
}

export type ActivityKind =
  | "note"
  | "status_change"
  | "callback_set"
  | "meeting_set"
  | "system";

export interface LeadActivity {
  id: string;
  kind: ActivityKind;
  body: string | null;
  status: string | null;
  operator: string | null;
  created_at: string;
}

export interface Lead {
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
  call_status_updated_at: string | null;
  callback_at: string | null;
  meeting_at: string | null;
  updated_at?: string | null;
  activities?: LeadActivity[];
  prior_campaigns: PriorCampaign[];
}

export const CALL_STATUS_OPTIONS: { value: CallStatus; label: string; tone: string }[] = [
  { value: "new", label: "Ny", tone: "bg-slate-100 text-slate-700" },
  { value: "called", label: "Uppringd", tone: "bg-blue-100 text-blue-700" },
  { value: "no_answer_1", label: "Ej svar 1", tone: "bg-yellow-100 text-yellow-700" },
  { value: "no_answer_2", label: "Ej svar 2", tone: "bg-orange-100 text-orange-700" },
  { value: "no_answer_3", label: "Ej svar 3", tone: "bg-rose-100 text-rose-700" },
  { value: "callback", label: "Ring tillbaka", tone: "bg-amber-100 text-amber-700" },
  { value: "phone_missing", label: "Telefonnummer saknas", tone: "bg-orange-100 text-orange-700" },
  { value: "answering_machine", label: "Telesvarare", tone: "bg-yellow-100 text-yellow-700" },
  { value: "not_interested", label: "Ej intresserad", tone: "bg-rose-100 text-rose-700" },
  { value: "meeting_booked", label: "Möte bokat", tone: "bg-violet-100 text-violet-700" },
  { value: "converted", label: "Konverterad", tone: "bg-emerald-100 text-emerald-700" },
];

export function callStatusLabel(s: string): string {
  return CALL_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

export function callStatusTone(s: string): string {
  return (
    CALL_STATUS_OPTIONS.find((o) => o.value === s)?.tone ?? "bg-slate-100 text-slate-700"
  );
}

export function scoreTone(s: number | null): string {
  if (s == null) return "text-slate-400";
  if (s >= 80) return "text-emerald-600";
  if (s >= 50) return "text-amber-600";
  return "text-rose-600";
}

// Normaliserar svenska/internationella nummer till E.164. Phone Link kräver
// detta format för att uppringningen ska fungera tillförlitligt.
export function toE164(raw: string | null | undefined): string | null {
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

// --- Email composition (shared between the table quick-action and the drawer) ---

interface ContactLike {
  company_name: string;
  domain: string | null;
  contact_first_name: string | null;
  contact_email: string | null;
  audit_score: number | null;
}

export function buildEmailParts(lead: ContactLike): {
  to: string;
  subject: string;
  body: string;
} {
  const to = lead.contact_email ?? "";
  const company = lead.company_name || lead.domain || "";
  const subject = `Information om er sajt${company ? ` — ${company}` : ""}`;
  const greeting = lead.contact_first_name ? `Hej ${lead.contact_first_name},` : "Hej,";
  const auditLine =
    lead.audit_score != null
      ? `Vi körde en snabb AI-läsbarhetsanalys av ${lead.domain || "er sajt"} och fick en score på ${lead.audit_score}/100. Jag tänkte dela vad vi hittade och prata om hur ni kan lyfta synligheten.`
      : `Vi har tittat på ${lead.domain || "er sajt"} och har några konkreta förbättringar för synlighet i Google och AI-assistenter (ChatGPT, Claude, Perplexity).`;
  const body = `${greeting}\n\n${auditLine}\n\nFinns det 15 minuter nästa vecka för en kort genomgång?\n\n— SAMA-teamet`;
  return { to, subject, body };
}

export function buildMailto(lead: ContactLike): string {
  const { to, subject, body } = buildEmailParts(lead);
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildGmailCompose(lead: ContactLike): string {
  const { to, subject, body } = buildEmailParts(lead);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function contactName(lead: {
  contact_first_name: string | null;
  contact_last_name: string | null;
}): string {
  return [lead.contact_first_name, lead.contact_last_name].filter(Boolean).join(" ");
}
