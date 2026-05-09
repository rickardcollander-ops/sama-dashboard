"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Trash2, Mail, RefreshCw, UserPlus, AlertCircle,
  CheckCircle2, Loader2, X, Eye, Globe, ChevronRight,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { isAdminEmail } from "@/lib/admin";

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
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function isOnline(lastSeen: string | null, now: number): boolean {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  if (Number.isNaN(t)) return false;
  return now - t < ONLINE_THRESHOLD_MS;
}

const BUSINESS_TYPES = [
  { code: "", label: "Välj typ…" },
  { code: "ecommerce", label: "E-handel" },
  { code: "local", label: "Lokal näring" },
  { code: "services", label: "Tjänsteföretag" },
  { code: "software", label: "Programvara / SaaS" },
  { code: "media", label: "Media / publicist" },
  { code: "other", label: "Annat" },
];

const CONTENT_LANGUAGES = [
  { code: "sv", label: "Svenska" },
  { code: "en", label: "Engelska" },
  { code: "de", label: "Tyska" },
  { code: "fr", label: "Franska" },
  { code: "es", label: "Spanska" },
  { code: "no", label: "Norska" },
  { code: "da", label: "Danska" },
  { code: "fi", label: "Finska" },
  { code: "nl", label: "Nederländska" },
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

// ── Ny kund-modal ──────────────────────────────────────────────────────────────

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
      onError(e instanceof Error ? e.message : "Kunde inte skapa kunden");
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
            {step === 1 ? "Ny kund — Domänanalys" : "Ny kund — Granska & bjud in"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {step === 1 && (
            <>
              <p className="text-sm text-slate-500">
                Ange kundens domän så hämtar SAMA varumärke, beskrivning och föreslagna GEO-frågor automatiskt.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !analyzing && void handleAnalyze()}
                  placeholder="exempel.se"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => void handleAnalyze()}
                  disabled={!domainInput.trim() || analyzing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  {analyzing ? "Analyserar…" : "Analysera"}
                </button>
              </div>
              {analyzing && (
                <p className="text-xs text-slate-400">Hämtar info från {domainInput.trim()}…</p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium">Domän:</span> {form.domain}
                <button
                  onClick={() => setStep(1)}
                  className="ml-3 text-xs text-blue-600 hover:underline"
                >
                  Ändra
                </button>
              </div>

              <div>
                <Field label="E-post (valfritt)" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="kund@foretag.se" type="email" />
                <p className="mt-1 text-xs text-slate-400">
                  Lämna tomt för att skapa konto utan inbjudan — kunden kan lägga till inloggning senare.
                </p>
              </div>
              <Field label="Varumärkesnamn" value={form.brand_name} onChange={(v) => setForm((p) => ({ ...p, brand_name: v }))} placeholder="Acme AB" />
              <FieldTextarea label="Beskrivning" value={form.brand_description} onChange={(v) => setForm((p) => ({ ...p, brand_description: v }))} placeholder="Vad gör företaget?" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Typ av verksamhet</label>
                  <select
                    value={form.business_type}
                    onChange={(e) => setForm((p) => ({ ...p, business_type: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {BUSINESS_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Språk</label>
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
                    Föreslagna AI-bevakningsfrågor — välj de som ska inkluderas
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
            Avbryt
          </button>
          {step === 1 ? (
            <button
              onClick={() => void handleAnalyze()}
              disabled={!domainInput.trim() || analyzing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              Nästa
            </button>
          ) : (
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {submitting ? "Skapar…" : form.email.trim() ? "Skapa kund & skicka inbjudan" : "Skapa kund"}
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts");
    } finally {
      setFetching(false);
    }
  }, []);

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
    return (
      (a.email ?? "").toLowerCase().includes(q) ||
      (a.brand_name ?? "").toLowerCase().includes(q) ||
      (a.domain ?? "").toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
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
            setNotice(invited ? `Kund skapad och inbjudan skickad till ${label}` : `Kund skapad för ${label}`);
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
            <button
              onClick={() => setShowNewCustomer(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              Ny kund
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
            <p className="text-xs text-slate-500">Inloggad nu</p>
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
            placeholder="Sök på e-post, varumärke eller domän…"
            className="w-full sm:w-80 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Användare</th>
                <th className="px-4 py-3">Varumärke</th>
                <th className="px-4 py-3">Skapad</th>
                <th className="px-4 py-3">Senaste inloggning</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fetching && accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!fetching && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Inga konton matchar sökningen.
                  </td>
                </tr>
              )}
              {filtered.map((acc) => {
                const isSelf = isAdminEmail(acc.email);
                const busy = pendingId === acc.id;
                const online = isOnline(acc.last_seen_at, now);
                return (
                  <tr key={acc.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <span
                          title={
                            online
                              ? "Inloggad nu"
                              : acc.last_seen_at
                                ? `Senast aktiv ${fmtRelative(acc.last_seen_at)}`
                                : "Ej aktiv"
                          }
                          aria-label={online ? "Inloggad" : "Ej inloggad"}
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
                      {acc.brand_name ? (
                        <div>
                          <div className="font-medium text-slate-900">{acc.brand_name}</div>
                          {acc.domain && <div className="text-xs text-slate-400">{acc.domain}</div>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Ingen onboarding</span>
                      )}
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
                          <CheckCircle2 className="h-3 w-3" /> Bekräftad
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Väntar
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleViewAs(acc)}
                          disabled={busy}
                          title="Visa kundens dashboard"
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          <Eye className="h-3 w-3" /> Visa
                        </button>
                        <button
                          onClick={() => void handleResetPassword(acc)}
                          disabled={busy || !acc.email}
                          title="Skicka lösenordsåterställning"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                          Reset
                        </button>
                        <button
                          onClick={() => void handleDelete(acc)}
                          disabled={busy || isSelf}
                          title={isSelf ? "Cannot delete your own admin account" : "Delete account"}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Kontodata hämtas från Supabase Auth och user_sites-tabellen.
          Borttagning sker via Supabase admin-API och tar bort auth-användaren
          samt alla kopplade rader via ON DELETE CASCADE.
        </p>
      </main>
    </div>
  );
}
