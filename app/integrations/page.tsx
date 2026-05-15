"use client";

import Link from "next/link";
import { ArrowRight, Database, Send } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { supportingContent } from "@/lib/content/marketing/supporting";

export default function IntegrationsPage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";
  const c = supportingContent.integrations[lang];

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
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        {/* Data sources */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-5 w-5 text-violet-500" />
            <h2 className="text-xl font-bold">{c.dataSources.heading}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {c.dataSources.items.map((item) => (
              <div
                key={item.name}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Publishing */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Send className="h-5 w-5 text-violet-500" />
            <h2 className="text-xl font-bold">{c.publishing.heading}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.publishing.items.map((item) => (
              <div
                key={item.name}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <Link
            href="/c/onboarding"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white hover:bg-slate-800"
          >
            {c.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
