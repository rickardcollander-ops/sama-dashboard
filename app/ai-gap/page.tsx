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
    <div className="mkt-site">
      <MarketingHeader />
      <main>

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
          <p
            className="mt-4 max-w-2xl text-base sm:text-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            {c.subhead}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        {/* What is */}
        <div className="pillar-card">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {c.whatIs.heading}
            </h2>
          </div>
          <p
            className="mt-3 text-sm leading-relaxed sm:text-base"
            style={{ color: "var(--text-secondary)" }}
          >
            {c.whatIs.body}
          </p>
        </div>

        {/* How SAMA finds */}
        <div className="mt-6 pillar-card">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {c.howSama.heading}
            </h2>
          </div>
          <ol className="mt-4 space-y-3">
            {c.howSama.steps.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-sm sm:text-base"
                style={{ color: "var(--text-secondary)" }}
              >
                <span
                  className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-xs font-bold"
                  style={{
                    background: "rgba(255,107,0,0.15)",
                    border: "1px solid rgba(255,107,0,0.3)",
                    color: "var(--neon-orange)",
                  }}
                >
                  {idx + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Example */}
        <div className="mt-6 ai-gap-box">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📖</span>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {c.example.heading}
            </h2>
          </div>
          <p
            className="mt-3 text-sm leading-relaxed sm:text-base"
            style={{ color: "var(--text-secondary)" }}
          >
            {c.example.body}
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={c.ctaLink} className="hero-cta-primary">
            {c.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href={c.blogLink} className="hero-cta-secondary">
            {c.blogCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="pb-20" />
      </main>
      <MarketingFooter />
    </div>
  );
}
