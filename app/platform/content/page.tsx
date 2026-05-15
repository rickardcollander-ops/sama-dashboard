"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, Clock } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { platformContent } from "@/lib/content/marketing/platform";

export default function ContentPage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";
  const c = platformContent.content[lang];

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
          <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">{c.body}</p>
          <ul className="mt-8 space-y-3">
            {c.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-slate-700 sm:text-base">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-violet-500" />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            {c.schedule}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/c/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white hover:bg-slate-800"
            >
              {c.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/ai-gap"
              className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-6 py-3 text-base font-semibold text-violet-700 hover:bg-violet-100"
            >
              {lang === "sv" ? "Vad är AI Gap?" : "What is AI Gap?"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
