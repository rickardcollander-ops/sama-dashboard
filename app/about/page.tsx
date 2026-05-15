"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { supportingContent } from "@/lib/content/marketing/supporting";

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Sama AI",
  url: "https://sama.successifier.com/about",
  publisher: {
    "@type": "Organization",
    name: "Sama AI",
    url: "https://sama.successifier.com",
  },
};

export default function AboutPage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";
  const c = supportingContent.about[lang];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />
      <MarketingHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-violet-50/60 via-white to-white" />
        <div className="mx-auto max-w-4xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-20">
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {c.eyebrow}
          </span>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{c.heading}</h1>
          <p className="mt-5 max-w-2xl text-base text-slate-600 leading-relaxed sm:text-lg">
            {c.body}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <ul className="space-y-4">
          {c.principles.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm text-slate-700 sm:text-base">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-violet-500" />
              {p}
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link
            href="/audit"
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
