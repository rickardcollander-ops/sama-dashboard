"use client";

import Link from "next/link";
import { ArrowRight, Bot, Globe, Radar, Sparkles, Zap } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { platformContent } from "@/lib/content/marketing/platform";

const MODULE_ICONS = [Radar, Globe, Bot, Zap, Sparkles];

export default function PlatformPage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";
  const c = platformContent.overview[lang];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-violet-50/60 via-white to-white" />
        <div className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 sm:pb-20">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{c.heading}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">{c.subhead}</p>
          <Link
            href="/c/onboarding"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white hover:bg-slate-800"
          >
            {c.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {c.modules.map((mod, idx) => {
            const Icon = MODULE_ICONS[idx % MODULE_ICONS.length];
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-violet-200 hover:shadow-md"
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold group-hover:text-violet-700">{mod.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{mod.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-violet-600">
                  {lang === "sv" ? "Läs mer" : "Learn more"}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
          <p className="text-sm text-slate-600 sm:text-base">{c.syncedNote}</p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
