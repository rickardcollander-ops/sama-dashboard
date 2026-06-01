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
    <div className="mkt-site">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <MarketingHeader />
      <main>

      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(184,79,255,0.12) 0%, transparent 60%)",
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
        <div className="space-y-3">
          {c.items.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl"
              style={{
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-card)",
                backdropFilter: "blur(8px)",
              }}
            >
              <summary
                className="flex cursor-pointer items-center justify-between px-5 py-4 text-base font-semibold list-none"
                style={{ color: "var(--text-primary)" }}
              >
                {item.q}
                <span
                  className="ml-4 flex-shrink-0 transition-transform group-open:rotate-180"
                  style={{ color: "var(--neon-orange)" }}
                >
                  ▾
                </span>
              </summary>
              <p
                className="px-5 pb-5 text-sm leading-relaxed sm:text-base"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-10">
          <Link href="/audit" className="hero-cta-primary">
            {c.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      </main>
      <MarketingFooter />
    </div>
  );
}
