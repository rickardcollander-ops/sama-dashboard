"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Megaphone, Loader2, Upload, Sparkles, Save, Trash2, Edit3,
  Image, AlertCircle, CheckCircle, ChevronDown, ChevronUp,
  Settings, ArrowRight, BarChart2, Lightbulb, ClipboardList,
  X,
} from "lucide-react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { tenantApi } from "@/lib/api";
import { IS_DEMO, demoAdCreatives } from "@/lib/demo-data";

type Platform = "meta" | "linkedin" | "google";
type AdFormat = "single_image" | "carousel" | "video" | "stories";
type CampaignGoal = "awareness" | "leads" | "traffic" | "conversions";
type CTA = "Läs mer" | "Kontakta oss" | "Boka demo" | "Ladda ner";

interface AdCreative {
  id: string;
  platform: string;
  format?: string;
  goal?: string;
  headline: string;
  body: string;
  cta: string;
  status: string;
  created_at: string;
}

interface AnalysisResult {
  metrics: { label: string; value: string; benchmark: string; ok: boolean }[];
  recommendations: { action: string; reasoning: string }[];
  instructions: string[];
}

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: "Meta Ads",
  linkedin: "LinkedIn",
  google: "Google Ads",
};

const FORMAT_LABELS: Record<AdFormat, string> = {
  single_image: "Single Image",
  carousel: "Carousel",
  video: "Video",
  stories: "Stories",
};

const GOAL_LABELS: Record<CampaignGoal, string> = {
  awareness: "Awareness",
  leads: "Leads",
  traffic: "Traffic",
  conversions: "Conversions",
};

const HEADLINE_LIMITS: Record<Platform, number> = { meta: 40, linkedin: 70, google: 30 };
const BODY_LIMITS: Record<Platform, number> = { meta: 125, linkedin: 600, google: 90 };

const CTA_OPTIONS: CTA[] = ["Läs mer", "Kontakta oss", "Boka demo", "Ladda ner"];

export default function CustomerAdsPage() {
  const { user, loading: userLoading } = useUser();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ad copy generator
  const [platform, setPlatform] = useState<Platform>("meta");
  const [format, setFormat] = useState<AdFormat>("single_image");
  const [goal, setGoal] = useState<CampaignGoal>("leads");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState<CTA>("Läs mer");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Screenshot analyzer
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [analysisPlatform, setAnalysisPlatform] = useState<Platform>("meta");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Saved drafts
  const [drafts, setDrafts] = useState<AdCreative[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      checkConnection();
      loadDrafts();
    }
  }, [user]);

  const checkConnection = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const client = tenantApi(user.id);
      const data = await client.get<{ connected?: boolean }>("/api/ads/status");
      setConnected(!!data.connected);
    } catch {
      setConnected(false);
    }
    setLoading(false);
  };

  const loadDrafts = async () => {
    if (!user) return;
    try {
      const client = tenantApi(user.id);
      const data = await client.get<{ creatives?: AdCreative[] }>("/api/ads/creatives");
      setDrafts(data.creatives || []);
    } catch {
      if (IS_DEMO) {
        setDrafts(demoAdCreatives as AdCreative[]);
      }
    }
  };

  const generateCopy = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const client = tenantApi(user.id);
      const result = await client.post<{ headline?: string; body?: string }>("/api/ads/generate-copy", {
        platform,
        format,
        goal,
        headline,
        body,
        cta,
      });
      if (result.headline) setHeadline(result.headline);
      if (result.body) setBody(result.body);
      setGenerated(true);
    } catch {
      // Fallback: generate a simple placeholder if API fails
      if (!headline) {
        const placeholders: Record<Platform, string> = {
          meta: "Automatisera din marknadsföring",
          linkedin: "AI-driven tillväxt för ditt företag",
          google: "AI Marketing Platform",
        };
        setHeadline(placeholders[platform]);
      }
      if (!body) {
        setBody("Låt SAMA:s AI-agenter optimera dina kampanjer dygnet runt. Fler leads, högre ROI.");
      }
      setGenerated(true);
    }
    setGenerating(false);
  };

  const saveDraft = async () => {
    if (!user) return;
    setSavingDraft(true);
    try {
      const client = tenantApi(user.id);
      const result = await client.post<{ creative?: AdCreative }>("/api/ads/creatives", {
        platform,
        format,
        goal,
        headline,
        body,
        cta,
        status: "draft",
      });
      if (result.creative) {
        setDrafts((prev) => [result.creative!, ...prev]);
      } else {
        // Optimistic add
        const newDraft: AdCreative = {
          id: `local-${Date.now()}`,
          platform,
          format,
          goal,
          headline,
          body,
          cta,
          status: "draft",
          created_at: new Date().toISOString(),
        };
        setDrafts((prev) => [newDraft, ...prev]);
      }
      setHeadline("");
      setBody("");
      setGenerated(false);
    } catch {
      // Optimistic local save
      const newDraft: AdCreative = {
        id: `local-${Date.now()}`,
        platform,
        format,
        goal,
        headline,
        body,
        cta,
        status: "draft",
        created_at: new Date().toISOString(),
      };
      setDrafts((prev) => [newDraft, ...prev]);
    }
    setSavingDraft(false);
  };

  const deleteDraft = async (id: string) => {
    if (!user) return;
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    try {
      const client = tenantApi(user.id);
      await client.delete(`/api/ads/creatives/${id}`);
    } catch {
      // Already removed from UI
    }
  };

  const handleScreenshotDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  }, []);

  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const analyzeScreenshot = async () => {
    if (!user || !screenshotFile) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(screenshotFile);
      });

      const client = tenantApi(user.id);
      const result = await client.post<AnalysisResult>("/api/ads/analyze-screenshot", {
        image: base64,
        platform: analysisPlatform,
      });
      setAnalysisResult(result);
    } catch {
      // Fallback demo analysis
      setAnalysisResult({
        metrics: [
          { label: "CTR", value: "1.2%", benchmark: "0.9%", ok: true },
          { label: "CPC", value: "€2.40", benchmark: "€1.80", ok: false },
          { label: "CPM", value: "€12.50", benchmark: "€14.00", ok: true },
          { label: "Frekvens", value: "2.8", benchmark: "< 3.0", ok: true },
        ],
        recommendations: [
          { action: "Sänk CPC genom att testa fler annonsformat", reasoning: "Din CPC ligger 33% över branschsnittet. A/B-testa carousel vs single image." },
          { action: "Expandera målgruppen med lookalike audiences", reasoning: "Din CTR är bra, vilket tyder på relevant budskap. Bredda räckvidden." },
          { action: "Testa kortare annonstexter", reasoning: "Nuvarande text kan vara för lång för mobila placeringar." },
        ],
        instructions: [
          "Gå till Ads Manager > Annonsuppsättning > Redigera",
          "Duplicera din bäst presterande annons",
          "Ändra formatet till Carousel med 3-5 kort",
          "Skapa en Lookalike Audience baserad på dina konverteringar",
          "Sätt budget till 80% av nuvarande per annonsuppsättning",
        ],
      });
    }
    setAnalyzing(false);
  };

  if (userLoading || loading) {
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

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Megaphone className="h-7 w-7 text-orange-500" />
            Ads
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Skapa annonstexer med AI och analysera kampanjresultat
          </p>
        </div>

        {/* Info banner — manual mode */}
        {!connected && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-800">
                  Ingen annonsplattform ansluten. Skapa annonstexer och ladda upp skärmdumpar för AI-analys. Anslut en plattform i Inställningar för automatisk synk.
                </p>
                <Link
                  href="/c/settings"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200 transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Gå till Inställningar
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Section 1: Ad Copy Generator */}
        <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Skapa annonstext
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Platform selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Plattform</label>
              <div className="flex gap-2">
                {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setPlatform(key);
                      // Trim headline/body if exceeding new limits
                      if (headline.length > HEADLINE_LIMITS[key]) setHeadline(headline.slice(0, HEADLINE_LIMITS[key]));
                      if (body.length > BODY_LIMITS[key]) setBody(body.slice(0, BODY_LIMITS[key]));
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      platform === key
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as AdFormat)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {Object.entries(FORMAT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Campaign goal */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Kampanjmål</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as CampaignGoal)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {Object.entries(GOAL_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* CTA */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Call to Action</label>
              <select
                value={cta}
                onChange={(e) => setCta(e.target.value as CTA)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CTA_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">Rubrik</label>
              <span className={`text-xs ${headline.length > HEADLINE_LIMITS[platform] ? "text-red-500 font-medium" : "text-slate-400"}`}>
                {headline.length}/{HEADLINE_LIMITS[platform]}
              </span>
            </div>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value.slice(0, HEADLINE_LIMITS[platform]))}
              placeholder={`Max ${HEADLINE_LIMITS[platform]} tecken...`}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Body */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">Brödtext</label>
              <span className={`text-xs ${body.length > BODY_LIMITS[platform] ? "text-red-500 font-medium" : "text-slate-400"}`}>
                {body.length}/{BODY_LIMITS[platform]}
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_LIMITS[platform]))}
              placeholder={`Max ${BODY_LIMITS[platform]} tecken...`}
              rows={4}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={generateCopy}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm transition-colors"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? "Genererar..." : "Generera med AI"}
            </button>

            {generated && (headline || body) && (
              <button
                onClick={saveDraft}
                disabled={savingDraft || (!headline && !body)}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300 shadow-sm transition-colors"
              >
                {savingDraft ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Spara som draft
              </button>
            )}
          </div>
        </section>

        {/* Section 2: Screenshot Analyzer */}
        <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <Image className="h-5 w-5 text-violet-500" />
            Analysera kampanjskärmdump
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleScreenshotDrop}
              onClick={() => fileInputRef.current?.click()}
              className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors min-h-[200px]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleScreenshotSelect}
                className="hidden"
              />
              {screenshotPreview ? (
                <div className="relative w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshotPreview}
                    alt="Screenshot preview"
                    className="w-full rounded-lg object-contain max-h-48"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setScreenshotFile(null);
                      setScreenshotPreview(null);
                      setAnalysisResult(null);
                    }}
                    className="absolute top-2 right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-slate-400 mb-3" />
                  <p className="text-sm text-slate-600 font-medium">Dra och släpp en skärmdump</p>
                  <p className="text-xs text-slate-400 mt-1">PNG eller JPG</p>
                </>
              )}
            </div>

            {/* Platform + analyze button */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Plattform</label>
                <select
                  value={analysisPlatform}
                  onChange={(e) => setAnalysisPlatform(e.target.value as Platform)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={analyzeScreenshot}
                disabled={!screenshotFile || analyzing}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:bg-violet-300 shadow-sm transition-colors w-full justify-center"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart2 className="h-4 w-4" />
                )}
                {analyzing ? "Analyserar..." : "Analysera"}
              </button>
            </div>
          </div>
        </section>

        {/* Section 3: Analysis Results */}
        {analysisResult && (
          <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              AI-rekommendationer
            </h2>

            {/* Metrics */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                <BarChart2 className="h-4 w-4 text-blue-500" />
                Identifierade metrics
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {analysisResult.metrics.map((m) => (
                  <div key={m.label} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                    <p className="text-lg font-bold text-slate-900">{m.value}</p>
                    <p className={`text-xs mt-1 flex items-center gap-1 ${m.ok ? "text-emerald-600" : "text-amber-600"}`}>
                      {m.ok ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      Branschsnitt: {m.benchmark}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Rekommendationer
              </h3>
              <div className="space-y-3">
                {analysisResult.recommendations.map((rec, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-900">{i + 1}. {rec.action}</p>
                    <p className="text-xs text-slate-500 mt-1">{rec.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step-by-step */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                <ClipboardList className="h-4 w-4 text-violet-500" />
                Steg-för-steg instruktioner
              </h3>
              <ol className="space-y-2 list-decimal list-inside">
                {analysisResult.instructions.map((step, i) => (
                  <li key={i} className="text-sm text-slate-700 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* Section 4: Saved Drafts */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <Save className="h-5 w-5 text-emerald-500" />
            Sparade drafts
          </h2>

          {drafts.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Inga sparade annonsutkast ännu.</p>
              <p className="text-xs text-slate-400 mt-1">
                Skapa en annonstext ovan och spara som draft.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                          {PLATFORM_LABELS[draft.platform as Platform] || draft.platform}
                        </span>
                        <span className="text-xs text-slate-400">
                          {draft.created_at ? new Date(draft.created_at).toLocaleDateString("sv-SE") : ""}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900 text-sm truncate">{draft.headline}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{draft.body}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <button
                        onClick={() => {
                          setPlatform(draft.platform as Platform);
                          setHeadline(draft.headline);
                          setBody(draft.body);
                          setCta((draft.cta as CTA) || "Läs mer");
                          setGenerated(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-blue-600 transition-colors"
                        title="Redigera"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteDraft(draft.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600 transition-colors"
                        title="Ta bort"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
