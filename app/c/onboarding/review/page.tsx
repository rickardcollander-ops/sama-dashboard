"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, FileText, Calendar, Tag, ExternalLink,
  Loader2, ChevronDown, ChevronUp, CheckCircle2, ArrowRight,
} from "lucide-react";
import { useSite } from "@/lib/hooks/useSite";

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

function ContentTypeBadge({ t }: { t: string }) {
  const map: Record<string, { label: string; bg: string }> = {
    blog_post: { label: "Blogg", bg: "bg-blue-100 text-blue-700" },
    linkedin: { label: "LinkedIn", bg: "bg-sky-100 text-sky-700" },
    epost: { label: "E-post", bg: "bg-violet-100 text-violet-700" },
  };
  const e = map[t] || { label: t, bg: "bg-slate-100 text-slate-700" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${e.bg}`}>{e.label}</span>;
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
  const [expandedDraft, setExpandedDraft] = useState<number | null>(0);
  const [jobResult, setJobResult] = useState<OnboardingResult | null>(null);
  const [jobChecked, setJobChecked] = useState(false);

  // Refresh the site cache so the dashboard picks up the new settings.
  useEffect(() => {
    void reloadSites();
  }, [reloadSites]);

  // Read the result straight off the job row when we have a job id —
  // avoids a race with the SiteContext cache (the background writer
  // updates user_sites while the loader page is still active, so
  // activeSite.settings can lag a few seconds).
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

  // Safety net: if we've fully loaded and there's still no result after a
  // generous window (job query + site reload), send the user back to
  // onboarding. The window must outlive the longest of the two so we
  // don't bounce while either source is still in flight.
  useEffect(() => {
    if (result) return;
    if (sitesLoading || !jobChecked) return;
    const t = setTimeout(() => {
      if (!result) router.push("/c/onboarding");
    }, 2000);
    return () => clearTimeout(t);
  }, [result, sitesLoading, jobChecked, router]);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Din plan är klar!</h1>
          <p className="mt-2 text-sm text-slate-600">
            {result.site_meta.brand_name || result.site_meta.domain} — vi har analyserat sajten, hittat{" "}
            {result.keywords.length} relevanta sökord, byggt en {result.plan.length}-dagars plan och skrivit{" "}
            {result.drafts.length} färdiga utkast.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard icon={Tag} label="Sökord" value={result.keywords.length} accent="bg-rose-50 text-rose-700" />
          <SummaryCard icon={Calendar} label="Dagar i planen" value={result.plan.length} accent="bg-blue-50 text-blue-700" />
          <SummaryCard icon={FileText} label="Färdiga utkast" value={result.drafts.length} accent="bg-emerald-50 text-emerald-700" />
        </div>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Relevanta sökord</h2>
            <Link
              href="/c/seo"
              className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
            >
              Öppna SEO-vyn
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
            <h2 className="text-lg font-semibold">30-dagars content-plan</h2>
            <Link
              href="/c/content/plan"
              className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
            >
              Öppna kalendern
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Dag</th>
                  <th className="px-4 py-2 text-left">Titel</th>
                  <th className="px-4 py-2 text-left">Sökord</th>
                  <th className="px-4 py-2 text-left">Typ</th>
                </tr>
              </thead>
              <tbody>
                {result.plan.map((p) => (
                  <tr key={p.day} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {p.day}
                      <div className="text-[10px]">{p.scheduled_for}</div>
                    </td>
                    <td className="px-4 py-2">{p.title}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">{p.target_keyword}</td>
                    <td className="px-4 py-2"><ContentTypeBadge t={p.content_type} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Färdiga utkast att granska</h2>
            <Link
              href="/c/content"
              className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
            >
              Öppna innehåll
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
                        {d.word_count} ord · sökord: <span className="font-medium">{d.target_keyword}</span>
                      </div>
                    </div>
                    {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </button>
                  {open && (
                    <div className="border-t border-slate-100 bg-slate-50/30 px-5 py-4">
                      <div className="mb-3 grid gap-2 text-xs">
                        <div>
                          <span className="text-slate-500">Meta-titel: </span>
                          <span className="font-medium">{d.meta_title}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Meta-beskrivning: </span>
                          <span>{d.meta_description}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Slug: </span>
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
            Till dashboard
            <ExternalLink className="h-4 w-4" />
          </Link>
          <p className="text-xs text-slate-500">
            Genererad {new Date(result.generated_at).toLocaleString()}
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
