"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";

interface PersonaContent {
  eyebrow: string;
  heading: string;
  subhead: string;
  bullets: string[];
  cta: string;
}

interface Props {
  sv: PersonaContent;
  en: PersonaContent;
}

export default function PersonaPage({ sv, en }: Props) {
  const { language } = useLanguage();
  const c = language === "sv" ? sv : en;

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
          <p
            className="mt-4 max-w-2xl text-base sm:text-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            {c.subhead}
          </p>

          <ul className="mt-8 space-y-3">
            {c.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 text-sm sm:text-base"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="mt-0.5 flex-shrink-0">✅</span>
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/audit" className="hero-cta-primary">
              {c.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/use-cases" className="hero-cta-secondary">
              {language === "sv" ? "← Alla användningsområden" : "← All use cases"}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
