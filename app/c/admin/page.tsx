"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield, Trash2, Mail, RefreshCw, UserPlus, AlertCircle,
  CheckCircle2, Loader2, X, Eye, Globe, ChevronRight, Phone,
  Gift, Ban, KeyRound, Copy, AtSign, MoreHorizontal, Eraser,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { isAdminEmail } from "@/lib/admin";

interface SiteSummary {
  id: string;
  site_name: string;
  brand_name: string | null;
  domain: string | null;
}

// Mirrors /api/admin/grant-free-access GET response so the PlanBadge can
// render the right status pill + trail (days left for trial, until-date for
// admin grants). Kept as a free-standing interface so /c/admin can use it
// in the planStatuses state and the GET response typing.
interface PlanStatusEntry {
  plan: string | null;
  plan_status: string | null;
  trial_ends_at: string | null;
  admin_granted_until: string | null;
}

interface Account {
  id: string;
  email?: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  brand_name: string | null;
  domain: string | null;
  has_settings: boolean;
  last_seen_at: string | null;
  sites: SiteSummary[];
  plan: string | null;
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function isOnline(lastSeen: string | null, now: number): boolean {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  if (Number.isNaN(t)) return false;
  return now - t < ONLINE_THRESHOLD_MS;
}

const BUSINESS_TYPES = [
  { code: "", label: "Select type…" },
  { code: "ecommerce", label: "E-commerce" },
  { code: "local", label: "Local business" },
  { code: "services", label: "Service business" },
  { code: "software", label: "Software / SaaS" },
  { code: "media", label: "Media / publisher" },
  { code: "other", label: "Other" },
];

const CONTENT_LANGUAGES = [
  { code: "sv", label: "Swedish" },
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "no", label: "Norwegian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "nl", label: "Dutch" },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── New customer modal ─────────────────────────────────────────────────────────

interface NewCustomerForm {
  domain: string;
  email: string;
  brand_name: string;
  brand_description: string;
  content_language: string;
  business_type: string;
  geo_queries: string[];
}

interface NewCustomerModalProps {
  onClose: () => void;
  onCreated: (email: string, invited: boolean) => void;
  onError: (msg: string) => void;
}

function NewCustomerModal({ onClose, onCreated, onError }: NewCustomerModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [domainInput, setDomainInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewCustomerForm>({
    domain: "", email: "", brand_name: "", brand_description: "",
    content_language: "sv", business_type: "", geo_queries: [],
  });
  const [selectedQueries, setSelectedQueries] = useState<string[]>([]);
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);

  const handleAnalyze = async () => {
    const raw = domainInput.trim();
    if (!raw) return;
    const domain = raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
    setAnalyzing(true);
    try {
      const res = await fetch("/api/onboarding/prefill-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json().catch(() => ({}));
      setSuggestedQueries(data.suggested_queries ?? []);
      setSelectedQueries(data.suggested_queries ?? []);
      setForm((prev) => ({
        ...prev,
        domain,
        brand_name: data.brand_name || domain.split(".")[0],
        brand_description: data.brand_description || "",
        content_language: data.content_language || "sv",
      }));
    } catch {
      setForm((prev) => ({ ...prev, domain }));
    } finally {
      setAnalyzing(false);
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!form.domain) return;
    setSubmitting(true);
    try {
      const settings = {
        brand_name: form.brand_name,
        domain: form.domain,
        brand_description: form.brand_description,
        content_language: form.content_language,
        business_type: form.business_type,
        geo_queries: selectedQueries,
        geo_platforms: ["ChatGPT", "Perplexity", "Claude", "Google AIO"],
        competitors: [],
      };
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim() || "", settings }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const result = await res.json().catch(() => ({}));
      onCreated(form.email.trim() || form.domain, result.invited === true);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not create customer");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleQuery = (q: string) =>
    setSelectedQueries((prev) => prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {step === 1 ? "New customer — Domain analysis" : "New customer — Review & invite"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {step === 1 && (
            <>
              <p className="text-sm text-slate-500">
                Enter the customer's domain and SAMA will fetch brand name, description and suggested GEO queries automatically.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !analyzing && void handleAnalyze()}
                  placeholder="example.com"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => void handleAnalyze()}
                  disabled={!domainInput.trim() || analyzing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  {analyzing ? "Analysing…" : "Analyse"}
                </button>
              </div>
              {analyzing && (
                <p className="text-xs text-slate-400">Fetching info from {domainInput.trim()}…</p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium">Domain:</span> {form.domain}
                <button
                  onClick={() => setStep(1)}
                  className="ml-3 text-xs text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>

              <div>
                <Field label="Email (optional)" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="customer@company.com" type="email" />
                <p className="mt-1 text-xs text-slate-400">
                  Leave empty to create an account without an invitation — the customer can add a login later.
                </p>
              </div>
              <Field label="Brand name" value={form.brand_name} onChange={(v) => setForm((p) => ({ ...p, brand_name: v }))} placeholder="Acme Inc." />
              <FieldTextarea label="Description" value={form.brand_description} onChange={(v) => setForm((p) => ({ ...p, brand_description: v }))} placeholder="What does the company do?" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Business type</label>
                  <select
                    value={form.business_type}
                    onChange={(e) => setForm((p) => ({ ...p, business_type: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {BUSINESS_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Language</label>
                  <select
                    value={form.content_language}
                    onChange={(e) => setForm((p) => ({ ...p, content_language: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {CONTENT_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              {suggestedQueries.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    Suggested AI monitoring queries — pick the ones to include
                  </label>
                  <div className="space-y-1.5">
                    {suggestedQueries.map((q) => (
                      <label key={q} className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={selectedQueries.includes(q)}
                          onChange={() => toggleQuery(q)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-blue-600"
                        />
                        <span className="text-xs text-slate-700">{q}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          {step === 1 ? (
            <button
              onClick={() => void handleAnalyze()}
              disabled={!domainInput.trim() || analyzing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              Next
            </button>
          ) : (
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {submitting ? "Creating…" : form.email.trim() ? "Create customer & send invite" : "Create customer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

function FieldTextarea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

// ── Plan badge + Grant modal ───────────────────────────────────────────────────

function PlanBadge({ entry, now }: { entry: PlanStatusEntry | undefined; now: number }) {
  if (!entry) return <span className="text-xs text-slate-400">—</span>;
  const status = entry.plan_status ?? "";
  const plan = entry.plan ?? "";
  const styles: Record<string, string> = {
    trial: "bg-amber-100 text-amber-800",
    active: "bg-emerald-100 text-emerald-800",
    trialing: "bg-emerald-100 text-emerald-800",
    admin_granted: "bg-purple-100 text-purple-800",
    past_due: "bg-orange-100 text-orange-800",
    canceled: "bg-slate-200 text-slate-600",
    expired: "bg-rose-100 text-rose-800",
  };
  const label = (
    {
      trial: "Trial",
      active: "Active",
      trialing: "Trialing",
      admin_granted: "Free (admin)",
      past_due: "Past due",
      canceled: "Canceled",
      expired: "Expired",
    } as Record<string, string>
  )[status] ?? (status || "—");
  const cls = styles[status] ?? "bg-slate-100 text-slate-600";
  let tail: string | null = null;
  if (status === "trial" && entry.trial_ends_at) {
    const days = Math.ceil((new Date(entry.trial_ends_at).getTime() - now) / 86_400_000);
    tail = days > 0 ? `${days}d left` : "expired";
  } else if (status === "admin_granted" && entry.admin_granted_until) {
    tail = `until ${new Date(entry.admin_granted_until).toLocaleDateString()}`;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
        {label}
      </span>
      <span className="text-[11px] text-slate-500">
        {plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : ""}
        {tail ? ` · ${tail}` : ""}
      </span>
    </div>
  );
}

function GrantModal({
  account,
  onClose,
  onSubmit,
  submitting,
}: {
  account: Account;
  onClose: () => void;
  onSubmit: (payload: { granted_until: string | null; note?: string }) => void;
  submitting: boolean;
}) {
  const [duration, setDuration] = useState("unlimited"); // unlimited | 7 | 30 | 90 | custom
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");

  function computeUntil(): string | null {
    if (duration === "unlimited") return null;
    if (duration === "custom") {
      if (!customDate) return null;
      const d = new Date(customDate);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const days = parseInt(duration, 10);
    if (Number.isNaN(days)) return null;
    return new Date(Date.now() + days * 86_400_000).toISOString();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-600" />
              Grant free access
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Override Stripe billing for {account.email ?? account.brand_name ?? account.id}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="unlimited">Unlimited (until manually revoked)</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="custom">Custom date</option>
            </select>
          </div>

          {duration === "custom" && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ends on</label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Pilot customer, partnership, etc."
              disabled={submitting}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSubmit({
                granted_until: computeUntil(),
                note: note.trim() || undefined,
              })
            }
            disabled={submitting || (duration === "custom" && !customDate)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
            Grant access
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Set password modal ─────────────────────────────────────────────────────────

function SetPasswordModal({
  account,
  onClose,
  onDone,
  onError,
}: {
  account: Account;
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [customPassword, setCustomPassword] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {};
      if (useCustom) {
        if (customPassword.length < 8) {
          onError("Lösenordet måste vara minst 8 tecken.");
          setSubmitting(false);
          return;
        }
        payload.password = customPassword;
      }
      const res = await fetch(`/api/admin/accounts/${account.id}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setResult(body.password);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte sätta lösenord");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — admin can copy manually */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Sätt nytt lösenord
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {account.email ?? account.brand_name ?? account.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Lösenordet är nu satt. Visa det för användaren — det visas inte igen.
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nytt lösenord</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={result}
                  className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:outline-none"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Kopierat!" : "Kopiera"}
                </button>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  onDone(`Nytt lösenord satt för ${account.email ?? account.id}`);
                }}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Klar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Sätter ett nytt lösenord på kontot direkt och markerar e-posten som bekräftad.
              Användaren kan logga in med det nya lösenordet omedelbart.
            </div>
            <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input
                type="radio"
                checked={!useCustom}
                onChange={() => setUseCustom(false)}
                disabled={submitting}
                className="mt-0.5 accent-amber-600"
              />
              <div className="text-sm">
                <div className="font-medium text-slate-900">Generera slumpmässigt</div>
                <div className="text-xs text-slate-500">
                  14 tecken, säkert. Visas en gång efteråt så du kan kopiera/skicka.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input
                type="radio"
                checked={useCustom}
                onChange={() => setUseCustom(true)}
                disabled={submitting}
                className="mt-0.5 accent-amber-600"
              />
              <div className="flex-1 text-sm">
                <div className="font-medium text-slate-900">Välj själv</div>
                {useCustom && (
                  <input
                    type="text"
                    autoFocus
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Minst 8 tecken"
                    disabled={submitting}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                )}
              </div>
            </label>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Avbryt
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting || (useCustom && customPassword.length < 8)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                Sätt lösenord
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Change email modal ────────────────────────────────────────────────────────

function ChangeEmailModal({
  account,
  onClose,
  onDone,
  onError,
}: {
  account: Account;
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [email, setEmail] = useState(account.email ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const next = email.trim().toLowerCase();
    if (!next || !next.includes("@")) {
      onError("Giltig e-post krävs");
      return;
    }
    if (next === (account.email ?? "").toLowerCase()) {
      onError("E-postadressen är oförändrad");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      onDone(`E-post ändrad till ${next}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte ändra e-post");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <AtSign className="h-5 w-5 text-blue-600" />
              Ändra e-post
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Nuvarande: {account.email ?? "(saknas)"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
            Den nya adressen markeras som bekräftad direkt — användaren behöver inte klicka på någon
            verifieringslänk för att logga in.
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Ny e-post</label>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="user@company.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              onKeyDown={(e) => e.key === "Enter" && !submitting && void handleSubmit()}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Avbryt
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || !email.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AtSign className="h-3.5 w-3.5" />}
              Spara
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Row actions dropdown ──────────────────────────────────────────────────────

interface MoreMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function MoreMenu({ items, disabled }: { items: MoreMenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Fler åtgärder"
        aria-label="Fler åtgärder"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => {
                if (it.disabled) return;
                setOpen(false);
                it.onClick();
              }}
              disabled={it.disabled}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${
                it.disabled
                  ? "cursor-not-allowed text-slate-300"
                  : it.destructive
                    ? "text-red-600 hover:bg-red-50"
                    : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="flex-shrink-0">{it.icon}</span>
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const { setViewAs } = useSite();
  const isAdmin = isAdminEmail(user?.email);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [inviteFor, setInviteFor] = useState<Account | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [planStatuses, setPlanStatuses] = useState<Record<string, PlanStatusEntry>>({});
  const [grantFor, setGrantFor] = useState<Account | null>(null);
  const [setPasswordFor, setSetPasswordFor] = useState<Account | null>(null);
  const [changeEmailFor, setChangeEmailFor] = useState<Account | null>(null);

  const load = useCallback(async () => {
    setFetching(true);
    setError("");
    try {
      const res = await fetch("/api/admin/accounts", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { accounts: Account[] };
      setAccounts(body.accounts);
      // Side-load plan statuses for the status column. Single batched call.
      const ids = body.accounts.map((a) => a.id);
      if (ids.length > 0) {
        try {
          const planRes = await fetch(
            `/api/admin/grant-free-access?user_ids=${encodeURIComponent(ids.join(","))}`,
            { cache: "no-store" },
          );
          if (planRes.ok) {
            const { statuses } = (await planRes.json()) as {
              statuses: Record<string, PlanStatusEntry>;
            };
            setPlanStatuses(statuses ?? {});
          }
        } catch {
          /* status column gracefully degrades to empty */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts");
    } finally {
      setFetching(false);
    }
  }, []);

  const handleGrant = useCallback(
    async (acc: Account, payload: { granted_until: string | null; note?: string }) => {
      setPendingId(acc.id);
      setError("");
      try {
        const res = await fetch("/api/admin/grant-free-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: acc.id,
            action: "grant",
            granted_until: payload.granted_until,
            note: payload.note,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setNotice(`Granted free access to ${acc.email ?? acc.id}`);
        setGrantFor(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not grant access");
      } finally {
        setPendingId(null);
      }
    },
    [load],
  );

  const handleRevoke = useCallback(
    async (acc: Account) => {
      if (!confirm(`Revoke free access for ${acc.email ?? acc.id}?`)) return;
      setPendingId(acc.id);
      setError("");
      try {
        const res = await fetch("/api/admin/grant-free-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: acc.id, action: "revoke" }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setNotice(`Revoked free access for ${acc.email ?? acc.id}`);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not revoke access");
      } finally {
        setPendingId(null);
      }
    },
    [load],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/c/login"); return; }
    if (!isAdmin) { router.push("/c/dashboard"); return; }
    void load();
  }, [user, loading, isAdmin, router, load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Tick once a second so the online dot recomputes against the threshold,
  // and refetch accounts every 30s so last_seen_at stays fresh.
  useEffect(() => {
    if (!isAdmin) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => void load(), 30_000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [isAdmin, load]);

  const handleClearContent = async (acc: Account) => {
    if (!confirm(`Rensa allt innehåll för ${acc.brand_name ?? acc.email ?? acc.id}? Artiklar och innehållsplan raderas permanent från SAMA-backenden. Onboarding-flaggan återställs.`)) return;
    setPendingId(acc.id);
    setError("");
    try {
      const res = await fetch("/api/admin/clear-site-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: acc.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setNotice(`Innehåll rensat för ${acc.brand_name ?? acc.email ?? acc.id}${body.errors ? ` (varningar: ${body.errors.join(", ")})` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte rensa innehåll");
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (acc: Account) => {
    if (!confirm(`Delete account ${acc.email ?? acc.id}? This cannot be undone.`)) return;
    setPendingId(acc.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/accounts/${acc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setNotice(`Deleted ${acc.email ?? acc.id}`);
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account");
    } finally {
      setPendingId(null);
    }
  };

  const handleViewAs = (acc: Account) => {
    setViewAs({ userId: acc.id, tenantId: acc.id, brandName: acc.brand_name ?? "", domain: acc.domain ?? "" });
    router.push("/c/dashboard");
  };

  // Direct invite from /c/admin: hits /api/account/members with the
  // customer's account_id explicitly in the header. Avoids the trap where an
  // admin invites from /c/settings/team while merely view-as'ing a customer
  // and the membership row silently gets written to the admin's own account.
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteFor) return;
    const email = inviteEmail.trim();
    if (!email || !email.includes("@")) {
      setError("Valid email required");
      return;
    }
    setInviting(true);
    setError("");
    try {
      const res = await fetch("/api/account/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sama-account-id": inviteFor.id,
        },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setNotice(
        body.invited
          ? `Invitation sent to ${email} for ${inviteFor.brand_name ?? inviteFor.email ?? "this account"}`
          : `${email} was added to ${inviteFor.brand_name ?? inviteFor.email ?? "this account"} (already had an account)`,
      );
      setInviteFor(null);
      setInviteEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleConfirmEmail = async (acc: Account) => {
    if (!confirm(`Markera ${acc.email ?? acc.id} som e-postbekräftad?`)) return;
    setPendingId(acc.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/accounts/${acc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_email: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setNotice(`E-post bekräftad för ${acc.email ?? acc.id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte bekräfta e-post");
    } finally {
      setPendingId(null);
    }
  };

  const handleResetPassword = async (acc: Account) => {
    setPendingId(acc.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/accounts/${acc.id}/reset-password`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setNotice(`Password reset email sent to ${acc.email ?? acc.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reset email");
    } finally {
      setPendingId(null);
    }
  };

  const filtered = accounts.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (
      (a.email ?? "").toLowerCase().includes(q) ||
      (a.brand_name ?? "").toLowerCase().includes(q) ||
      (a.domain ?? "").toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    ) {
      return true;
    }
    return a.sites.some(
      (s) =>
        (s.brand_name ?? "").toLowerCase().includes(q) ||
        (s.site_name ?? "").toLowerCase().includes(q) ||
        (s.domain ?? "").toLowerCase().includes(q),
    );
  });

  const confirmedCount = accounts.filter((a) => a.email_confirmed_at).length;
  const onboardedCount = accounts.filter((a) => a.has_settings).length;
  const onlineCount = accounts.filter((a) => isOnline(a.last_seen_at, now)).length;

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
            <div className="flex items-center gap-2 font-semibold">
              <Shield className="h-5 w-5" /> Forbidden
            </div>
            <p className="mt-2 text-sm">Only the admin can access this page.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onCreated={(label, invited) => {
            setShowNewCustomer(false);
            setNotice(invited ? `Customer created and invite sent to ${label}` : `Customer created for ${label}`);
            void load();
          }}
          onError={(msg) => {
            setShowNewCustomer(false);
            setError(msg);
          }}
        />
      )}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-slate-900">
              <Shield className="h-7 w-7 text-blue-600" />
              Admin
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage SAMA accounts. Signed in as {user?.email}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              disabled={fetching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/c/admin/email"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Mail className="h-3.5 w-3.5" />
              Mejl
            </Link>
            <Link
              href="/c/admin/campaigns"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
            >
              <Phone className="h-3.5 w-3.5" />
              Campaigns
            </Link>
            <button
              onClick={() => setShowNewCustomer(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              New customer
            </button>
          </div>
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
        {notice && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {notice}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">Total accounts</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{accounts.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">Online now</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  onlineCount > 0 ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" : "bg-slate-300"
                }`}
                aria-hidden
              />
              {onlineCount}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">Email confirmed</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{confirmedCount}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">Completed onboarding</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{onboardedCount}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, brand or domain…"
            className="w-full sm:w-80 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Last sign-in</th>
                <th className="px-4 py-3">Status</th>
                <th className="sticky right-0 bg-slate-50 px-4 py-3 text-right shadow-[inset_1px_0_0_0_rgb(226_232_240)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fetching && accounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!fetching && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No accounts match your search.
                  </td>
                </tr>
              )}
              {filtered.map((acc) => {
                const isSelf = isAdminEmail(acc.email);
                const busy = pendingId === acc.id;
                const online = isOnline(acc.last_seen_at, now);
                return (
                  <tr key={acc.id} className="group hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <span
                          title={
                            online
                              ? "Online now"
                              : acc.last_seen_at
                                ? `Last active ${fmtRelative(acc.last_seen_at)}`
                                : "Not active"
                          }
                          aria-label={online ? "Online" : "Offline"}
                          className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                            online
                              ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]"
                              : "bg-red-400"
                          }`}
                        />
                        <span>{acc.email ?? "(no email)"}</span>
                        {isSelf && (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            <Shield className="h-3 w-3" /> admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{acc.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      {acc.brand_name || acc.sites.length > 0 ? (
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-slate-900">
                              {acc.brand_name ?? acc.sites[0]?.site_name ?? "—"}
                            </span>
                            {acc.sites.length > 1 && (
                              <span
                                title={`${acc.sites.length} sites connected`}
                                className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                              >
                                +{acc.sites.length - 1} more
                              </span>
                            )}
                          </div>
                          {acc.domain && (
                            <div className="text-xs text-slate-400">{acc.domain}</div>
                          )}
                          {acc.sites.length > 1 && (
                            <ul className="mt-1.5 space-y-0.5 border-l-2 border-slate-100 pl-2">
                              {acc.sites.slice(1).map((s) => (
                                <li key={s.id} className="text-xs text-slate-500">
                                  <span className="text-slate-700">
                                    {s.brand_name || s.site_name || "(unnamed)"}
                                  </span>
                                  {s.domain && (
                                    <span className="text-slate-400"> · {s.domain}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No onboarding</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge entry={planStatuses[acc.id]} now={now} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{fmtDate(acc.created_at)}</div>
                      <div className="text-xs text-slate-400">{fmtRelative(acc.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{fmtDate(acc.last_sign_in_at)}</div>
                      <div className="text-xs text-slate-400">{fmtRelative(acc.last_sign_in_at)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {acc.email_confirmed_at ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="sticky right-0 bg-white px-4 py-3 shadow-[inset_1px_0_0_0_rgb(226_232_240)] group-hover:bg-slate-50/60">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleViewAs(acc)}
                          disabled={busy}
                          title="Visa kundens dashboard"
                          aria-label="View as"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setSetPasswordFor(acc)}
                          disabled={busy}
                          title="Sätt nytt lösenord direkt"
                          aria-label="Sätt nytt lösenord"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        {planStatuses[acc.id]?.plan_status === "admin_granted" ? (
                          <button
                            onClick={() => void handleRevoke(acc)}
                            disabled={busy}
                            title="Återkalla gratis åtkomst"
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                            Återkalla
                          </button>
                        ) : (
                          <button
                            onClick={() => setGrantFor(acc)}
                            disabled={busy}
                            title="Bevilja gratis åtkomst"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <Gift className="h-3 w-3" />
                            Bevilja
                          </button>
                        )}
                        <MoreMenu
                          disabled={busy}
                          items={[
                            {
                              label: "Bjud in teammedlem",
                              icon: <UserPlus className="h-3.5 w-3.5 text-violet-600" />,
                              onClick: () => {
                                setInviteFor(acc);
                                setInviteEmail("");
                                setError("");
                              },
                            },
                            {
                              label: "Skicka återställningsmail",
                              icon: <Mail className="h-3.5 w-3.5 text-slate-500" />,
                              onClick: () => void handleResetPassword(acc),
                              disabled: !acc.email,
                            },
                            {
                              label: "Ändra e-postadress",
                              icon: <AtSign className="h-3.5 w-3.5 text-blue-600" />,
                              onClick: () => setChangeEmailFor(acc),
                            },
                            {
                              label: "Rensa allt innehåll",
                              icon: <Eraser className="h-3.5 w-3.5 text-orange-600" />,
                              onClick: () => void handleClearContent(acc),
                              destructive: true,
                            },
                            ...(!acc.email_confirmed_at
                              ? [
                                  {
                                    label: "Bekräfta e-post manuellt",
                                    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
                                    onClick: () => void handleConfirmEmail(acc),
                                    disabled: !acc.email,
                                  },
                                ]
                              : []),
                            {
                              label: isSelf ? "Kan inte radera dig själv" : "Radera konto",
                              icon: <Trash2 className="h-3.5 w-3.5" />,
                              onClick: () => void handleDelete(acc),
                              disabled: isSelf,
                              destructive: true,
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Account data is fetched from Supabase Auth and the user_sites table.
          Deletion uses the Supabase admin API and removes the auth user along
          with every linked row via ON DELETE CASCADE.
        </p>
      </main>

      {grantFor && (
        <GrantModal
          account={grantFor}
          onClose={() => setGrantFor(null)}
          onSubmit={(payload) => void handleGrant(grantFor, payload)}
          submitting={pendingId === grantFor.id}
        />
      )}

      {setPasswordFor && (
        <SetPasswordModal
          account={setPasswordFor}
          onClose={() => setSetPasswordFor(null)}
          onDone={(msg) => {
            setSetPasswordFor(null);
            setNotice(msg);
            void load();
          }}
          onError={(msg) => {
            setError(msg);
          }}
        />
      )}

      {changeEmailFor && (
        <ChangeEmailModal
          account={changeEmailFor}
          onClose={() => setChangeEmailFor(null)}
          onDone={(msg) => {
            setChangeEmailFor(null);
            setNotice(msg);
            void load();
          }}
          onError={(msg) => {
            setError(msg);
          }}
        />
      )}

      {inviteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Invite team member</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Invites {inviteFor.brand_name ?? inviteFor.email ?? "this account"} — the new
                  member will get access to all sites under this customer&apos;s account.
                </p>
              </div>
              <button
                onClick={() => { setInviteFor(null); setInviteEmail(""); }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  autoFocus
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  disabled={inviting}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                />
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <div className="font-medium text-slate-700">Account target</div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-500">{inviteFor.id}</div>
                {inviteFor.sites.length > 0 && (
                  <div className="mt-1">
                    Will get access to: {inviteFor.sites.map((s) => s.brand_name || s.site_name).join(", ")}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setInviteFor(null); setInviteEmail(""); }}
                  disabled={inviting}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  Send invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
