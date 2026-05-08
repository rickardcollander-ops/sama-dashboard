"use client";

import { useState } from "react";
import { Loader2, X, Calendar, Linkedin, Twitter, Instagram, Facebook, CheckCircle2, AlertTriangle } from "lucide-react";
import { SAMA_API_URL } from "@/lib/api";

export interface CreateContentPlanModalProps {
  analysisRunId: string;
  tenantId: string;
  onClose: () => void;
  onSuccess?: (result: {
    articles_per_week: number;
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
  onClose,
  onSuccess,
}: CreateContentPlanModalProps) {
  const [articlesPerWeek, setArticlesPerWeek] = useState<number>(2);
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
      const res = await fetch(
        `${SAMA_API_URL}/api/content/plan/create-from-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tenant-ID": tenantId,
            "X-Sama-Site-Id": tenantId,
          },
          body: JSON.stringify({
            analysis_run_id: analysisRunId,
            articles_per_week: articlesPerWeek,
            social_platforms: Array.from(platforms),
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setDone(data.message || "Plan skapas i bakgrunden.");
      onSuccess?.({
        articles_per_week: articlesPerWeek,
        social_platforms: Array.from(platforms),
        message: data.message || "",
        run_id: typeof data.run_id === "string" ? data.run_id : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte skapa content-plan");
    } finally {
      setSubmitting(false);
    }
  };

  const totalArticles = articlesPerWeek * 13;
  const totalSocial = totalArticles * platforms.size;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-semibold text-slate-900">
              Skapa content-plan
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Stäng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h4 className="mt-3 text-base font-semibold text-slate-900">
              Plan skapas!
            </h4>
            <p className="mt-1 text-sm text-slate-600">{done}</p>
            <a
              href="/c/content/plan"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Visa kalendern
            </a>
          </div>
        ) : (
          <>
            <div className="space-y-5 p-5">
              <p className="text-sm text-slate-600">
                Vi använder analysens gap och din hemsidas ton för att skriva en
                content-plan för de kommande 90 dagarna.
              </p>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Artiklar per vecka
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
                  Cirka {totalArticles} artiklar totalt under 90 dagar.
                </p>
              </label>

              <div>
                <span className="text-sm font-medium text-slate-700">
                  Inkludera social media
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  För varje artikel skapas matchande inlägg som schemaläggs dagen
                  efter publicering. Du får dem mailade för manuell publicering.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {PLATFORM_OPTIONS.map(({ id, label, Icon }) => {
                    const active = platforms.has(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => togglePlatform(id)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                          active
                            ? "border-violet-600 bg-violet-50 text-violet-700"
                            : "border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1 font-medium">{label}</span>
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            active
                              ? "border-violet-600 bg-violet-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {active && <CheckCircle2 className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {platforms.size > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Cirka {totalSocial} sociala inlägg totalt ({totalArticles} × {platforms.size}).
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <strong className="font-semibold text-slate-700">Tonmatchning:</strong>{" "}
                Innehållet skrivs i din egen hemsidas ton (vi skrapar din domän om
                vi inte redan har gört det) och utan AI-tells som em-dash, „delve”
                eller „moreover”.
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
                Avbryt
              </button>
              <button
                onClick={submit}
                disabled={submitting || platforms.size === 0}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2 text-sm font-semibold text-white hover:from-violet-700 hover:to-blue-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                Skapa plan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
