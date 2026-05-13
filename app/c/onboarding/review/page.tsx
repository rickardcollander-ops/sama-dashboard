"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, FileText, Calendar, Tag, ExternalLink,
  Loader2, ChevronDown, ChevronUp, CheckCircle2, ArrowRight,
} from "lucide-react";
import { useSite } from "@/lib/hooks/useSite";
import { useLanguage } from "@/lib/hooks/useLanguage";

interface Keyword {
  text: string;
  intent?: string;
  priority?: string;
  reason?: string;
}
interface PlanEntry {
  day: number;
  scheduled_for: string;
  title: string;
  target_keyword: string;
  content_type: string;
  angle: string;
}
interface Draft {
  title: string;
  slug: string;
  meta_title: string;
  meta_description: string;
  target_keyword: string;
  word_count: number;
  body_markdown: string;
}
interface OnboardingResult {
  site_meta: { domain: string; brand_name: string; brand_description: string; content_language: string };
  keywords: Keyword[];
  plan: PlanEntry[];
  drafts: Draft[];
  generated_at: string;
  backend_sync?: {
    attempted: boolean;
    pieces_created: number;
    pieces_failed: number;
    error?: string;
  };
  audits_started?: {
    site_audit_id?: string;
    analysis_run_id?: string;
    error?: string;
  };
  tenant_activation?: {
    succeeded: boolean;
    error?: string;
  };
}

function PriorityBadge({ p }: { p?: string }) {
  const color =
    p === "high"
      ? "bg-rose-100 text-rose-700"
      : p === "medium"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}>{p || "–"}</span>;
}

function isOnboardingResult(value: unknown): value is OnboardingResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.keywords) && Array.isArray(v.plan) && Array.isArray(v.drafts);
}

function ReviewInner() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("job");
  const { activeSite, loading: sitesLoading, reloadSites } = useSite();
  const { t } = useLanguage();
  const or = t.onboardingReview;
  const [expandedDraft, setExpandedDraft] = useState<number | null>(0);
  const [jobResult, setJobResult] = useState<OnboardingResult | null>(null);
  const [jobChecked, setJobChecked] = useState(false);

  const contentTypeLabel = (type: string): { label: string; bg: string } => {
    const map: Record<string, { label: string; bg: string }> = {
      blog_post: { label: or.typeBlog, bg: "bg-blue-100 text-blue-700" },
      linkedin: { label: or.typeLinkedin, bg: "bg-sky-100 text-sky-700" },
      epost: { label: or.typeEmail, bg: "bg-violet-100 text-violet-700" },
    };
    return map[type] || { label: type, bg: "bg-slate-100 text-slate-700" };
  };

  // Refresh the site cache so the dashboard picks up the new settings.
  useEffect(() => {
    void reloadSites();
  }, [reloadSites]);

  // Read the result straight off the job row when we have a job id.
  useEffect(() => {
    if (!jobId) {
      setJobChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/generate-plan/${jobId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        if (isOnboardingResult(json.result)) {
          setJobResult(json.result);
        }
      } catch {
        /* fall back to site settings below */
      } finally {
        if (!cancelled) setJobChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const result = useMemo<OnboardingResult | null>(() => {
    if (jobResult) return jobResult;
    const settings = (activeSite?.settings as Record<string, unknown> | undefined) || {};
    return isOnboardingResult(settings.onboarding_result) ? settings.onboarding_result : null;
  }, [jobResult, activeSite]);

  useEffect(() => {
    if (result) return;
    if (sitesLoading || !jobChecked) return;
    const timer = setTimeout(() => {
      if (!result) router.push("/c/onboarding");
    }, 2000);
    return () => clearTimeout(timer);
  }, [result, sitesLoading, jobChecked, router]);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const brand = result.site_meta.brand_name || result.site_meta.domain;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{or.title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {brand} — {or.subtitlePrefix}{" "}
            {result.keywords.length} {or.subtitleKeywords}{" "}
            {result.plan.length}{or.subtitleDayPlan}{" "}
            {result.drafts.length} {or.subtitleDrafts}
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard icon={Tag} label={or.keywordsTitle} value={result.keywords.length} accent="bg-rose-50 text-rose-700" />
          <SummaryCard icon={Calendar} label={or.planTitle} value={result.plan.length} accent="bg-blue-50 text-blue-700" />
          <SummaryCard icon={FileText} label={or.draftsTitle} value={result.drafts.length} accent="bg-emerald-50 text-emerald-700" />
        </div>

        {(result.tenant_activation || result.backend_sync || result.audits_started) && (
          <div className="mt-6 space-y-2">
            {result.tenant_activation && (
              <div
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                  result.tenant_activation.succeeded
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">
                    {result.tenant_activation.succeeded ? or.tenantActivated : or.tenantFailed}
                  </div>
                  {result.tenant_activation.error && (
                    <div className="mt-1 text-xs opacity-80">{result.tenant_activation.error}</div>
                  )}
                </div>
              </div>
            )}
            {result.backend_sync && (
              <div
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                  result.backend_sync.pieces_failed === 0 && result.backend_sync.pieces_created > 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">
                    {or.syncPrefix}{" "}
                    {result.backend_sync.pieces_failed === 0
                      ? `${result.backend_sync.pieces_created} ${or.syncSuccess}`
                      : `${result.backend_sync.pieces_created} ${or.syncPartial} ${result.backend_sync.pieces_failed} ${or.syncFailed}`}
                  </div>
                  {result.backend_sync.error && (
                    <div className="mt-1 text-xs opacity-80">{result.backend_sync.error}</div>
                  )}
                </div>
              </div>
            )}
            {result.audits_started && (
              <div
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                  result.audits_started.site_audit_id || result.audits_started.analysis_run_id
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">
                    {result.audits_started.site_audit_id && result.audits_started.analysis_run_id
                      ? or.auditsRunning
                      : result.audits_started.site_audit_id
                        ? or.auditSiteOnly
                        : result.audits_started.analysis_run_id
                          ? or.auditAiOnly
                          : or.auditNone}
                  </div>
                  {result.audits_started.error && (
                    <div className="mt-1 text-xs opacity-80">{result.audits_started.error}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{or.keywordsTitle}</h2>
            <Link
              href="/c/seo"
              className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
            >
              {or.openSeo}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              {result.keywords.map((k, i) => (
                <div
                  key={`${k.text}-${i}`}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                >
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{k.text}</span>
                      <PriorityBadge p={k.priority} />
                    </div>
                    {k.reason && (
                      <p className="mt-0.5 text-xs leading-snug text-slate-500">{k.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{or.planTitle}</h2>
            <Link
              href="/c/content/plan"
              className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
            >
              {or.openCalendar}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">{or.colDay}</th>
                  <th className="px-4 py-2 text-left">{or.colTitle}</th>
                  <th className="px-4 py-2 text-left">{or.colKeyword}</th>
                  <th className="px-4 py-2 text-left">{or.colType}</th>
                </tr>
              </thead>
              <tbody>
                {result.plan.map((p) => {
                  const ct = contentTypeLabel(p.content_type);
                  return (
                    <tr key={p.day} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {p.day}
                        <div className="text-[10px]">{p.scheduled_for}</div>
                      </td>
                      <td className="px-4 py-2">{p.title}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{p.target_keyword}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ct.bg}`}>{ct.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{or.draftsTitle}</h2>
            <Link
              href="/c/content"
              className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
            >
              {or.openContent}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {result.drafts.map((d, i) => {
              const open = expandedDraft === i;
              return (
                <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedDraft(open ? null : i)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50"
                  >
                    <FileText className="h-5 w-5 flex-shrink-0 text-orange-500" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{d.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {d.word_count} {or.words} · {or.keyword} <span className="font-medium">{d.target_keyword}</span>
                      </div>
                    </div>
                    {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </button>
                  {open && (
                    <div className="border-t border-slate-100 bg-slate-50/30 px-5 py-4">
                      <div className="mb-3 grid gap-2 text-xs">
                        <div>
                          <span className="text-slate-500">{or.metaTitle} </span>
                          <span className="font-medium">{d.meta_title}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{or.metaDesc} </span>
                          <span>{d.meta_description}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{or.slug} </span>
                          <code className="rounded bg-white px-1.5 py-0.5 text-[11px]">{d.slug}</code>
                        </div>
                      </div>
                      <article className="prose prose-sm max-w-none whitespace-pre-wrap rounded-xl bg-white p-4 font-serif text-[13px] leading-relaxed text-slate-800">
                        {d.body_markdown}
                      </article>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/c/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            {or.toDashboard}
            <ExternalLink className="h-4 w-4" />
          </Link>
          <p className="text-xs text-slate-500">
            {or.generated} {new Date(result.generated_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Tag;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function OnboardingReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <ReviewInner />
    </Suspense>
  );
}
