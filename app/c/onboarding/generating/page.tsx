"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Globe, Briefcase, Search, ListTree, PenTool, CalendarCheck, Radar,
  CheckCircle2, AlertCircle, Loader2, MessageSquare, ScanLine,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useSite } from "@/lib/hooks/useSite";
import { useLanguage } from "@/lib/hooks/useLanguage";

interface JobStatus {
  id: string;
  status: "queued" | "running" | "done" | "error";
  step: string;
  progress: number;
  error: string | null;
  result?: {
    audits_started?: {
      site_audit_id?: string;
      analysis_run_id?: string;
    };
  } & Record<string, unknown>;
}

const JOB_STEP_KEYS = [
  { key: "analyzing_site",    icon: Globe },
  { key: "analyzing_brand",   icon: Briefcase },
  { key: "finding_keywords",  icon: Search },
  { key: "planning_content",  icon: ListTree },
  { key: "writing_article_1", icon: PenTool },
  { key: "writing_article_2", icon: PenTool },
  { key: "syncing_calendar",  icon: CalendarCheck },
  { key: "starting_audits",   icon: Radar },
  { key: "saving",            icon: CheckCircle2 },
] as const;

const AUDIT_STEP_KEYS = [
  { key: "site_audit",  icon: ScanLine },
  { key: "ai_analysis", icon: MessageSquare },
] as const;

type Phase = "running_job" | "waiting_audits" | "done" | "error";

// Max time we'll spend waiting for audits after the job completes.
const AUDIT_WAIT_TIMEOUT_MS = 6 * 60_000;

function jobStepIndex(step: string): number {
  const i = JOB_STEP_KEYS.findIndex((s) => s.key === step);
  return i === -1 ? 0 : i;
}

interface RunStatus {
  status: "pending" | "running" | "completed" | "error";
  detail?: string;
}

function GeneratingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("job") || "";
  const { effectiveTenantId } = useSite();
  const { t } = useLanguage();
  const og = t.onboardingGenerating;

  const pollHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (effectiveTenantId) {
      h["X-Tenant-ID"] = effectiveTenantId;
      h["X-Sama-Site-Id"] = effectiveTenantId;
    }
    return h;
  }, [effectiveTenantId]);

  const [job, setJob] = useState<JobStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("running_job");
  const [pollError, setPollError] = useState<string | null>(null);
  const [siteAudit, setSiteAudit] = useState<RunStatus>({ status: "pending" });
  const [aiAnalysis, setAiAnalysis] = useState<RunStatus>({ status: "pending" });
  const startedAt = useRef<number>(Date.now());
  const auditPhaseStartedAt = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  // Repaint once per second so the elapsed counter stays current.
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  void tick;

  // Phase 1: poll the onboarding job until it's done or errored.
  useEffect(() => {
    if (!jobId) {
      router.push("/c/onboarding");
      return;
    }
    if (phase !== "running_job") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/onboarding/generate-plan/${jobId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(og.jobNotFound);
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as JobStatus;
        if (cancelled) return;
        setJob(json);
        setPollError(null);

        if (json.status === "done") {
          const audits = json.result?.audits_started;
          const hasSite = !!audits?.site_audit_id;
          const hasAnalysis = !!audits?.analysis_run_id;
          setSiteAudit({ status: hasSite ? "running" : "completed", detail: hasSite ? undefined : og.skipped });
          setAiAnalysis({ status: hasAnalysis ? "running" : "completed", detail: hasAnalysis ? undefined : og.noQueries });
          auditPhaseStartedAt.current = Date.now();
          setPhase("waiting_audits");
          return;
        }
        if (json.status === "error") {
          setPhase("error");
          return;
        }
        timer = setTimeout(poll, 2500);
      } catch (e) {
        if (cancelled) return;
        setPollError(e instanceof Error ? e.message : og.errorTitle);
        timer = setTimeout(poll, 5000);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, phase, router, og]);

  // Phase 2: poll site audit + analysis runs until both finish (or time out).
  useEffect(() => {
    if (phase !== "waiting_audits") return;
    const audits = job?.result?.audits_started;
    if (!audits) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const pollRun = async (
      runId: string,
      path: "site-audit" | "analysis",
      setter: (s: RunStatus) => void,
    ) => {
      try {
        const res = await fetch(`/api/${path}/runs/${runId}`, {
          cache: "no-store",
          headers: pollHeaders,
        });
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setter({ status: "completed", detail: og.resultNotFound });
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json().catch(() => ({}))) as {
          status?: string;
          error?: string;
        };
        if (cancelled) return;
        const status = (data.status || "running").toLowerCase();
        if (status === "completed" || status === "success") {
          setter({ status: "completed" });
          return;
        }
        if (status === "error" || status === "failed") {
          setter({ status: "error", detail: data.error || og.backendError });
          return;
        }
        setter({ status: "running" });
        timers.push(setTimeout(() => void pollRun(runId, path, setter), 4000));
      } catch (e) {
        if (cancelled) return;
        setter({ status: "running", detail: e instanceof Error ? e.message : og.lostConnection });
        timers.push(setTimeout(() => void pollRun(runId, path, setter), 5000));
      }
    };

    if (audits.site_audit_id) {
      void pollRun(audits.site_audit_id, "site-audit", setSiteAudit);
    }
    if (audits.analysis_run_id) {
      void pollRun(audits.analysis_run_id, "analysis", setAiAnalysis);
    }

    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [phase, job, pollHeaders, og]);

  // Phase 3: when both audits land in a terminal state (or the wait window
  // expires), bounce the user to the review page.
  useEffect(() => {
    if (phase !== "waiting_audits") return;
    const startedAtAudits = auditPhaseStartedAt.current;
    const siteTerminal = siteAudit.status !== "running" && siteAudit.status !== "pending";
    const aiTerminal = aiAnalysis.status !== "running" && aiAnalysis.status !== "pending";
    const timedOut = startedAtAudits != null && Date.now() - startedAtAudits > AUDIT_WAIT_TIMEOUT_MS;
    if ((siteTerminal && aiTerminal) || timedOut) {
      const timer = setTimeout(() => {
        setPhase("done");
        router.push(`/c/onboarding/review?job=${encodeURIComponent(jobId)}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, siteAudit.status, aiAnalysis.status, jobId, router]);

  const idx = job ? jobStepIndex(job.step) : 0;
  const isError = phase === "error";
  const isWaitingAudits = phase === "waiting_audits";
  const isFinishing = phase === "done";

  const elapsedSec = Math.floor((Date.now() - startedAt.current) / 1000);
  const elapsed = `${Math.floor(elapsedSec / 60)}m ${(elapsedSec % 60).toString().padStart(2, "0")}s`;

  const auditFraction = (() => {
    const sDone = siteAudit.status !== "running" && siteAudit.status !== "pending" ? 1 : 0;
    const aDone = aiAnalysis.status !== "running" && aiAnalysis.status !== "pending" ? 1 : 0;
    return (sDone + aDone) / 2;
  })();
  const progress = isWaitingAudits || isFinishing
    ? 90 + Math.round(auditFraction * 10)
    : job?.progress ?? 0;

  // Build labelled steps from translations at render time.
  const jobSteps: { key: string; label: string; sub: string; icon: typeof Globe }[] = [
    { key: "analyzing_site",    label: og.stepAnalyzingSite,    sub: og.stepAnalyzingSiteSub,    icon: Globe },
    { key: "analyzing_brand",   label: og.stepAnalyzingBrand,   sub: og.stepAnalyzingBrandSub,   icon: Briefcase },
    { key: "finding_keywords",  label: og.stepFindingKeywords,  sub: og.stepFindingKeywordsSub,  icon: Search },
    { key: "planning_content",  label: og.stepPlanningContent,  sub: og.stepPlanningContentSub,  icon: ListTree },
    { key: "writing_article_1", label: og.stepWritingArticle1,  sub: og.stepWritingArticleSub,   icon: PenTool },
    { key: "writing_article_2", label: og.stepWritingArticle2,  sub: og.stepWritingArticleSub,   icon: PenTool },
    { key: "syncing_calendar",  label: og.stepSyncingCalendar,  sub: og.stepSyncingCalendarSub,  icon: CalendarCheck },
    { key: "starting_audits",   label: og.stepStartingAudits,   sub: og.stepStartingAuditsSub,   icon: Radar },
    { key: "saving",            label: og.stepSaving,           sub: og.stepSavingSub,           icon: CheckCircle2 },
  ];

  const auditSteps: { key: string; label: string; sub: string; icon: typeof ScanLine }[] = [
    { key: "site_audit",  label: og.auditSiteAudit,  sub: og.auditSiteAuditSub,  icon: ScanLine },
    { key: "ai_analysis", label: og.auditAiAnalysis, sub: og.auditAiAnalysisSub, icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none opacity-60"
        tabIndex={-1}
      >
        <CustomerNav />
      </div>
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            {isError ? (
              <AlertCircle className="h-7 w-7 text-red-600" />
            ) : isFinishing ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            ) : (
              <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isError
              ? og.errorTitle
              : isFinishing
                ? og.doneTitle
                : isWaitingAudits
                  ? og.waitingTitle
                  : og.pageTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isError
              ? og.errorDesc
              : isFinishing
                ? og.doneDesc
                : isWaitingAudits
                  ? og.waitingDesc
                  : og.pageSubtitle}
          </p>
          {!isError && !isFinishing && (
            <p className="mt-1 text-xs text-slate-400">
              {og.elapsed} {elapsed}
            </p>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <ol className="space-y-3">
            {jobSteps.map((s, i) => {
              const Icon = s.icon;
              const stepDone = phase !== "running_job" || i < idx || (i === idx && job?.progress === 100);
              const active = phase === "running_job" && !isError && i === idx;
              return (
                <li
                  key={s.key}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                    stepDone
                      ? "border-emerald-100 bg-emerald-50/40"
                      : active
                        ? "border-orange-200 bg-orange-50/50"
                        : "border-slate-100 bg-slate-50/40"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      stepDone
                        ? "bg-emerald-500 text-white"
                        : active
                          ? "bg-orange-500 text-white"
                          : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {stepDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`text-sm font-medium ${
                        stepDone ? "text-emerald-900" : active ? "text-orange-900" : "text-slate-500"
                      }`}
                    >
                      {s.label}
                    </div>
                    <div className="text-xs text-slate-500">{s.sub}</div>
                  </div>
                </li>
              );
            })}

            {auditSteps.map((s) => {
              const Icon = s.icon;
              const run = s.key === "site_audit" ? siteAudit : aiAnalysis;
              const stepDone =
                phase !== "running_job" &&
                (run.status === "completed" || run.status === "error");
              const active = phase !== "running_job" && run.status === "running";
              return (
                <li
                  key={s.key}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                    stepDone
                      ? run.status === "error"
                        ? "border-amber-200 bg-amber-50/50"
                        : "border-emerald-100 bg-emerald-50/40"
                      : active
                        ? "border-orange-200 bg-orange-50/50"
                        : "border-slate-100 bg-slate-50/40"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      stepDone
                        ? run.status === "error"
                          ? "bg-amber-500 text-white"
                          : "bg-emerald-500 text-white"
                        : active
                          ? "bg-orange-500 text-white"
                          : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {stepDone ? (
                      run.status === "error" ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`text-sm font-medium ${
                        stepDone
                          ? run.status === "error"
                            ? "text-amber-900"
                            : "text-emerald-900"
                          : active
                            ? "text-orange-900"
                            : "text-slate-500"
                      }`}
                    >
                      {s.label}
                    </div>
                    <div className="text-xs text-slate-500">{run.detail || s.sub}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {isError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              {job?.error || og.errorDesc}
            </p>
            <button
              type="button"
              onClick={() => router.push("/c/onboarding")}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {og.retry}
            </button>
          </div>
        )}

        {pollError && !isError && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {og.pollError} ({pollError}){og.retrying}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GeneratingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <GeneratingInner />
    </Suspense>
  );
}
