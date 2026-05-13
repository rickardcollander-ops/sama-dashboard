"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Megaphone, Loader2, Upload, Sparkles, Save, Trash2, Edit3,
  Image as ImageIcon, AlertCircle, CheckCircle,
  Settings, ArrowRight, BarChart2, Lightbulb, ClipboardList,
  X,
} from "lucide-react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { tenantApi } from "@/lib/api";
import { IS_DEMO, demoAdCreatives } from "@/lib/demo-data";

interface AdSuggestion {
  platform: string;
  goal: string;
  headline: string;
  body: string;
  cta: string;
  reason: string;
}

type Platform = "meta" | "linkedin" | "google";
type AdFormat = "single_image" | "carousel" | "video" | "stories";
type CampaignGoal = "awareness" | "leads" | "traffic" | "conversions";
type CTA = "Learn More" | "Contact Us" | "Book Demo" | "Download";

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

const CTA_OPTIONS: CTA[] = ["Learn More", "Contact Us", "Book Demo", "Download"];

export default function CustomerAdsPage() {
  const { user, loading: userLoading } = useUser();
  const { tenantClient } = useSite();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ad copy generator
  const [platform, setPlatform] = useState<Platform>("meta");
  const [format, setFormat] = useState<AdFormat>("single_image");
  const [goal, setGoal] = useState<CampaignGoal>("leads");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState<CTA>("Learn More");
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
  const [error, setError] = useState("");

  // Brand context (loaded from settings)
  const [brandContext, setBrandContext] = useState<{
    brand_name?: string; domain?: string; brand_description?: string;
    target_audience?: string; competitors?: string[]; tone_of_voice?: string;
  }>({});

  // Competitor analysis
  const [competitorData, setCompetitorData] = useState<{
    competitors?: { name: string; positioning: string; key_messages: string[]; strengths: string[]; weaknesses: string[]; estimated_ad_spend: string; primary_cta: string }[];
    opportunities?: { opportunity: string; reasoning: string; suggested_angle: string; priority: string }[];
    differentiation_tips?: string[];
  } | null>(null);
  const [analyzingCompetitors, setAnalyzingCompetitors] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (user) {
      checkConnection();
      loadDrafts();
      loadBrandContext();
    }
  }, [user]);

  const loadBrandContext = async () => {
    if (!user) return;
    try {
      const { getSupabaseBrowser } = await import("@/lib/supabase-browser");
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.from("user_settings").select("settings").eq("user_id", user.id).maybeSingle();
      if (data?.settings) setBrandContext(data.settings);
    } catch {}
  };

  const analyzeCompetitors = async () => {
    if (!user || !brandContext.competitors?.length) return;
    setAnalyzingCompetitors(true);
    try {
      const client = tenantClient;
      const data = await client.post("/api/ads/competitor-analysis", {
        competitors: brandContext.competitors,
        platform,
        brand_name: brandContext.brand_name,
        brand_description: brandContext.brand_description,
        target_audience: brandContext.target_audience,
      });
      setCompetitorData(data);
    } catch (err: any) {
      setCompetitorData(null);
      setError(`Could not load competitor analysis: ${err?.message || err}`);
    }
    setAnalyzingCompetitors(false);
  };

  const checkConnection = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const client = tenantClient;
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
      const client = tenantClient;
      const data = await client.get<{ creatives?: AdCreative[] }>("/api/ads/creatives");
      setDrafts(data.creatives || []);
    } catch (err: any) {
      if (IS_DEMO) {
        setDrafts(demoAdCreatives as AdCreative[]);
      } else {
        setError(`Could not load saved drafts: ${err?.message || err}`);
      }
    }
  };

  const generateCopy = async () => {
    if (!user) return;
    setGenerating(true);
    setError("");
    try {
      const client = tenantClient;
      const result = await client.post<{ headline?: string; body?: string }>("/api/ads/generate-copy", {
        platform,
        format,
        goal,
        brand_name: brandContext.brand_name || "",
        brand_description: brandContext.brand_description || "",
        target_audience: brandContext.target_audience || "",
        competitors: (brandContext.competitors || []).join(", "),
        tone_of_voice: brandContext.tone_of_voice || "",
        domain: brandContext.domain || "",
      });
      if (result.headline) setHeadline(result.headline);
      if (result.body) setBody(result.body);
      setGenerated(true);
    } catch (err: any) {
      setError(`Could not generate ad copy: ${err?.message || err}`);
      // Fallback: generate a simple placeholder if API fails
      if (!headline) {
        const placeholders: Record<Platform, string> = {
          meta: "Automate your marketing",
          linkedin: "AI-driven growth for your business",
          google: "AI Marketing Platform",
        };
        setHeadline(placeholders[platform]);
      }
      if (!body) {
        setBody("Let SAMA's AI agents optimize your campaigns around the clock. More leads, higher ROI.");
      }
      setGenerated(true);
    }
    setGenerating(false);
  };

  const saveDraft = async () => {
    if (!user) return;
    setSavingDraft(true);
    setError("");
    try {
      const client = tenantClient;
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

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const requestDeleteDraft = (id: string) => setPendingDeleteId(id);

  const confirmDeleteDraft = async () => {
    if (!user || !pendingDeleteId) return;
    setDeleting(true);
    const id = pendingDeleteId;
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    try {
      const client = tenantClient;
      await client.delete(`/api/ads/creatives/${id}`);
    } catch {
      // Already removed from UI
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
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

      const client = tenantClient;
      const result = await client.post<AnalysisResult>("/api/ads/analyze-screenshot", {
        image_base64: base64,
        platform: analysisPlatform,
      });
      setAnalysisResult(result);
    } catch (err: any) {
      setError(`Could not analyze screenshot: ${err?.message || err}. Try again or check that the Ads agent is configured.`);
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
            Create ad copy with AI and analyze campaign results
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError("")} className="ml-auto text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Info banner — manual mode */}
        {!connected && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-800">
                  No ad platform connected. Create ad copy and upload screenshots for AI analysis. Connect a platform in Settings for automatic sync.
                </p>
                <Link
                  href="/c/settings"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200 transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Go to Settings
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* AI Suggestions */}
        {user && (
          <SuggestionsPanel<AdSuggestion>
            title="Ad suggestions"
            description="AI suggests new creatives based on your brand. Import a suggestion to save it as a draft in the Ads agent."
            accent="orange"
            importButtonLabel="Import to Ads"
            importLabel="Import to the Ads agent"
            fetchSuggestions={async () => {
              const client = tenantClient;
              const res = await client.post<{ suggestions?: AdSuggestion[] }>("/api/ads/suggest-campaigns", {});
              return res.suggestions || [];
            }}
            renderItem={(item) => (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase text-orange-700">{item.platform}</span>
                  <span className="text-xs text-slate-500">· {item.goal}</span>
                </div>
                <p className="font-semibold text-slate-900 text-sm">{item.headline}</p>
                <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{item.body}</p>
                <p className="text-xs text-slate-500 mt-2">CTA: {item.cta}</p>
                <p className="text-xs text-slate-500 mt-1 italic">{item.reason}</p>
              </div>
            )}
            importItem={async (item) => {
              const client = tenantClient;
              await client.post("/api/ads/creatives", {
                platform: item.platform,
                goal: item.goal,
                headline: item.headline,
                body: item.body,
                cta: item.cta,
                status: "draft",
              });
              await loadDrafts();
              return `Ad suggestion saved as draft.`;
            }}
          />
        )}

        {/* Section 1: Ad Copy Generator */}
        <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Create Ad Copy
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Platform selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Platform</label>
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
              <p className="text-xs text-slate-400 mt-1">
                Headline max {HEADLINE_LIMITS[platform]} chars, body max {BODY_LIMITS[platform]} chars
              </p>
            </div>

            {/* Campaign goal */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Goal</label>
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
              <label className="block text-sm font-medium text-slate-700">Headline</label>
              <span className={`text-xs ${headline.length > HEADLINE_LIMITS[platform] ? "text-red-500 font-medium" : "text-slate-400"}`}>
                {headline.length}/{HEADLINE_LIMITS[platform]}
              </span>
            </div>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value.slice(0, HEADLINE_LIMITS[platform]))}
              placeholder={`Max ${HEADLINE_LIMITS[platform]} chars...`}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Body */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">Body Text</label>
              <span className={`text-xs ${body.length > BODY_LIMITS[platform] ? "text-red-500 font-medium" : "text-slate-400"}`}>
                {body.length}/{BODY_LIMITS[platform]}
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_LIMITS[platform]))}
              placeholder={`Max ${BODY_LIMITS[platform]} chars...`}
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
              {generating ? "Generating..." : "Generate with AI"}
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
                Save as Draft
              </button>
            )}
          </div>
        </section>

        {/* Section 2: Screenshot Analyzer */}
        <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <ImageIcon className="h-5 w-5 text-violet-500" />
            Analyze Campaign Screenshot
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
                  <p className="text-sm text-slate-600 font-medium">Drag and drop a screenshot</p>
                  <p className="text-xs text-slate-400 mt-1">PNG or JPG</p>
                </>
              )}
            </div>

            {/* Platform + analyze button */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Platform</label>
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
                {analyzing ? "Analyzing..." : "Analyze"}
              </button>
            </div>
          </div>
        </section>

        {/* Section 3: Analysis Results */}
        {analysisResult && (
          <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                AI Recommendations
              </h2>
              <button
                onClick={() => setAnalysisResult(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metrics */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                <BarChart2 className="h-4 w-4 text-blue-500" />
                Identified Metrics
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {analysisResult.metrics.map((m) => (
                  <div key={m.label} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                    <p className="text-lg font-bold text-slate-900">{m.value}</p>
                    <p className={`text-xs mt-1 flex items-center gap-1 ${m.ok ? "text-emerald-600" : "text-amber-600"}`}>
                      {m.ok ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      Industry avg: {m.benchmark}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Recommendations
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
                Step-by-step Instructions
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

        {/* Section 4: Competitor Analysis */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-purple-500" />
                Competitor Analysis
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                AI analysis of competitors&apos; ad strategy
                {brandContext.competitors?.length ? ` (${brandContext.competitors.join(", ")})` : ""}
              </p>
            </div>
            <button
              onClick={analyzeCompetitors}
              disabled={analyzingCompetitors || !brandContext.competitors?.length}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300 transition-colors"
            >
              {analyzingCompetitors ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzingCompetitors ? "Analyzing..." : "Analyze Competitors"}
            </button>
          </div>

          {!brandContext.competitors?.length && (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Add competitors in <Link href="/c/settings" className="text-blue-600 hover:underline">Settings</Link> to analyze their ads.</p>
            </div>
          )}

          {competitorData?.competitors && competitorData.competitors.length > 0 && (
            <div className="space-y-6">
              {/* Competitor cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {competitorData.competitors.map((comp, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-900">{comp.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        comp.estimated_ad_spend === "High" ? "bg-red-100 text-red-700" :
                        comp.estimated_ad_spend === "Medium" ? "bg-amber-100 text-amber-700" :
                        "bg-emerald-100 text-emerald-700"
                      }`}>
                        {comp.estimated_ad_spend} spend
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{comp.positioning}</p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase">Messages</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {comp.key_messages?.map((msg, j) => (
                            <span key={j} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{msg}</span>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <p className="text-xs font-medium text-emerald-600">Strengths</p>
                          {comp.strengths?.map((s, j) => (
                            <p key={j} className="text-xs text-slate-600">+ {s}</p>
                          ))}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-red-500">Weaknesses</p>
                          {comp.weaknesses?.map((w, j) => (
                            <p key={j} className="text-xs text-slate-600">- {w}</p>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">CTA: <span className="font-medium">{comp.primary_cta}</span></p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Opportunities */}
              {competitorData.opportunities && competitorData.opportunities.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Opportunities for {brandContext.brand_name || "your brand"}
                  </h3>
                  <div className="space-y-3">
                    {competitorData.opportunities.map((opp, i) => (
                      <div key={i} className="rounded-lg border-l-4 border-l-amber-400 bg-amber-50 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            opp.priority === "high" ? "bg-red-100 text-red-700" :
                            opp.priority === "medium" ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>{opp.priority}</span>
                          <p className="text-sm font-medium text-slate-900">{opp.opportunity}</p>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{opp.reasoning}</p>
                        <p className="text-xs text-blue-700 font-medium mt-2">Ad angle: {opp.suggested_angle}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Differentiation tips */}
              {competitorData.differentiation_tips && competitorData.differentiation_tips.length > 0 && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">How to Stand Out</h3>
                  <ul className="space-y-1">
                    {competitorData.differentiation_tips.map((tip, i) => (
                      <li key={i} className="text-sm text-blue-800 flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 5: Saved Drafts */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <Save className="h-5 w-5 text-emerald-500" />
            Saved Drafts
          </h2>

          {drafts.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No saved ad drafts yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Create ad copy above and save as a draft.
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
                          {draft.created_at ? new Date(draft.created_at).toLocaleDateString() : ""}
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
                          setCta((draft.cta as CTA) || "Learn More");
                          setGenerated(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => requestDeleteDraft(draft.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600 transition-colors"
                        title="Delete"
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
      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete this draft?"
        description="This permanently removes the ad creative draft. You can&rsquo;t undo this."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={confirmDeleteDraft}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
