"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { supportingContent } from "@/lib/content/marketing/supporting";

export default function AiGapPage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";
  const c = supportingContent.aiGap[lang];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-violet-50/60 via-white to-white" />
        <div className="mx-auto max-w-4xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-20">
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {c.eyebrow}
          </span>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{c.heading}</h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">{c.subhead}</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        {/* What is */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <h2 className="text-xl font-bold">{c.whatIs.heading}</h2>
          </div>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed sm:text-base">{c.whatIs.body}</p>
        </div>

        {/* How SAMA finds */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <h2 className="text-xl font-bold">{c.howSama.heading}</h2>
          </div>
          <ol className="mt-4 space-y-3">
            {c.howSama.steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 sm:text-base">
                <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                  {idx + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Example */}
        <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📖</span>
            <h2 className="text-xl font-bold">{c.example.heading}</h2>
          </div>
          <p className="mt-3 text-sm text-slate-700 leading-relaxed sm:text-base">{c.example.body}</p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={c.ctaLink}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white hover:bg-slate-800"
          >
            {c.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={c.blogLink}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
          >
            {c.blogCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="pb-20" />
      <MarketingFooter />
    </div>
  );
}
