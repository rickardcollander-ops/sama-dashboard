"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Globe, Briefcase, Search, ListTree, PenTool, CalendarCheck, Radar,
  CheckCircle2, AlertCircle, Loader2, MessageSquare, ScanLine,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useSite } from "@/lib/hooks/useSite";

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

// Steps shown by the generation phase (driven by the onboarding_jobs row).
const JOB_STEPS = [
  { key: "analyzing_site",    label: "Analyserar sajten", sub: "Läser om varumärket, ton och språk", icon: Globe },
  { key: "analyzing_brand",   label: "Profilerar varumärket", sub: "Verksamhetstyp, USP, tonalitet och land", icon: Briefcase },
  { key: "finding_keywords",  label: "Hittar relevanta sökord", sub: "12 sökord med affärsvärde för din bransch", icon: Search },
  { key: "planning_content",  label: "Bygger 30-dagars plan", sub: "En idé per dag, mappad till sökord", icon: ListTree },
  { key: "writing_article_1", label: "Skriver artikel 1", sub: "Fullt utkast på 1500-2500 ord med SEO-meta", icon: PenTool },
  { key: "writing_article_2", label: "Skriver artikel 2", sub: "Fullt utkast på 1500-2500 ord med SEO-meta", icon: PenTool },
  { key: "syncing_calendar",  label: "Lägger i kalendern", sub: "Pushar 30 idéer + 2 utkast till content-vyn", icon: CalendarCheck },
  { key: "starting_audits",   label: "Startar sajt- och AI-analys", sub: "Audit och synlighetskoll köas på SAMA-backenden", icon: Radar },
  { key: "saving",            label: "Sparar planen", sub: "All AI-genererad output landar på siten", icon: CheckCircle2 },
] as const;

// Steps shown AFTER the job is done — we keep polling the SAMA backend
// until the site audit and AI visibility check have completed too. They
// run as their own background tasks on the backend (Railway), so the job
// row reports "done" minutes before they actually finish.
const AUDIT_STEPS = [
  { key: "site_audit",  label: "Sajtanalys körs", sub: "Crawl + on-page revision (2-4 min)", icon: ScanLine },
  { key: "ai_analysis", label: "AI-synlighet körs", sub: "Frågor mot ChatGPT, Claude, Perplexity och Gemini", icon: MessageSquare },
] as const;

type Phase = "running_job" | "waiting_audits" | "done" | "error";

// Max time we'll spend waiting for audits after the job completes. After
// this we redirect to review anyway — the user can pick the results up
// from /c/analysis / /c/geo on their own time.
const AUDIT_WAIT_TIMEOUT_MS = 6 * 60_000;

function jobStepIndex(step: string): number {
  const i = JOB_STEPS.findIndex((s) => s.key === step);
  return i === -1 ? 0 : i;
}

interface RunStatus {
  status: "pending" | "running" | "completed" | "error";
  // Free-text message surfaced under the step when the backend errors,
  // so the user can see whether to retry or move on.
  detail?: string;
}

function GeneratingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("job") || "";
  const { effectiveTenantId } = useSite();
  // Polls hit /api/{site-audit,analysis}/runs/{id}, which forwards to the
  // SAMA backend with the user's Supabase bearer. Without a site-id header
  // the dashboard route can't resolve the workspace's domain and used to
  // return 404 for every completed run; supply the active site so the
  // route's domain check works as intended.
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

  // Repaint once per second so the elapsed counter stays current — the
  // job poller fires every 2.5s which leaves the timer feeling stuck.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
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
            throw new Error("Jobbet hittades inte. Starta om onboardingen.");
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
          // Seed each audit's status: "running" if we have an id to
          // poll, "completed" otherwise so the gate clears it.
          setSiteAudit({ status: hasSite ? "running" : "completed", detail: hasSite ? undefined : "Hoppades över" });
          setAiAnalysis({ status: hasAnalysis ? "running" : "completed", detail: hasAnalysis ? undefined : "Inga AI-frågor angivna" });
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
        setPollError(e instanceof Error ? e.message : "Något gick fel");
        timer = setTimeout(poll, 5000);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, phase, router]);

  // Phase 2: poll site audit + analysis runs until both finish (or
  // time out). Each runs in its own polling loop so a slow audit can't
  // block an early-completing analysis from being shown as done.
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
          // 404 from the backend can mean the run was wiped between
          // kickoff and our first poll — treat as "completed" so the
          // gate clears rather than spinning forever.
          if (res.status === 404) {
            if (!cancelled) setter({ status: "completed", detail: "Resultat hittades inte" });
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
          setter({ status: "error", detail: data.error || "Backend rapporterade fel" });
          return;
        }
        setter({ status: "running" });
        timers.push(setTimeout(() => void pollRun(runId, path, setter), 4000));
      } catch (e) {
        if (cancelled) return;
        // Transient errors don't abort — try again in 5 s.
        setter({ status: "running", detail: e instanceof Error ? e.message : "tappade kontakten" });
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
      for (const t of timers) clearTimeout(t);
    };
  }, [phase, job, pollHeaders]);

  // Phase 3: when both audits land in a terminal state (or the wait
  // window expires), bounce the user to the review page.
  useEffect(() => {
    if (phase !== "waiting_audits") return;
    const startedAtAudits = auditPhaseStartedAt.current;
    const siteTerminal = siteAudit.status !== "running" && siteAudit.status !== "pending";
    const aiTerminal = aiAnalysis.status !== "running" && aiAnalysis.status !== "pending";
    const timedOut = startedAtAudits != null && Date.now() - startedAtAudits > AUDIT_WAIT_TIMEOUT_MS;
    if ((siteTerminal && aiTerminal) || timedOut) {
      // Brief pause so the user sees the green checkmarks before we move on.
      const t = setTimeout(() => {
        setPhase("done");
        router.push(`/c/onboarding/review?job=${encodeURIComponent(jobId)}`);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, siteAudit.status, aiAnalysis.status, jobId, router]);

  const idx = job ? jobStepIndex(job.step) : 0;
  const isError = phase === "error";
  const isWaitingAudits = phase === "waiting_audits";
  const isFinishing = phase === "done";

  const elapsedSec = Math.floor((Date.now() - startedAt.current) / 1000);
  const elapsed = `${Math.floor(elapsedSec / 60)}m ${(elapsedSec % 60).toString().padStart(2, "0")}s`;

  // Coarse progress: 0-90 driven by job.progress while running, 90-100
  // driven by audit completion afterwards. Keeps the bar moving so the
  // user doesn't think things stalled.
  const auditFraction = (() => {
    const sDone = siteAudit.status !== "running" && siteAudit.status !== "pending" ? 1 : 0;
    const aDone = aiAnalysis.status !== "running" && aiAnalysis.status !== "pending" ? 1 : 0;
    return (sDone + aDone) / 2;
  })();
  const progress = isWaitingAudits || isFinishing
    ? 90 + Math.round(auditFraction * 10)
    : job?.progress ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      {/* Nav is rendered so the layout doesn't jump, but every interaction
          inside it is blocked until the job finishes — clicking around
          mid-generation would either confuse the user or kick them out of
          the onboarding flow. aria-hidden keeps screen readers focused on
          the live progress panel below. */}
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
              ? "Något gick fel"
              : isFinishing
                ? "Allt klart!"
                : isWaitingAudits
                  ? "Kör analyserna i bakgrunden"
                  : "Bygger din SAMA-plan"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isError
              ? "Vi kunde inte slutföra genereringen."
              : isFinishing
                ? "Skickar dig vidare till granskningen…"
                : isWaitingAudits
                  ? "Sajten crawlas och dina AI-frågor körs mot ChatGPT, Claude, Perplexity och Gemini. Vänta kvar — vi släpper in dig så fort allt är klart."
                  : "Stäng inte fliken — vi behöver hålla den öppen tills planen är på plats."}
          </p>
          {!isError && !isFinishing && (
            <p className="mt-1 text-xs text-slate-400">
              Förfluten tid: {elapsed}
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
            {JOB_STEPS.map((s, i) => {
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

            {AUDIT_STEPS.map((s) => {
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
              {job?.error || "Okänt fel."}
            </p>
            <button
              type="button"
              onClick={() => router.push("/c/onboarding")}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Försök igen
            </button>
          </div>
        )}

        {pollError && !isError && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Tappade kontakten ({pollError}) — försöker igen…
          </div>
        )}

        {/* Always-visible escape hatch. The job is meant to run in the
            background, so blocking the user here when it stalls is what
            traps first-time customers. Lets them bail out to the dashboard
            without losing their plan — the run keeps progressing server-
            side and they can come back to the review page later. */}
        {!isError && !isFinishing && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("sama_onboarding_skipped", "1");
                }
                router.push("/c/dashboard");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Avbryt och gå till dashboard
            </button>
            <p className="text-[11px] text-slate-400">
              Genereringen fortsätter i bakgrunden — du kan komma tillbaka senare.
            </p>
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
