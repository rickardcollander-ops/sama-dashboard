"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Globe, Search, ListTree, PenTool, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";

interface JobStatus {
  id: string;
  status: "queued" | "running" | "done" | "error";
  step: string;
  progress: number;
  error: string | null;
  result?: Record<string, unknown>;
}

const STEPS: { key: string; label: string; sub: string; icon: typeof Globe }[] = [
  { key: "analyzing_site",   label: "Analyserar sajten", sub: "Läser om varumärket, ton och språk", icon: Globe },
  { key: "finding_keywords", label: "Hittar relevanta sökord", sub: "12 sökord med affärsvärde för din bransch", icon: Search },
  { key: "planning_content", label: "Bygger 30-dagars plan", sub: "En idé per dag, mappad till sökord", icon: ListTree },
  { key: "writing_article_1", label: "Skriver artikel 1", sub: "Fullt utkast på 1500-2500 ord med SEO-meta", icon: PenTool },
  { key: "writing_article_2", label: "Skriver artikel 2", sub: "Fullt utkast på 1500-2500 ord med SEO-meta", icon: PenTool },
  { key: "saving",           label: "Sparar planen", sub: "Lägger allt på plats i dashboard", icon: CheckCircle2 },
];

function stepIndex(currentStep: string): number {
  const i = STEPS.findIndex((s) => s.key === currentStep);
  return i === -1 ? 0 : i;
}

function GeneratingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("job") || "";
  const [job, setJob] = useState<JobStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!jobId) {
      router.push("/c/onboarding");
      return;
    }
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
          // Small pause so the user sees the green checkmark before redirect.
          timer = setTimeout(() => {
            router.push("/c/onboarding/review");
          }, 1200);
          return;
        }
        if (json.status === "error") {
          return; // Stop polling — surface the error.
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
  }, [jobId, router]);

  const idx = job ? stepIndex(job.step) : 0;
  const isError = job?.status === "error";
  const isDone = job?.status === "done";

  const elapsedSec = Math.floor((Date.now() - startedAt.current) / 1000);
  const elapsed = `${Math.floor(elapsedSec / 60)}m ${(elapsedSec % 60).toString().padStart(2, "0")}s`;

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
            ) : isDone ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            ) : (
              <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isError
              ? "Något gick fel"
              : isDone
                ? "Allt klart!"
                : "Bygger din SAMA-plan"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isError
              ? "Vi kunde inte slutföra genereringen."
              : isDone
                ? "Skickar dig vidare till granskningen…"
                : "Du kan stänga den här fliken — vi mailar när det är klart om du loggar ut."}
          </p>
          {!isError && !isDone && (
            <p className="mt-1 text-xs text-slate-400">
              Förfluten tid: {elapsed}
            </p>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${job?.progress ?? 0}%` }}
            />
          </div>

          <ol className="space-y-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = isDone || i < idx || (i === idx && job?.progress === 100);
              const active = !isDone && !isError && i === idx;
              return (
                <li
                  key={s.key}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                    done
                      ? "border-emerald-100 bg-emerald-50/40"
                      : active
                        ? "border-orange-200 bg-orange-50/50"
                        : "border-slate-100 bg-slate-50/40"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      done
                        ? "bg-emerald-500 text-white"
                        : active
                          ? "bg-orange-500 text-white"
                          : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {done ? (
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
                        done ? "text-emerald-900" : active ? "text-orange-900" : "text-slate-500"
                      }`}
                    >
                      {s.label}
                    </div>
                    <div className="text-xs text-slate-500">{s.sub}</div>
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
