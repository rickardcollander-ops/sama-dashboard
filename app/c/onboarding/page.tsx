"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Globe, Languages, FileText, Users, Palette,
  Sparkles, ChevronRight, ChevronLeft, Plus, X, Loader2, Check,
  Pencil,
} from "lucide-react";
import { useSite } from "@/lib/hooks/useSite";
import { useUser } from "@/lib/hooks/useUser";
import { useLanguage } from "@/lib/hooks/useLanguage";
import CustomerNav from "@/components/CustomerNav";

interface OnboardingData {
  domain: string;
  brand_name: string;
  content_language: string;
  brand_description: string;
  target_audience: string;
  competitors: string[];
  brand_color: string;
  geo_queries: string[];
}

const INITIAL: OnboardingData = {
  domain: "",
  brand_name: "",
  content_language: "en",
  brand_description: "",
  target_audience: "",
  competitors: [],
  brand_color: "#4F46E5",
  geo_queries: [],
};

const LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "sv", label: "Svenska" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "no", label: "Norsk" },
  { code: "da", label: "Dansk" },
  { code: "fi", label: "Suomi" },
  { code: "nl", label: "Nederlands" },
];

const STEP_ICONS = [Globe, Languages, FileText, Users, Palette, Sparkles];
const TOTAL_STEPS = STEP_ICONS.length;

const DRAFT_KEY = "sama_onboarding_v2_draft";
const SKIP_KEY = "sama_onboarding_skipped";

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

function loadDraft(): { data: OnboardingData; step: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    return {
      data: { ...INITIAL, ...parsed.data },
      step: typeof parsed.step === "number" ? parsed.step : 0,
    };
  } catch {
    return null;
  }
}

function saveDraft(draft: { data: OnboardingData; step: number }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota — fine to swallow */
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(SKIP_KEY);
  } catch {
    /* ignore */
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { activeSite, effectiveTenantId } = useSite();
  const { t } = useLanguage();
  // Allow re-running onboarding (e.g. from the Settings "Run Onboarding" button)
  // by appending ?rerun=1 to the URL.
  const isRerun =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("rerun");
  const ow = t.onboardingWizard;

  const initial = typeof window !== "undefined" ? loadDraft() : null;
  const [step, setStep] = useState(initial?.step ?? 0);
  const [data, setData] = useState<OnboardingData>(initial?.data ?? INITIAL);
  const [prefilling, setPrefilling] = useState(false);
  const [suggestingQueries, setSuggestingQueries] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [editingQueryIdx, setEditingQueryIdx] = useState<number | null>(null);
  const [editingQueryValue, setEditingQueryValue] = useState("");

  const hydratedFromSite = useRef<boolean>(initial !== null);
  const querySuggestRequested = useRef<boolean>(initial?.data.geo_queries.length ? true : false);

  const STEP_LABELS = [
    ow.stepDomain,
    ow.stepLanguage,
    ow.stepBusiness,
    ow.stepCompetitors,
    ow.stepBranding,
    ow.stepAiQueries,
  ];

  useEffect(() => {
    if (!userLoading && !user) router.push("/c/login");
  }, [user, userLoading, router]);

  // If this user has already completed onboarding, route them away — unless
  // they explicitly re-entered the wizard via ?rerun=1 (e.g. from Settings).
  useEffect(() => {
    if (isRerun) return;
    if (!activeSite) return;
    const s = (activeSite.settings as Record<string, unknown> | undefined) || {};
    if (typeof s.onboarding_completed_at === "string" && s.onboarding_completed_at) {
      router.replace("/c/dashboard");
    }
  }, [activeSite, isRerun, router]);

  // Pre-fill from existing site row on first availability (without clobbering a local draft).
  useEffect(() => {
    if (hydratedFromSite.current) return;
    if (!activeSite) return;
    const s = (activeSite.settings as Record<string, unknown> | undefined) || {};
    const seed: Partial<OnboardingData> = {};
    if (typeof s.domain === "string") seed.domain = s.domain;
    if (typeof s.brand_name === "string") seed.brand_name = s.brand_name;
    if (typeof s.brand_description === "string") seed.brand_description = s.brand_description;
    if (typeof s.target_audience === "string") seed.target_audience = s.target_audience;
    if (typeof s.content_language === "string") seed.content_language = s.content_language;
    if (Array.isArray(s.competitors)) {
      seed.competitors = s.competitors.filter((x): x is string => typeof x === "string");
    }
    if (Array.isArray(s.geo_queries)) {
      seed.geo_queries = s.geo_queries.filter((x): x is string => typeof x === "string");
    }
    if (typeof s.brand_color === "string") seed.brand_color = s.brand_color;
    if (Object.keys(seed).length > 0) {
      setData((prev) => ({ ...prev, ...seed }));
    }
    hydratedFromSite.current = true;
  }, [activeSite]);

  // Persist draft on every change.
  useEffect(() => {
    saveDraft({ data, step });
  }, [data, step]);

  const update = useCallback(
    <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) =>
      setData((prev) => ({ ...prev, [field]: value })),
    [],
  );

  const domainBlur = async () => {
    const domain = data.domain.trim().toLowerCase();
    if (!DOMAIN_RE.test(domain) || prefilling) return;
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
        content_language:
          prev.content_language && prev.content_language !== "en"
            ? prev.content_language
            : prefill.content_language || "en",
      }));
    } catch {
      /* silent */
    } finally {
      setPrefilling(false);
    }
  };

  const suggestGeoQueries = useCallback(async () => {
    setSuggestingQueries(true);
    try {
      const res = await fetch("/api/onboarding/suggest-geo-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: data.brand_name,
          domain: data.domain,
          brand_description: data.brand_description,
          target_audience: data.target_audience,
          content_language: data.content_language,
          competitors: data.competitors,
        }),
      });
      const json = await res.json().catch(() => ({}));
      const queries: string[] = Array.isArray(json.queries) ? json.queries : [];
      if (queries.length > 0) {
        setData((prev) => ({
          ...prev,
          geo_queries: prev.geo_queries.length > 0 ? prev.geo_queries : queries,
        }));
      }
    } catch {
      /* silent */
    } finally {
      setSuggestingQueries(false);
    }
  }, [
    data.brand_name,
    data.domain,
    data.brand_description,
    data.target_audience,
    data.content_language,
    data.competitors,
  ]);

  // Kick off the AI-query suggestion automatically the first time the user
  // reaches step 5 (AI queries). It takes a few seconds — we hide the
  // latency behind a loading state in the UI.
  useEffect(() => {
    if (step !== 5) return;
    if (querySuggestRequested.current) return;
    if (data.geo_queries.length > 0) {
      querySuggestRequested.current = true;
      return;
    }
    querySuggestRequested.current = true;
    void suggestGeoQueries();
  }, [step, data.geo_queries.length, suggestGeoQueries]);

  const addCompetitor = () => {
    const c = newCompetitor.trim().toLowerCase();
    if (!c) return;
    if (data.competitors.some((x) => x.toLowerCase() === c)) {
      setNewCompetitor("");
      return;
    }
    update("competitors", [...data.competitors, c]);
    setNewCompetitor("");
  };

  const removeCompetitor = (idx: number) =>
    update(
      "competitors",
      data.competitors.filter((_, i) => i !== idx),
    );

  const addQuery = () => {
    const q = newQuery.trim();
    if (!q) return;
    if (data.geo_queries.some((x) => x.toLowerCase() === q.toLowerCase())) {
      setNewQuery("");
      return;
    }
    update("geo_queries", [...data.geo_queries, q]);
    setNewQuery("");
  };

  const removeQuery = (idx: number) =>
    update(
      "geo_queries",
      data.geo_queries.filter((_, i) => i !== idx),
    );

  const startEditQuery = (idx: number) => {
    setEditingQueryIdx(idx);
    setEditingQueryValue(data.geo_queries[idx]);
  };

  const commitEditQuery = () => {
    if (editingQueryIdx === null) return;
    const v = editingQueryValue.trim();
    if (!v) {
      removeQuery(editingQueryIdx);
    } else {
      update(
        "geo_queries",
        data.geo_queries.map((q, i) => (i === editingQueryIdx ? v : q)),
      );
    }
    setEditingQueryIdx(null);
    setEditingQueryValue("");
  };

  const canAdvance = (): boolean => {
    if (step === 0) return DOMAIN_RE.test(data.domain.trim());
    if (step === 1) return !!data.content_language;
    if (step === 2) return data.brand_description.trim().length > 0;
    // Steps 3 (competitors), 4 (brand) and 5 (AI queries) are optional.
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (!canAdvance()) return;
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(effectiveTenantId ? { "X-Sama-Site-Id": effectiveTenantId } : {}),
        },
        body: JSON.stringify({
          domain: data.domain.trim().toLowerCase(),
          brand_name: data.brand_name,
          brand_description: data.brand_description,
          target_audience: data.target_audience,
          content_language: data.content_language,
          competitors: data.competitors,
          geo_queries: data.geo_queries,
          brand_color: data.brand_color,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const jobId = json.job_id as string;
      if (!jobId) throw new Error("Server did not return a job id");
      clearDraft();
      router.push(`/c/onboarding/generating?job=${encodeURIComponent(jobId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : ow.errorGeneral);
      setSubmitting(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const StepIcon = STEP_ICONS[step];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50 text-slate-900">
      {/* The dashboard chrome is rendered throughout onboarding so the user
          sees where they are, but interaction is blocked until they
          finish — clicking around half-way through would lose the wizard
          state and stress the (still empty) tenant. */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none opacity-60"
        tabIndex={-1}
      >
        <CustomerNav />
      </div>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="relative mb-8 text-center">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.localStorage.setItem("sama_onboarding_skipped", "1");
                clearDraft();
              }
              router.push("/c/dashboard");
            }}
            className="absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            {ow.skip}
            <X className="h-3 w-3" />
          </button>
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
            <StepIcon className="h-3.5 w-3.5" />
            {ow.stepPrefix} {step + 1} {ow.stepOf} {TOTAL_STEPS}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            {step === 0 && ow.domainTitle}
            {step === 1 && ow.languageTitle}
            {step === 2 && ow.businessTitle}
            {step === 3 && ow.competitorsTitle}
            {step === 4 && ow.brandingTitle}
            {step === 5 && ow.geoTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {step === 0 && ow.domainDesc}
            {step === 1 && ow.languageDesc}
            {step === 2 && ow.businessDesc}
            {step === 3 && ow.competitorsDesc}
            {step === 4 && ow.brandingDesc}
            {step === 5 && ow.geoDesc}
          </p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-1">
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-8 bg-orange-500"
                  : i < step
                    ? "w-6 bg-emerald-500"
                    : "w-6 bg-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {step === 0 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                <span className="font-semibold">{ow.betaTitle}</span>{" "}
                {ow.betaDesc}
              </div>
              <label className="block text-sm font-medium text-slate-700">
                {ow.domainLabel}
                {prefilling && (
                  <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-slate-400" />
                )}
              </label>
              <input
                type="text"
                autoFocus
                value={data.domain}
                onChange={(e) => update("domain", e.target.value)}
                onBlur={() => void domainBlur()}
                placeholder={ow.domainPlaceholder}
                className="w-full rounded-full border border-slate-300 px-5 py-3 text-base focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              {data.brand_name && (
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-500">{ow.domainFound} </span>
                  <span className="font-medium">{data.brand_name}</span>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => update("content_language", l.code)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    data.content_language === l.code
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="font-medium">{l.label}</span>
                  {data.content_language === l.code && (
                    <Check className="h-4 w-4 text-orange-600" />
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {ow.descriptionLabel}
                </label>
                <textarea
                  value={data.brand_description}
                  onChange={(e) => update("brand_description", e.target.value)}
                  rows={5}
                  placeholder={ow.descriptionPlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-relaxed focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {ow.audienceLabel}
                </label>
                <input
                  type="text"
                  value={data.target_audience}
                  onChange={(e) => update("target_audience", e.target.value)}
                  placeholder={ow.audiencePlaceholder}
                  className="w-full rounded-full border border-slate-300 px-5 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {data.competitors.map((c, i) => (
                  <span
                    key={`${c}-${i}`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
                  >
                    <Globe className="h-3 w-3 text-slate-400" />
                    {c}
                    <button
                      type="button"
                      onClick={() => removeCompetitor(i)}
                      className="rounded-full p-0.5 hover:bg-slate-200"
                      aria-label={ow.removeLabel}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCompetitor();
                    }
                  }}
                  placeholder={ow.competitorPlaceholder}
                  className="flex-1 rounded-full border border-slate-300 px-5 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={addCompetitor}
                  disabled={!newCompetitor.trim()}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {ow.brandColorLabel}
                </label>
                <div className="flex items-center gap-3 rounded-full border border-slate-300 px-4 py-2.5">
                  <input
                    type="color"
                    value={data.brand_color}
                    onChange={(e) => update("brand_color", e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded-md border-0 bg-transparent"
                    aria-label={ow.brandColorLabel}
                  />
                  <input
                    type="text"
                    value={data.brand_color}
                    onChange={(e) => update("brand_color", e.target.value)}
                    placeholder="#4F46E5"
                    className="flex-1 border-0 bg-transparent text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              {suggestingQueries && data.geo_queries.length === 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {ow.geoGenerating}
                </div>
              )}

              <div className="space-y-2">
                {data.geo_queries.map((q, i) =>
                  editingQueryIdx === i ? (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 p-2"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editingQueryValue}
                        onChange={(e) => setEditingQueryValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitEditQuery();
                          } else if (e.key === "Escape") {
                            setEditingQueryIdx(null);
                          }
                        }}
                        className="flex-1 rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                      <button
                        type="button"
                        onClick={commitEditQuery}
                        className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600"
                      >
                        {ow.saveLabel}
                      </button>
                    </div>
                  ) : (
                    <div
                      key={i}
                      className="group flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
                      <span className="flex-1 text-sm leading-relaxed">{q}</span>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEditQuery(i)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          aria-label={ow.editLabel}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQuery(i)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          aria-label={ow.removeLabel}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newQuery}
                  onChange={(e) => setNewQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addQuery();
                    }
                  }}
                  placeholder={ow.geoAddPlaceholder}
                  className="flex-1 rounded-full border border-slate-300 px-5 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={addQuery}
                  disabled={!newQuery.trim()}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {!suggestingQueries && data.geo_queries.length === 0 && (
                <button
                  type="button"
                  onClick={() => void suggestGeoQueries()}
                  className="text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  {ow.geoRefetch}
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 0 || submitting}
              className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-0"
            >
              <ChevronLeft className="h-4 w-4" />
              {ow.back}
            </button>

            {step < TOTAL_STEPS - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance() || submitting}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-8 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {ow.next}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-8 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {ow.starting}
                  </>
                ) : (
                  <>
                    {ow.start}
                    <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
