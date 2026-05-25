"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, X, Calendar, Linkedin, Twitter, Instagram, Facebook, CheckCircle2, AlertTriangle } from "lucide-react";
import type { AnalysisRun } from "@/app/c/analysis/types";

// Always go through the /api/sama proxy so the dashboard's Supabase session
// is validated server-side and X-Sama-Account-Id is injected from the
// authenticated user. Hitting the railway URL directly bypasses that and
// trips the backend's "missing tenant context" 401 guard.
const PROXY_BASE = "/api/sama";

export interface CreateContentPlanModalProps {
  analysisRunId: string;
  tenantId: string;
  /**
   * The full AnalysisRun the user is operating on. We forward its payload
   * (query_results, overview) and brand context inline so the agent backend
   * doesn't have to look the run up in its own analysis_runs table — that
   * lookup fails for runs the dashboard restored from local cache
   * (user_settings.saved_analyses_by_tenant).
   */
  analysisRun?: AnalysisRun | null;
  onClose: () => void;
  onSuccess?: (result: {
    articles_per_week: number;
    social_posts_per_week: number;
    social_platforms: string[];
    message: string;
    run_id?: string;
  }) => void;
}

type Platform = "linkedin" | "x" | "instagram" | "facebook";

const PLATFORM_OPTIONS: { id: Platform; label: string; Icon: typeof Linkedin }[] = [
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { id: "x", label: "X (Twitter)", Icon: Twitter },
  { id: "instagram", label: "Instagram", Icon: Instagram },
  { id: "facebook", label: "Facebook", Icon: Facebook },
];

export default function CreateContentPlanModal({
  analysisRunId,
  tenantId,
  analysisRun,
  onClose,
  onSuccess,
}: CreateContentPlanModalProps) {
  const [articlesPerWeek, setArticlesPerWeek] = useState<number>(2);
  const [socialPostsPerWeek, setSocialPostsPerWeek] = useState<number>(2);
  const [platforms, setPlatforms] = useState<Set<Platform>>(
    new Set(["linkedin"]),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const togglePlatform = (p: Platform) => {
    const next = new Set(platforms);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setPlatforms(next);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const includeSocial = socialPostsPerWeek > 0 && platforms.size > 0;
      const res = await fetch(
        `${PROXY_BASE}/api/content/plan/create-from-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tenant-ID": tenantId,
            "X-Sama-Site-Id": tenantId,
            "X-Sama-Intent": "user-action",
          },
          body: JSON.stringify({
            analysis_run_id: analysisRunId,
            articles_per_week: articlesPerWeek,
            social_posts_per_week: includeSocial ? socialPostsPerWeek : 0,
            social_platforms: includeSocial ? Array.from(platforms) : [],
            // Forward the run inline so the backend can use it directly when
            // its own analysis_runs table doesn't have the row (e.g. saved
            // history that survived a backend rotation).
            ...(analysisRun
              ? {
                  analysis_payload: {
                    query_results: analysisRun.query_results,
                    overview: analysisRun.overview,
                  },
                  analysis_domain: analysisRun.domain,
                  analysis_brand_name: analysisRun.brand_name,
                }
              : {}),
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setDone(data.message || "Idea list being created in the background.");
      onSuccess?.({
        articles_per_week: articlesPerWeek,
        social_posts_per_week: includeSocial ? socialPostsPerWeek : 0,
        social_platforms: includeSocial ? Array.from(platforms) : [],
        message: data.message || "",
        run_id: typeof data.run_id === "string" ? data.run_id : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create content plan");
    } finally {
      setSubmitting(false);
    }
  };

  const totalArticles = articlesPerWeek * 13;
  const totalSocial = socialPostsPerWeek * 13 * platforms.size;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-semibold text-slate-900">
              Create content plan
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h4 className="mt-3 text-base font-semibold text-slate-900">
              Idea list being created!
            </h4>
            <p className="mt-1 text-sm text-slate-600">{done}</p>
            <p className="mt-2 text-xs text-slate-500">
              We don't write the text yet — you approve ideas one at a time
              under Content → Ideas.
            </p>
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              {/* next/link does a soft client-side navigation so the
                  ActiveRunsProvider stays mounted and the bottom-right
                  "agent kör"-bannern överlever rutbytet. Annars unmountas
                  hela /c-trädet och bannern blinkar bort.  */}
              <Link
                href="/c/content?tab=ideas"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Show ideas
              </Link>
              <Link
                href="/c/content/plan"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Show the plan
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-5 p-5">
              <p className="text-sm text-slate-600">
                We generate a list of article and post ideas for the next
                90 days based on your gaps in Insights. The text is only
                written once you approve ideas one at a time.
              </p>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Articles per week
                </span>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setArticlesPerWeek(n)}
                      className={`flex h-12 w-12 items-center justify-center rounded-lg border text-base font-semibold transition ${
                        articlesPerWeek === n
                          ? "border-violet-600 bg-violet-50 text-violet-700"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Approximately {totalArticles} articles over 90 days.
                </p>
              </label>

              <div>
                <span className="text-sm font-medium text-slate-700">
                  Social posts per week
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  How often we schedule posts per selected platform. Set 0 to
                  skip social entirely.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSocialPostsPerWeek(n)}
                      className={`flex h-12 w-12 items-center justify-center rounded-lg border text-base font-semibold transition ${
                        socialPostsPerWeek === n
                          ? "border-violet-600 bg-violet-50 text-violet-700"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-slate-700">
                  Include social media
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  Posts link to the nearest article and you'll get them emailed for
                  manual publishing.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {PLATFORM_OPTIONS.map(({ id, label, Icon }) => {
                    const active = platforms.has(id);
                    const disabled = socialPostsPerWeek === 0;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => togglePlatform(id)}
                        disabled={disabled}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                          disabled
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                            : active
                            ? "border-violet-600 bg-violet-50 text-violet-700"
                            : "border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1 font-medium">{label}</span>
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            active && !disabled
                              ? "border-violet-600 bg-violet-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {active && !disabled && <CheckCircle2 className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {socialPostsPerWeek > 0 && platforms.size > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Approximately {totalSocial} social posts in total ({socialPostsPerWeek} × 13 weeks × {platforms.size} platform{platforms.size === 1 ? "" : "s"}).
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <strong className="font-semibold text-slate-700">How it works:</strong>{" "}
                We create the idea list immediately. When you approve an article idea,
                the full text is written (in your tone, without AI tells like em-dash,
                "delve" or "moreover") along with the matching social posts — all in the
                same step.
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2 text-sm font-semibold text-white hover:from-violet-700 hover:to-blue-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                Create plan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
