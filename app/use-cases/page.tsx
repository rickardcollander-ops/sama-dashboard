"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { useCasesContent } from "@/lib/content/marketing/useCases";

const PERSONAS = [
  { key: "saas", href: "/use-cases/saas" },
  { key: "ecommerce", href: "/use-cases/ecommerce" },
  { key: "agencies", href: "/use-cases/agencies" },
  { key: "localBusiness", href: "/use-cases/local-business" },
  { key: "consulting", href: "/use-cases/consulting" },
  { key: "media", href: "/use-cases/media" },
] as const;

export default function UseCasesPage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";
  const hub = useCasesContent.hub[lang];

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
        <div className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 sm:pb-20">
          <span className="neon-eyebrow">{hub.eyebrow}</span>
          <h1
            className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ color: "var(--text-primary)" }}
          >
            {hub.heading}
          </h1>
          <p
            className="mx-auto mt-4 max-w-2xl text-base"
            style={{ color: "var(--text-secondary)" }}
          >
            {hub.subhead}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONAS.map(({ key, href }) => {
            const p = useCasesContent.personas[key][lang];
            return (
              <Link key={href} href={href} className="pillar-card">
                <span className="neon-eyebrow">{p.eyebrow}</span>
                <h2
                  className="mt-2 text-lg font-bold leading-snug"
                  style={{ color: "var(--text-primary)" }}
                >
                  {p.heading}
                </h2>
                <p
                  className="mt-2 text-sm line-clamp-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {p.subhead}
                </p>
                <span
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: "var(--neon-orange)" }}
                >
                  {lang === "sv" ? "Läs mer" : "Learn more"}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      </main>
      <MarketingFooter />
    </div>
  );
}
