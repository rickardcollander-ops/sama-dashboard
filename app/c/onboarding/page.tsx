"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Globe, Star, Rocket, ChevronRight, ChevronLeft,
  Plus, X, Loader2, CheckCircle, Search,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useUser } from "@/lib/hooks/useUser";
import { tenantApi } from "@/lib/api";

const STEPS = [
  { label: "Varumärke", icon: Building2 },
  { label: "Konkurrenter", icon: Globe },
  { label: "Sökfrågor", icon: Search },
  { label: "Recensioner", icon: Star },
  { label: "Klart", icon: Rocket },
];

interface OnboardingData {
  brand_name: string;
  domain: string;
  brand_description: string;
  target_audience: string;
  content_language: string;
  competitors: string[];
  geo_queries: string[];
  review_g2_url: string;
  review_capterra_url: string;
  review_trustpilot_url: string;
}

const CONTENT_LANGUAGES = [
  { code: "en", label: "Engelska" },
  { code: "sv", label: "Svenska" },
  { code: "de", label: "Tyska" },
  { code: "fr", label: "Franska" },
  { code: "es", label: "Spanska" },
  { code: "no", label: "Norska" },
  { code: "da", label: "Danska" },
  { code: "fi", label: "Finska" },
  { code: "nl", label: "Nederländska" },
];

const INITIAL: OnboardingData = {
  brand_name: "",
  domain: "",
  brand_description: "",
  target_audience: "",
  content_language: "en",
  competitors: [],
  geo_queries: [],
  review_g2_url: "",
  review_capterra_url: "",
  review_trustpilot_url: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newGeoQuery, setNewGeoQuery] = useState("");
  const [activatingAgents, setActivatingAgents] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/c/login");
    }
  }, [user, userLoading, router]);

  const update = (field: keyof OnboardingData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const addCompetitor = () => {
    const c = newCompetitor.trim();
    if (c && !data.competitors.includes(c)) {
      setData((prev) => ({ ...prev, competitors: [...prev.competitors, c] }));
      setNewCompetitor("");
    }
  };

  const removeCompetitor = (c: string) => {
    setData((prev) => ({ ...prev, competitors: prev.competitors.filter((x) => x !== c) }));
  };

  const addGeoQuery = () => {
    const q = newGeoQuery.trim();
    if (q && !data.geo_queries.includes(q)) {
      setData((prev) => ({ ...prev, geo_queries: [...prev.geo_queries, q] }));
      setNewGeoQuery("");
    }
  };

  const removeGeoQuery = (q: string) => {
    setData((prev) => ({ ...prev, geo_queries: prev.geo_queries.filter((x) => x !== q) }));
  };

  const canAdvance = () => {
    if (step === 0) {
      const domainOk = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(data.domain.trim());
      return data.brand_name.trim().length > 0 && domainOk;
    }
    if (step === 1) return data.competitors.length >= 1;
    return true;
  };

  const validationHint = () => {
    if (step === 0) {
      if (!data.brand_name.trim()) return "Varumärkesnamn krävs";
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(data.domain.trim()))
        return "Ange en giltig domän (t.ex. exempel.se)";
      return null;
    }
    if (step === 1 && data.competitors.length < 1)
      return "Lägg till minst en konkurrent så SAMA kan jämföra";
    return null;
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaveError(null);
    setSaving(true);
    try {
      const settings = {
        brand_name: data.brand_name,
        domain: data.domain,
        brand_description: data.brand_description,
        target_audience: data.target_audience,
        content_language: data.content_language,
        competitors: data.competitors,
        review_g2_url: data.review_g2_url,
        review_capterra_url: data.review_capterra_url,
        review_trustpilot_url: data.review_trustpilot_url,
        geo_queries: data.geo_queries,
        geo_platforms: ["ChatGPT", "Perplexity", "Claude", "Google AIO"],
      };

      // Save to user_sites (first site uses id = user.id for backend compat).
      const { error: upsertError } = await getSupabaseBrowser()
        .from("user_sites")
        .upsert(
          {
            id: user.id,
            user_id: user.id,
            site_name: data.brand_name,
            settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      // Trigger initial agent activation
      setActivatingAgents(true);
      try {
        const client = tenantApi(user.id);
        await client.post("/api/tenant/activate");
      } catch (activateErr) {
        console.error("Agent activation failed (non-blocking):", activateErr);
      }
      setActivatingAgents(false);

      router.push("/c/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Kunde inte spara dina uppgifter";
      console.error("Failed to save onboarding data:", err);
      setSaveError(message);
    } finally {
      setSaving(false);
      setActivatingAgents(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="relative text-center mb-10">
          <button
            onClick={() => router.push("/c/dashboard")}
            className="absolute right-0 top-0 p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Hoppa över"
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="text-3xl font-bold">Konfigurera SAMA</h1>
          <p className="mt-2 text-zinc-400">
            Sätt upp dina marknads-AI-agenter på några minuter
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === step
                    ? "bg-blue-500 text-white"
                    : i < step
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {i < step ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <s.icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-6 ${i < step ? "bg-emerald-500" : "bg-zinc-800"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Varumärke</h2>
                <p className="text-sm text-zinc-400">Berätta om er verksamhet så SAMA kan representera er på rätt sätt.</p>
              </div>
              <Field label="Varumärkesnamn *" value={data.brand_name} onChange={(v) => update("brand_name", v)} placeholder="Acme AB" />
              <Field label="Domän *" value={data.domain} onChange={(v) => update("domain", v)} placeholder="acme.se" />
              <FieldTextarea label="Beskrivning" value={data.brand_description} onChange={(v) => update("brand_description", v)} placeholder="Vad gör ert företag?" />
              <FieldTextarea label="Målgrupp" value={data.target_audience} onChange={(v) => update("target_audience", v)} placeholder="Lokala småföretag, e-handelsbolag, restauranger..." />
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Språk för content</label>
                <select
                  value={data.content_language}
                  onChange={(e) => update("content_language", e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {CONTENT_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">Språket SAMA använder när content skapas för ert varumärke.</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Konkurrenter</h2>
                <p className="text-sm text-zinc-400">Lägg till 3–5 konkurrenter via domän. SAMA jämför er mot dem.</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCompetitor())}
                  placeholder="konkurrent.se"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={addCompetitor} className="rounded-lg bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.competitors.length === 0 && (
                  <p className="text-sm text-zinc-500">Inga konkurrenter tillagda än</p>
                )}
                {data.competitors.map((c) => (
                  <span key={c} className="flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-sm text-blue-300 border border-blue-500/30">
                    {c}
                    <button onClick={() => removeCompetitor(c)} className="hover:text-red-400"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Sökfrågor till AI</h2>
                <p className="text-sm text-zinc-400">Frågor ni vill bevaka i AI-assistenter (ChatGPT, Claude, Perplexity m.fl.).</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGeoQuery}
                  onChange={(e) => setNewGeoQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGeoQuery())}
                  placeholder='t.ex. "bästa frisören i Stockholm"'
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={addGeoQuery} className="rounded-lg bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {data.geo_queries.length === 0 && (
                  <p className="text-sm text-zinc-500">Inga frågor tillagda än. Du kan lägga till dem senare i Inställningar.</p>
                )}
                {data.geo_queries.map((q) => (
                  <div key={q} className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2">
                    <span className="text-sm text-zinc-300">&ldquo;{q}&rdquo;</span>
                    <button onClick={() => removeGeoQuery(q)} className="text-zinc-500 hover:text-red-400"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Recensioner</h2>
                <p className="text-sm text-zinc-400">Länkar till era profilsidor på recensionssajter — SAMA bevakar och föreslår svar. Allt är valfritt.</p>
              </div>
              <Field label="G2-profil-URL" value={data.review_g2_url} onChange={(v) => update("review_g2_url", v)} placeholder="https://www.g2.com/products/..." />
              <Field label="Capterra-profil-URL" value={data.review_capterra_url} onChange={(v) => update("review_capterra_url", v)} placeholder="https://www.capterra.com/p/..." />
              <Field label="Trustpilot-profil-URL" value={data.review_trustpilot_url} onChange={(v) => update("review_trustpilot_url", v)} placeholder="https://www.trustpilot.com/review/..." />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-center py-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Rocket className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Klart att starta!</h2>
                <p className="text-sm text-zinc-400 max-w-md mx-auto">
                  SAMA börjar nu bevaka ert varumärke i Google, AI-assistenter, recensionssajter och sociala medier.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-800/50 p-6 text-left max-w-sm mx-auto space-y-3">
                <SummaryRow label="Varumärke" value={data.brand_name} />
                <SummaryRow label="Domän" value={data.domain} />
                <SummaryRow label="Konkurrenter" value={data.competitors.length > 0 ? data.competitors.join(", ") : "Inga"} />
                <SummaryRow label="Sökfrågor" value={data.geo_queries.length > 0 ? `${data.geo_queries.length} st` : "Inga"} />
              </div>
            </div>
          )}
        </div>

        {/* Validation / save error */}
        {(validationHint() || saveError) && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
            {saveError ?? validationHint()}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Tillbaka
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
            >
              Nästa <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving || activatingAgents}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 transition-colors"
            >
              {(saving || activatingAgents) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {activatingAgents ? "Konfigurerar agenterna…" : saving ? "Sparar…" : "Starta SAMA"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

function FieldTextarea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="text-white font-medium truncate ml-4 max-w-[200px]">{value}</span>
    </div>
  );
}
