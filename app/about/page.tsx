"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
    <div className="mkt-site">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
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
          <p
            className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            {c.body}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <ul className="space-y-4">
          {c.principles.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 text-sm sm:text-base"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="mt-0.5 flex-shrink-0">✅</span>
              {p}
            </li>
          ))}
        </ul>

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
