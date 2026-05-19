"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { supportingContent } from "@/lib/content/marketing/supporting";

export default function HowItWorksPage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";
  const c = supportingContent.howItWorks[lang];

  return (
    <div className="mkt-site">
      <MarketingHeader />

      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,107,0,0.1) 0%, transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-4xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-20">
          <span className="neon-eyebrow">{c.eyebrow}</span>
          <h1
            className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ color: "var(--text-primary)" }}
          >
            {c.heading}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="space-y-8">
          {c.steps.map((step, idx) => (
            <div key={step.phase} className="flex gap-5">
              <div className="flex flex-col items-center">
                <div
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                  style={{ background: "var(--grad-orange)" }}
                >
                  {idx + 1}
                </div>
                {idx < c.steps.length - 1 && (
                  <div
                    className="mt-2 w-0.5 flex-1"
                    style={{ background: "rgba(255,107,0,0.2)" }}
                  />
                )}
              </div>
              <div className="pb-8">
                <h2
                  className="text-lg font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {step.phase}
                </h2>
                <p
                  className="mt-2 text-sm leading-relaxed sm:text-base"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/audit" className="hero-cta-primary">
            {c.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/platform" className="hero-cta-secondary">
            {lang === "sv" ? "Se plattformen" : "See the platform"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
