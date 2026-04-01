"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings, Key, Globe, Users, Search, Bot, Save, CheckCircle,
  AlertCircle, Eye, EyeOff, Plus, X, Loader2, Megaphone,
  ChevronDown, ChevronUp, Unplug, BarChart2, ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/hooks/useUser";
import { api } from "@/lib/api";
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
  meta_ads_token: string;
  meta_ads_account_id: string;
  linkedin_ads_token: string;
  linkedin_ads_account_id: string;
  google_ads_token: string;
  google_ads_account_id: string;
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
  meta_ads_token: "",
  meta_ads_account_id: "",
  linkedin_ads_token: "",
  linkedin_ads_account_id: "",
  google_ads_token: "",
  google_ads_account_id: "",
};

const AVAILABLE_PLATFORMS = ["ChatGPT", "Perplexity", "Claude", "Google AIO", "Gemini", "Microsoft Copilot"];

interface GoogleServiceStatus {
  search_console: boolean;
  analytics: boolean;
  ads: boolean;
}

const GOOGLE_SERVICES = [
  {
    key: "search_console" as const,
    label: "Google Search Console",
    icon: Search,
    description: "Visa sökdata, klick och positioner från Google",
  },
  {
    key: "analytics" as const,
    label: "Google Analytics (GA4)",
    icon: BarChart2,
    description: "Visa trafik, konverteringar och beteendedata",
  },
  {
    key: "ads" as const,
    label: "Google Ads",
    icon: Megaphone,
    description: "Hantera kampanjer och se annonsresultat",
  },
];

export default function CustomerSettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    }>
      <CustomerSettingsPageInner />
    </Suspense>
  );
}

function CustomerSettingsPageInner() {
  const { user } = useUser();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [expandedAdPlatform, setExpandedAdPlatform] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<GoogleServiceStatus>({
    search_console: false,
    analytics: false,
    ads: false,
  });
  const [googleLoading, setGoogleLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [googleError, setGoogleError] = useState("");

  const searchParams = useSearchParams();
  const googleConnected = searchParams.get("google_connected");
  const googleErrorParam = searchParams.get("google_error");

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  useEffect(() => {
    if (user) loadGoogleStatus();
  }, [user]);

  useEffect(() => {
    if (googleConnected) {
      setSuccessMessage(`${googleConnected} ansluten!`);
      window.history.replaceState({}, "", "/c/settings");
      loadGoogleStatus();
    }
    if (googleErrorParam) {
      setGoogleError("Kunde inte ansluta till Google. Försök igen.");
      window.history.replaceState({}, "", "/c/settings");
    }
  }, [googleConnected, googleErrorParam]);

  const loadGoogleStatus = async () => {
    if (!user) return;
    try {
      const data = await api.get<GoogleServiceStatus>(
        `/api/auth/google/status?tenant_id=${user.id}`
      );
      setGoogleStatus(data);
    } catch {
      // Status endpoint not yet available
    }
  };

  const connectGoogle = (service: string) => {
    if (!user) return;
    window.location.href = `${api.baseUrl}/api/auth/google/connect?service=${service}&tenant_id=${user.id}`;
  };

  const disconnectGoogle = async (service: string) => {
    if (!user) return;
    setGoogleLoading(service);
    try {
      await api.delete(
        `/api/auth/google/disconnect?service=${service}&tenant_id=${user.id}`
      );
      await loadGoogleStatus();
    } catch {
      setGoogleError("Kunde inte koppla från. Försök igen.");
    }
    setGoogleLoading(null);
  };

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

        {successMessage && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> {successMessage}
            </div>
            <button onClick={() => setSuccessMessage("")} className="text-emerald-600 hover:text-emerald-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {googleError && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {googleError}
            </div>
            <button onClick={() => setGoogleError("")} className="text-red-600 hover:text-red-800">
              <X className="h-4 w-4" />
            </button>
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

          {/* ── Google Integrations ── */}
          <Section icon={Globe} title="Google-integrationer" desc="Anslut dina Google-tjänster via OAuth för automatisk datasynk">
            <div className="space-y-4">
              {GOOGLE_SERVICES.map(({ key, label, icon: ServiceIcon, description }) => {
                const connected = googleStatus[key];
                const isLoading = googleLoading === key;
                return (
                  <div key={key} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${connected ? "bg-emerald-50" : "bg-slate-100"}`}>
                          <ServiceIcon className={`h-5 w-5 ${connected ? "text-emerald-500" : "text-slate-400"}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-slate-900">{label}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        {connected ? (
                          <>
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <CheckCircle className="h-3.5 w-3.5" /> Ansluten
                            </span>
                            <button
                              onClick={() => disconnectGoogle(key)}
                              disabled={isLoading}
                              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
                              Koppla från
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => connectGoogle(key)}
                            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Anslut
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ── Ad Platforms ── */}
          <Section icon={Megaphone} title="Annonsplattformar" desc="Anslut dina annonskonton för automatisk synk och analys">
            <div className="space-y-4">
              {([
                {
                  key: "meta",
                  label: "Meta Ads",
                  tokenField: "meta_ads_token" as const,
                  accountField: "meta_ads_account_id" as const,
                  instructions: [
                    "Gå till developers.facebook.com och skapa en app",
                    "Generera en User Access Token med ads_read behörighet",
                    "Kopiera ditt Ad Account ID från Ads Manager",
                    "Klistra in båda värdena nedan",
                  ],
                },
                {
                  key: "linkedin",
                  label: "LinkedIn Ads",
                  tokenField: "linkedin_ads_token" as const,
                  accountField: "linkedin_ads_account_id" as const,
                  instructions: [
                    "Gå till linkedin.com/developers och skapa en app",
                    "Begär Marketing Developer Platform-åtkomst",
                    "Generera en OAuth 2.0 access token",
                    "Hämta ditt Sponsored Account ID från Campaign Manager",
                  ],
                },
                {
                  key: "google",
                  label: "Google Ads",
                  tokenField: "google_ads_token" as const,
                  accountField: "google_ads_account_id" as const,
                  instructions: [
                    "Gå till console.cloud.google.com och aktivera Google Ads API",
                    "Skapa OAuth2-credentials och generera en refresh token",
                    "Hämta ditt Customer ID från Google Ads (xxx-xxx-xxxx)",
                    "Klistra in båda värdena nedan",
                  ],
                },
              ]).map(({ key, label, tokenField, accountField, instructions }) => {
                const isConnected = !!(settings[tokenField] && settings[accountField]);
                const isExpanded = expandedAdPlatform === key;
                return (
                  <div key={key} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${isConnected ? "bg-emerald-50" : "bg-slate-100"}`}>
                          <Megaphone className={`h-4 w-4 ${isConnected ? "text-emerald-500" : "text-slate-400"}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-slate-900">{label}</h4>
                          <p className={`text-xs ${isConnected ? "text-emerald-600" : "text-slate-400"}`}>
                            {isConnected ? "Ansluten" : "Ej ansluten"}
                            {isConnected && <CheckCircle className="h-3 w-3 inline ml-1" />}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedAdPlatform(isExpanded ? null : key)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                        {isConnected ? (
                          <>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Access Token</span>
                                <span className="font-mono text-xs text-slate-400">
                                  {"*".repeat(8)}...{settings[tokenField].slice(-4)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Account ID</span>
                                <span className="font-mono text-xs text-slate-400">{settings[accountField]}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSettings((prev) => ({
                                  ...prev,
                                  [tokenField]: "",
                                  [accountField]: "",
                                }));
                              }}
                              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                            >
                              <Unplug className="h-3.5 w-3.5" /> Koppla från
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Setup instructions */}
                            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                              <p className="text-xs font-medium text-blue-800 mb-2">Så här ansluter du:</p>
                              <ol className="space-y-1 list-decimal list-inside text-xs text-blue-700">
                                {instructions.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Access Token</label>
                                <input
                                  type="password"
                                  value={settings[tokenField]}
                                  onChange={(e) => updateField(tokenField, e.target.value)}
                                  placeholder="Klistra in din access token..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Account ID</label>
                                <input
                                  type="text"
                                  value={settings[accountField]}
                                  onChange={(e) => updateField(accountField, e.target.value)}
                                  placeholder="Ditt konto-ID..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
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
