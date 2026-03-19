"use client";

import { useState, useEffect } from "react";
import {
  Settings, Key, Globe, Users, Search, Bot, Save, CheckCircle,
  AlertCircle, Eye, EyeOff, Plus, X, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/hooks/useUser";
import CustomerNav from "@/components/CustomerNav";

interface UserSettings {
  openai_api_key: string;
  anthropic_api_key: string;
  perplexity_api_key: string;
  google_api_key: string;
  brand_name: string;
  domain: string;
  country: string;
  language: string;
  brand_description: string;
  target_audience: string;
  unique_selling_points: string;
  tone_of_voice: string;
  competitors: string[];
  geo_queries: string[];
  geo_platforms: string[];
}

const DEFAULT_SETTINGS: UserSettings = {
  openai_api_key: "",
  anthropic_api_key: "",
  perplexity_api_key: "",
  google_api_key: "",
  brand_name: "",
  domain: "",
  country: "SE",
  language: "sv",
  brand_description: "",
  target_audience: "",
  unique_selling_points: "",
  tone_of_voice: "professional",
  competitors: [],
  geo_queries: [],
  geo_platforms: ["ChatGPT", "Perplexity", "Claude", "Google AIO"],
};

const AVAILABLE_PLATFORMS = ["ChatGPT", "Perplexity", "Claude", "Google AIO", "Gemini", "Microsoft Copilot"];

export default function CustomerSettingsPage() {
  const { user } = useUser();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newQuery, setNewQuery] = useState("");

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data?.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      }
    } catch {
      // First time
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const { error: upsertError } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) throw upsertError;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kunde inte spara");
    }
    setSaving(false);
  };

  const updateField = (field: keyof UserSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const addCompetitor = () => {
    const c = newCompetitor.trim();
    if (c && !settings.competitors.includes(c)) {
      setSettings((prev) => ({ ...prev, competitors: [...prev.competitors, c] }));
      setNewCompetitor("");
    }
  };

  const removeCompetitor = (c: string) => {
    setSettings((prev) => ({ ...prev, competitors: prev.competitors.filter((x) => x !== c) }));
  };

  const addQuery = () => {
    const q = newQuery.trim();
    if (q && !settings.geo_queries.includes(q)) {
      setSettings((prev) => ({ ...prev, geo_queries: [...prev.geo_queries, q] }));
      setNewQuery("");
    }
  };

  const removeQuery = (q: string) => {
    setSettings((prev) => ({ ...prev, geo_queries: prev.geo_queries.filter((x) => x !== q) }));
  };

  const togglePlatform = (p: string) => {
    setSettings((prev) => ({
      ...prev,
      geo_platforms: prev.geo_platforms.includes(p)
        ? prev.geo_platforms.filter((x) => x !== p)
        : [...prev.geo_platforms, p],
    }));
  };

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Settings className="h-7 w-7 text-slate-400" />
              Inställningar
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Konfigurera API-nycklar, varumärke och GEO-övervakning
            </p>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Sparar…" : "Spara"}
          </button>
        </div>

        {saved && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle className="h-4 w-4" /> Inställningarna har sparats!
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        <div className="space-y-8">
          {/* ── API Keys ── */}
          <Section icon={Key} title="API-nycklar" desc="Nycklar för AI-plattformar som GEO-agenten använder">
            <div className="space-y-4">
              {([
                { key: "openai", field: "openai_api_key" as const, label: "OpenAI API Key", placeholder: "sk-..." },
                { key: "anthropic", field: "anthropic_api_key" as const, label: "Anthropic API Key", placeholder: "sk-ant-..." },
                { key: "perplexity", field: "perplexity_api_key" as const, label: "Perplexity API Key", placeholder: "pplx-..." },
                { key: "google", field: "google_api_key" as const, label: "Google API Key (SerpAPI)", placeholder: "..." },
              ]).map(({ key, field, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showKeys[key] ? "text" : "password"}
                        value={settings[field]}
                        onChange={(e) => updateField(field, e.target.value)}
                        placeholder={placeholder}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(key)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showKeys[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {settings[field] && (
                      <span className="flex items-center rounded-lg bg-green-100 px-2 text-xs font-medium text-green-700 border border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" /> Satt
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Brand ── */}
          <Section icon={Globe} title="Varumärke & Domän" desc="Information om ditt varumärke för agenternas kontext">
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Varumärke" value={settings.brand_name} onChange={(v) => updateField("brand_name", v)} placeholder="Acme Corp" />
              <InputField label="Domän" value={settings.domain} onChange={(v) => updateField("domain", v)} placeholder="acme.com" />
              <InputField label="Land" value={settings.country} onChange={(v) => updateField("country", v)} placeholder="SE" />
              <InputField label="Språk" value={settings.language} onChange={(v) => updateField("language", v)} placeholder="sv" />
            </div>
            <div className="mt-4 space-y-4">
              <TextareaField label="Beskrivning" value={settings.brand_description} onChange={(v) => updateField("brand_description", v)} placeholder="Kort beskrivning av vad ni gör…" />
              <TextareaField label="Målgrupp" value={settings.target_audience} onChange={(v) => updateField("target_audience", v)} placeholder="B2B SaaS-företag med 50-500 anställda…" />
              <TextareaField label="USP:ar" value={settings.unique_selling_points} onChange={(v) => updateField("unique_selling_points", v)} placeholder="AI-driven, 10x snabbare, bäst på svenska marknaden…" />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tonalitet</label>
                <select
                  value={settings.tone_of_voice}
                  onChange={(e) => updateField("tone_of_voice", e.target.value)}
                  className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="professional">Professionell</option>
                  <option value="casual">Avslappnad</option>
                  <option value="technical">Teknisk</option>
                  <option value="friendly">Vänlig</option>
                  <option value="bold">Modig / Bold</option>
                </select>
              </div>
            </div>
          </Section>

          {/* ── Competitors ── */}
          <Section icon={Users} title="Konkurrenter" desc="Varumärken att jämföra med i GEO-övervakningen">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newCompetitor}
                onChange={(e) => setNewCompetitor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCompetitor())}
                placeholder="Lägg till konkurrent…"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button onClick={addCompetitor} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.competitors.length === 0 && <p className="text-sm text-slate-400">Inga konkurrenter tillagda</p>}
              {settings.competitors.map((c) => (
                <span key={c} className="flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800 border border-orange-200">
                  {c}
                  <button onClick={() => removeCompetitor(c)} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          </Section>

          {/* ── GEO Queries ── */}
          <Section icon={Search} title="GEO-sökfrågor" desc="Frågor att ställa till AI-plattformarna för att tracka ditt varumärke">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuery())}
                placeholder='T.ex. "bästa CRM för startups"'
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button onClick={addQuery} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {settings.geo_queries.length === 0 && <p className="text-sm text-slate-400">Inga sökfrågor tillagda</p>}
              {settings.geo_queries.map((q) => (
                <div key={q} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2">
                  <span className="text-sm text-slate-700">&ldquo;{q}&rdquo;</span>
                  <button onClick={() => removeQuery(q)} className="text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </Section>

          {/* ── AI Platforms ── */}
          <Section icon={Bot} title="AI-plattformar" desc="Vilka AI-plattformar ska GEO-agenten övervaka?">
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_PLATFORMS.map((p) => {
                const active = settings.geo_platforms.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-violet-300 bg-violet-100 text-violet-800"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Bottom save */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Sparar…" : "Spara inställningar"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: {
  icon: React.ElementType; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <Icon className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <p className="text-sm text-slate-500 mb-5 ml-8">{desc}</p>
      {children}
    </section>
  );
}

function InputField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
      />
    </div>
  );
}
