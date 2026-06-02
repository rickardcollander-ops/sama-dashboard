"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { supportingContent } from "@/lib/content/marketing/supporting";

export default function IntegrationsPage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";
  const c = supportingContent.integrations[lang];

  return (
    <div className="mkt-site">
      <MarketingHeader />
      <main>

      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,207,255,0.08) 0%, transparent 60%)",
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

      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        {/* Data sources */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">💾</span>
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {c.dataSources.heading}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {c.dataSources.items.map((item) => (
              <div key={item.name} className="pillar-card">
                <p
                  className="font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.name}
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Publishing */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">📤</span>
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {c.publishing.heading}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.publishing.items.map((item) => (
              <div key={item.name} className="pillar-card">
                <p
                  className="font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.name}
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <Link href="/c/onboarding" className="hero-cta-primary">
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
