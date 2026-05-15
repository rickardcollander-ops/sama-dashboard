"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { supportingContent } from "@/lib/content/marketing/supporting";

export default function FaqPage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";
  const c = supportingContent.faq[lang];

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
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

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="space-y-4">
          {c.items.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-slate-200 bg-white open:border-violet-200"
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-base font-semibold list-none">
                {item.q}
                <span className="ml-4 flex-shrink-0 text-violet-500 group-open:rotate-180 transition-transform">
                  ▾
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed sm:text-base">
                {item.a}
              </p>
            </details>
          ))}
        </div>

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
