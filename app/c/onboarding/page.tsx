"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Globe, Star, Rocket, ChevronRight, ChevronLeft,
  Plus, X, Loader2, CheckCircle, Search, Target, Users,
  FileText, Linkedin, Mail,
} from "lucide-react";
import { useSite } from "@/lib/hooks/useSite";
import { useUser } from "@/lib/hooks/useUser";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { tenantApi } from "@/lib/api";

const STEP_ICONS = [Building2, Star, Globe, Search, Target, Users, Rocket];

const CONTENT_LANGUAGE_CODES = ["en", "sv", "de", "fr", "es", "no", "da", "fi", "nl"] as const;

const BUSINESS_TYPE_CODES = ["", "ecommerce", "local", "services", "software", "media", "other"] as const;

const TONE_CODES = ["professional", "friendly", "authoritative", "playful", "neutral"] as const;

const PRIMARY_GOAL_VALUES = ["traffic", "leads", "brand", "seo", "social", "custom"] as const;

type PrimaryGoal = typeof PRIMARY_GOAL_VALUES[number];
type ContentType = "blog_post" | "linkedin" | "epost";

const CONTENT_TYPE_ITEMS: { type: ContentType; icon: typeof FileText }[] = [
  { type: "blog_post", icon: FileText },
  { type: "linkedin",  icon: Linkedin },
  { type: "epost",     icon: Mail },
];

interface OnboardingData {
  brand_name: string;
  domain: string;
  brand_description: string;
  target_audience: string;
  content_language: string;
  business_type: string;
  unique_selling_points: string;
  tone_of_voice: string;
  competitors: string[];
  geo_queries: string[];
  team_members: string[];
  primary_goal: PrimaryGoal;
  content_types: ContentType[];
  posts_per_week_blog: number;
  posts_per_week_linkedin: number;
  newsletters_per_month: number;
}

const INITIAL: OnboardingData = {
  brand_name: "", domain: "", brand_description: "", target_audience: "",
  content_language: "en", business_type: "",
  unique_selling_points: "", tone_of_voice: "professional",
  competitors: [], geo_queries: [], team_members: [],
  primary_goal: "traffic", content_types: ["blog_post"],
  posts_per_week_blog: 1, posts_per_week_linkedin: 3, newsletters_per_month: 1,
};

// Survives refresh, accidental tab close and transient auth flickers so the
// user never has to re-enter what they've already typed in.
const DRAFT_KEY = "sama_onboarding_draft_v1";

// Tells the dashboard's onboarding gate to leave the user alone after
// they've explicitly clicked "Hoppa över". Cleared on successful save so
// the gate kicks in again if they ever reset their settings.
const SKIP_KEY = "sama_onboarding_skipped";

interface Draft {
  data: OnboardingData;
  step: number;
}

function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft> | null;
    if (!parsed || typeof parsed !== "object" || !parsed.data) return null;
    return {
      data: { ...INITIAL, ...parsed.data },
      step: typeof parsed.step === "number" ? parsed.step : 0,
    };
  } catch {
    return null;
  }
}

function saveDraft(draft: Draft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* quota / private mode — fine to swallow */ }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore */ }
}

function setSkipped() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SKIP_KEY, "1");
  } catch { /* ignore */ }
}

function clearSkipped() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SKIP_KEY);
  } catch { /* ignore */ }
}

// Pull defaults from a site we already have on file so users who revisit
// onboarding don't see an empty form when they've already configured things.
function fromSiteSettings(settings: Record<string, unknown> | null | undefined): Partial<OnboardingData> {
  if (!settings || typeof settings !== "object") return {};
  const s = settings as Record<string, unknown>;
  const strategy = (s.strategy_goals as Record<string, unknown> | undefined) ?? {};
  const out: Partial<OnboardingData> = {};
  if (typeof s.brand_name === "string") out.brand_name = s.brand_name;
  if (typeof s.domain === "string") out.domain = s.domain;
  if (typeof s.brand_description === "string") out.brand_description = s.brand_description;
  if (typeof s.target_audience === "string") out.target_audience = s.target_audience;
  if (typeof s.content_language === "string") out.content_language = s.content_language;
  if (typeof s.business_type === "string") out.business_type = s.business_type;
  if (typeof s.unique_selling_points === "string") out.unique_selling_points = s.unique_selling_points;
  if (typeof s.tone_of_voice === "string") out.tone_of_voice = s.tone_of_voice;
  if (Array.isArray(s.competitors)) out.competitors = s.competitors.filter((x): x is string => typeof x === "string");
  if (Array.isArray(s.geo_queries)) out.geo_queries = s.geo_queries.filter((x): x is string => typeof x === "string");
  if (Array.isArray(s.team_members)) out.team_members = s.team_members.filter((x): x is string => typeof x === "string");
  if (typeof strategy.primary_goal === "string") {
    const g = strategy.primary_goal;
    if (PRIMARY_GOAL_VALUES.includes(g as PrimaryGoal)) out.primary_goal = g as PrimaryGoal;
  }
  if (Array.isArray(strategy.content_types)) {
    const valid: ContentType[] = ["blog_post", "linkedin", "epost"];
    out.content_types = strategy.content_types.filter((x): x is ContentType =>
      typeof x === "string" && valid.includes(x as ContentType)
    );
  }
  if (typeof strategy.posts_per_week_blog === "number") out.posts_per_week_blog = strategy.posts_per_week_blog;
  if (typeof strategy.posts_per_week_linkedin === "number") out.posts_per_week_linkedin = strategy.posts_per_week_linkedin;
  if (typeof strategy.newsletters_per_month === "number") out.newsletters_per_month = strategy.newsletters_per_month;
  return out;
}

function primaryGoalLabel(o: typeof import("@/lib/locales/translations").translations.sv["onboardingFlow"], v: PrimaryGoal) {
  switch (v) {
    case "traffic": return { label: o.goalTrafficLabel, desc: o.goalTrafficDesc };
    case "leads": return { label: o.goalLeadsLabel, desc: o.goalLeadsDesc };
    case "brand": return { label: o.goalBrandLabel, desc: o.goalBrandDesc };
    case "seo": return { label: o.goalSeoLabel, desc: o.goalSeoDesc };
    case "social": return { label: o.goalSocialLabel, desc: o.goalSocialDesc };
    case "custom": return { label: o.goalCustomLabel, desc: o.goalCustomDesc };
  }
}

function contentTypeLabel(o: typeof import("@/lib/locales/translations").translations.sv["onboardingFlow"], t: ContentType) {
  switch (t) {
    case "blog_post": return o.contentBlogPost;
    case "linkedin": return o.contentLinkedin;
    case "epost": return o.contentEmail;
  }
}

function businessTypeLabel(o: typeof import("@/lib/locales/translations").translations.sv["onboardingFlow"], code: string) {
  switch (code) {
    case "": return o.bizSelect;
    case "ecommerce": return o.bizEcommerce;
    case "local": return o.bizLocal;
    case "services": return o.bizServices;
    case "software": return o.bizSoftware;
    case "media": return o.bizMedia;
    case "other": return o.bizOther;
    default: return code;
  }
}

function toneLabel(o: typeof import("@/lib/locales/translations").translations.sv["onboardingFlow"], code: string) {
  switch (code) {
    case "professional": return o.toneProfessional;
    case "friendly": return o.toneFriendly;
    case "authoritative": return o.toneAuthoritative;
    case "playful": return o.tonePlayful;
    case "neutral": return o.toneNeutral;
    default: return code;
  }
}

function contentLanguageLabel(o: typeof import("@/lib/locales/translations").translations.sv["onboardingFlow"], code: string) {
  switch (code) {
    case "en": return o.langEn;
    case "sv": return o.langSv;
    case "de": return o.langDe;
    case "fr": return o.langFr;
    case "es": return o.langEs;
    case "no": return o.langNo;
    case "da": return o.langDa;
    case "fi": return o.langFi;
    case "nl": return o.langNl;
    default: return code;
  }
}

function stepLabel(o: typeof import("@/lib/locales/translations").translations.sv["onboardingFlow"], idx: number) {
  return [o.stepBrand, o.stepProfile, o.stepCompetitors, o.stepGeo, o.stepStrategy, o.stepTeam, o.stepDone][idx] ?? "";
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { activeSite, reloadSites } = useSite();
  const { t } = useLanguage();
  const o = t.onboardingFlow;

  // Lazy initialiser so a draft is restored synchronously on first paint —
  // no flash of empty fields before a useEffect has a chance to hydrate.
  const initialDraft = typeof window !== "undefined" ? loadDraft() : null;
  const [step, setStep] = useState(initialDraft?.step ?? 0);
  const [data, setData] = useState<OnboardingData>(initialDraft?.data ?? INITIAL);
  const [saving, setSaving] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newGeoQuery, setNewGeoQuery] = useState("");
  const [newMember, setNewMember] = useState("");
  const [activatingAgents, setActivatingAgents] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAndDone, setSavedAndDone] = useState(false);

  // Tracks whether we've already pre-filled the form from existing site
  // settings. Only do it once per mount so the user's edits don't get
  // overwritten when activeSite re-emits.
  const hydratedFromSite = useRef<boolean>(initialDraft !== null);

  useEffect(() => {
    if (!userLoading && !user) router.push("/c/login");
  }, [user, userLoading, router]);

  // Pull defaults from an existing site on first availability — only when
  // we don't already have a local draft (otherwise we'd clobber the user's
  // in-progress edits).
  useEffect(() => {
    if (hydratedFromSite.current) return;
    if (!activeSite) return;
    const seed = fromSiteSettings(activeSite.settings as Record<string, unknown>);
    if (Object.keys(seed).length === 0) {
      hydratedFromSite.current = true;
      return;
    }
    setData((prev) => ({ ...prev, ...seed }));
    hydratedFromSite.current = true;
  }, [activeSite]);

  // Persist draft on every change. localStorage writes are synchronous and
  // cheap so debouncing buys nothing here — and skipping a write is exactly
  // what caused the data-loss bug we're fixing.
  useEffect(() => {
    if (savedAndDone) return;
    saveDraft({ data, step });
  }, [data, step, savedAndDone]);

  // Browser-level "are you sure?" if the user tries to close the tab while
  // they have unsaved work in the form.
  useEffect(() => {
    const isDirty = () => {
      if (savedAndDone) return false;
      return JSON.stringify(data) !== JSON.stringify(INITIAL);
    };
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [data, savedAndDone]);

  const update = <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const handleDomainBlur = async () => {
    const domain = data.domain.trim();
    const valid = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain);
    if (!valid || prefilling) return;
    setPrefilling(true);
    try {
      const res = await fetch("/api/onboarding/prefill-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const prefill = await res.json().catch(() => ({}));
      setData((prev) => ({
        ...prev,
        brand_name: prev.brand_name || prefill.brand_name || "",
        brand_description: prev.brand_description || prefill.brand_description || "",
        content_language: (prev.content_language && prev.content_language !== "en")
          ? prev.content_language
          : (prefill.content_language || "en"),
        geo_queries: prev.geo_queries.length > 0
          ? prev.geo_queries
          : (prefill.suggested_queries ?? []),
      }));
    } catch { /* silent */ } finally {
      setPrefilling(false);
    }
  };

  const addCompetitor = () => {
    const c = newCompetitor.trim();
    if (c && !data.competitors.includes(c)) {
      update("competitors", [...data.competitors, c]);
      setNewCompetitor("");
    }
  };

  const addGeoQuery = () => {
    const q = newGeoQuery.trim();
    if (q && !data.geo_queries.includes(q)) {
      update("geo_queries", [...data.geo_queries, q]);
      setNewGeoQuery("");
    }
  };

  const addMember = () => {
    const m = newMember.trim();
    if (m && !data.team_members.includes(m)) {
      update("team_members", [...data.team_members, m]);
      setNewMember("");
    }
  };

  const toggleContentType = (t: ContentType) =>
    update("content_types", data.content_types.includes(t)
      ? data.content_types.filter((x) => x !== t)
      : [...data.content_types, t]);

  const canAdvance = () => {
    if (step === 0) {
      const domainOk = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(data.domain.trim());
      return data.brand_name.trim().length > 0 && domainOk;
    }
    if (step === 2) return data.competitors.length >= 1;
    if (step === 4) return data.content_types.length >= 1;
    return true;
  };

  const validationHint = () => {
    if (step === 0) {
      if (!data.brand_name.trim()) return o.valBrandRequired;
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(data.domain.trim()))
        return o.valDomainInvalid;
      return null;
    }
    if (step === 2 && data.competitors.length < 1) return o.valCompetitorMin;
    if (step === 4 && data.content_types.length < 1) return o.valContentTypeMin;
    return null;
  };

  const handleSkip = () => {
    const dirty = JSON.stringify(data) !== JSON.stringify(INITIAL);
    if (dirty) {
      const ok = window.confirm(o.skipConfirm);
      if (!ok) return;
    }
    // Keep the draft around so revisiting /c/onboarding picks up where the
    // user left off, but mark them as skipped so the dashboard doesn't
    // bounce them straight back here on next render.
    setSkipped();
    setSavedAndDone(true);
    router.push("/c/dashboard");
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaveError(null);
    setSaving(true);
    const { getSupabaseBrowser } = await import("@/lib/supabase-browser");
    const supabase = getSupabaseBrowser();
    try {
      const settings = {
        brand_name: data.brand_name,
        domain: data.domain,
        brand_description: data.brand_description,
        target_audience: data.target_audience,
        content_language: data.content_language,
        business_type: data.business_type,
        unique_selling_points: data.unique_selling_points,
        tone_of_voice: data.tone_of_voice,
        competitors: data.competitors,
        geo_queries: data.geo_queries,
        geo_platforms: ["ChatGPT", "Perplexity", "Claude", "Google AIO"],
        team_members: data.team_members,
        strategy_goals: {
          primary_goal: data.primary_goal,
          content_types: data.content_types,
          posts_per_week_blog: data.content_types.includes("blog_post") ? data.posts_per_week_blog : 0,
          posts_per_week_linkedin: data.content_types.includes("linkedin") ? data.posts_per_week_linkedin : 0,
          newsletters_per_month: data.content_types.includes("epost") ? data.newsletters_per_month : 0,
        },
      };

      if (activeSite) {
        const { error } = await supabase
          .from("user_sites")
          .update({ settings, site_name: data.brand_name, updated_at: new Date().toISOString() })
          .eq("id", activeSite.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("user_sites")
          .upsert(
            { id: user.id, user_id: user.id, site_name: data.brand_name, settings, updated_at: new Date().toISOString() },
            { onConflict: "id" }
          );
        if (error) throw new Error(error.message);
      }

      await reloadSites();

      setActivatingAgents(true);
      try {
        const siteId = activeSite?.id ?? user.id;
        await tenantApi(siteId).post("/api/tenant/activate");
      } catch { /* non-blocking */ } finally {
        setActivatingAgents(false);
      }

      // Settings are now persisted server-side — we no longer need the
      // local draft, and we don't want the beforeunload guard firing on
      // the way to /c/dashboard. Also clear any stale skip-flag so the
      // dashboard's onboarding gate behaves normally going forward.
      setSavedAndDone(true);
      clearDraft();
      clearSkipped();
      router.push("/c/dashboard");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : o.saveError);
    } finally {
      setSaving(false);
      setActivatingAgents(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="relative text-center mb-10">
          <button
            onClick={handleSkip}
            className="absolute right-0 top-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            {o.skip}
            <X className="h-4 w-4" />
          </button>
          <h1 className="text-3xl font-bold text-slate-900">{o.title}</h1>
          <p className="mt-2 text-slate-600">{o.subtitle}</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-1.5 mb-10 flex-wrap">
          {STEP_ICONS.map((Icon, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === step ? "bg-blue-600 text-white"
                  : i < step ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < step ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{stepLabel(o, i)}</span>
              </button>
              {i < STEP_ICONS.length - 1 && (
                <div className={`h-px w-4 ${i < step ? "bg-emerald-500" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

          {step === 0 && (
            <div className="space-y-5">
              <StepHeader title={o.brandTitle} desc={o.brandDesc} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{o.domainLabel}</label>
                <input
                  type="text"
                  value={data.domain}
                  onChange={(e) => update("domain", e.target.value)}
                  onBlur={() => void handleDomainBlur()}
                  placeholder={o.domainPlaceholder}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {o.brandNameLabel}
                  {prefilling && <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-slate-400" />}
                </label>
                <input
                  type="text"
                  value={data.brand_name}
                  onChange={(e) => update("brand_name", e.target.value)}
                  placeholder={o.brandNamePlaceholder}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{o.businessTypeLabel}</label>
                <select
                  value={data.business_type}
                  onChange={(e) => update("business_type", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  {BUSINESS_TYPE_CODES.map((c) => <option key={c} value={c}>{businessTypeLabel(o, c)}</option>)}
                </select>
              </div>
              <FieldTextarea label={o.descriptionLabel} value={data.brand_description} onChange={(v) => update("brand_description", v)} placeholder={o.descriptionPlaceholder} />
              <FieldTextarea label={o.audienceLabel} value={data.target_audience} onChange={(v) => update("target_audience", v)} placeholder={o.audiencePlaceholder} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{o.contentLanguageLabel}</label>
                <select
                  value={data.content_language}
                  onChange={(e) => update("content_language", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  {CONTENT_LANGUAGE_CODES.map((c) => <option key={c} value={c}>{contentLanguageLabel(o, c)}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <StepHeader title={o.profileTitle} desc={o.profileDesc} />
              <FieldTextarea
                label={o.uspLabel}
                value={data.unique_selling_points}
                onChange={(v) => update("unique_selling_points", v)}
                placeholder={o.uspPlaceholder}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{o.toneLabel}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TONE_CODES.map((code) => (
                    <button
                      key={code}
                      onClick={() => update("tone_of_voice", code)}
                      className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                        data.tone_of_voice === code
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {toneLabel(o, code)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <StepHeader title={o.competitorsTitle} desc={o.competitorsDesc} />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCompetitor())}
                  placeholder={o.competitorPlaceholder}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={addCompetitor} className="rounded-lg bg-slate-100 text-slate-700 px-3 py-2 hover:bg-slate-200 border border-slate-200">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.competitors.length === 0
                  ? <p className="text-sm text-slate-500">{o.competitorsEmpty}</p>
                  : data.competitors.map((c) => (
                    <span key={c} className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 border border-blue-200">
                      {c}
                      <button onClick={() => update("competitors", data.competitors.filter((x) => x !== c))} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <StepHeader title={o.geoTitle} desc={o.geoDesc} />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGeoQuery}
                  onChange={(e) => setNewGeoQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGeoQuery())}
                  placeholder={o.geoPlaceholder}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={addGeoQuery} className="rounded-lg bg-slate-100 text-slate-700 px-3 py-2 hover:bg-slate-200 border border-slate-200">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {data.geo_queries.length === 0
                  ? <p className="text-sm text-slate-500">{o.geoEmpty}</p>
                  : data.geo_queries.map((q) => (
                    <div key={q} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
                      <span className="text-sm text-slate-700">&ldquo;{q}&rdquo;</span>
                      <button onClick={() => update("geo_queries", data.geo_queries.filter((x) => x !== q))} className="text-slate-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <StepHeader title={o.strategyTitle} desc={o.strategyDesc} />
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">{o.primaryGoalLabel}</p>
                <div className="grid grid-cols-2 gap-2">
                  {PRIMARY_GOAL_VALUES.map((value) => {
                    const { label, desc } = primaryGoalLabel(o, value);
                    return (
                      <button
                        key={value}
                        onClick={() => update("primary_goal", value)}
                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          data.primary_goal === value
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className={`text-sm font-medium ${data.primary_goal === value ? "text-emerald-700" : "text-slate-900"}`}>{label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">{o.contentTypeLabel}</p>
                <div className="space-y-2">
                  {CONTENT_TYPE_ITEMS.map(({ type, icon: Icon }) => {
                    const selected = data.content_types.includes(type);
                    const label = contentTypeLabel(o, type);
                    return (
                      <div key={type} className={`rounded-lg border transition-colors ${selected ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}>
                        <button onClick={() => toggleContentType(type)} className="flex w-full items-center gap-3 px-4 py-3">
                          <Icon className={`h-4 w-4 flex-shrink-0 ${selected ? "text-blue-600" : "text-slate-400"}`} />
                          <span className={`text-sm font-medium ${selected ? "text-blue-700" : "text-slate-700"}`}>{label}</span>
                          <div className={`ml-auto h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? "border-blue-500 bg-blue-500" : "border-slate-300"}`}>
                            {selected && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>
                        </button>
                        {selected && (
                          <div className="border-t border-blue-200 px-4 pb-3 pt-2">
                            {type === "blog_post" && (
                              <FreqRow label={o.blogPerWeek} value={data.posts_per_week_blog} min={1} max={7} onChange={(v) => update("posts_per_week_blog", v)} />
                            )}
                            {type === "linkedin" && (
                              <FreqRow label={o.linkedinPerWeek} value={data.posts_per_week_linkedin} min={1} max={7} onChange={(v) => update("posts_per_week_linkedin", v)} />
                            )}
                            {type === "epost" && (
                              <FreqRow label={o.newslettersPerMonth} value={data.newsletters_per_month} min={1} max={8} onChange={(v) => update("newsletters_per_month", v)} />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {data.content_types.length === 0 && (
                  <p className="mt-2 text-xs text-red-600">{o.needContentType}</p>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <StepHeader title={o.teamTitle} desc={o.teamDesc} />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMember}
                  onChange={(e) => setNewMember(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMember())}
                  placeholder={o.teamPlaceholder}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={addMember} className="rounded-lg bg-slate-100 text-slate-700 px-3 py-2 hover:bg-slate-200 border border-slate-200">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.team_members.length === 0
                  ? <p className="text-sm text-slate-500">{o.teamEmpty}</p>
                  : data.team_members.map((m) => (
                    <span key={m} className="flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-700 border border-violet-200">
                      {m}
                      <button onClick={() => update("team_members", data.team_members.filter((x) => x !== m))} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 text-center py-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <Rocket className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2 text-slate-900">{o.doneTitle}</h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  {o.doneDesc}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-left max-w-sm mx-auto space-y-3">
                <SummaryRow label={o.summaryBrand} value={data.brand_name} />
                <SummaryRow label={o.summaryDomain} value={data.domain} />
                <SummaryRow label={o.summaryType} value={data.business_type ? businessTypeLabel(o, data.business_type) : "—"} />
                <SummaryRow label={o.summaryTone} value={toneLabel(o, data.tone_of_voice)} />
                <SummaryRow label={o.summaryCompetitors} value={data.competitors.length > 0 ? data.competitors.join(", ") : o.summaryNone} />
                <SummaryRow label={o.summaryGeo} value={data.geo_queries.length > 0 ? `${data.geo_queries.length} ${o.summaryCount}` : o.summaryNone} />
                <SummaryRow label={o.summaryGoal} value={primaryGoalLabel(o, data.primary_goal).label} />
                <SummaryRow label={o.summaryContent} value={data.content_types.map((t) => contentTypeLabel(o, t)).join(", ") || "—"} />
                {data.team_members.length > 0 && <SummaryRow label={o.summaryTeam} value={data.team_members.join(", ")} />}
              </div>
            </div>
          )}
        </div>

        {(validationHint() || saveError) && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {saveError ?? validationHint()}
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> {o.back}
          </button>

          {step < STEP_ICONS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {o.next} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => void handleFinish()}
              disabled={saving || activatingAgents}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors shadow-sm"
            >
              {(saving || activatingAgents) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {activatingAgents ? o.configuring : saving ? o.saving : o.start}
            </button>
          )}
        </div>

        {/* Persistent skip-onboarding affordance: visible on every step,
            never blocked by validation, and clearly labelled. */}
        <div className="mt-6 text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-4 transition-colors"
          >
            {o.skipFooter}
          </button>
          <p className="mt-1 text-xs text-slate-400">
            {o.skipFooterHint}
          </p>
        </div>
      </div>
    </div>
  );
}

function StepHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1 text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600">{desc}</p>
    </div>
  );
}

function FieldTextarea({ label, value, onChange, placeholder }: {
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
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
      />
    </div>
  );
}

function FreqRow({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm text-slate-700">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(min, value - 1))} className="h-6 w-6 rounded border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center">−</button>
        <span className="w-5 text-center font-semibold text-slate-900">{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} className="h-6 w-6 rounded border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center">+</button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium truncate ml-4 max-w-[200px]">{value}</span>
    </div>
  );
}
