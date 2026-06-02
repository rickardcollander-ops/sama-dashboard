"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { platformContent } from "@/lib/content/marketing/platform";

const MODULE_ICONS = ["📡", "🌐", "🤖", "⚡", "✨"];

export default function PlatformPage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";
  const c = platformContent.overview[lang];

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
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ color: "var(--text-primary)" }}
          >
            {c.heading}
          </h1>
          <p
            className="mx-auto mt-4 max-w-2xl text-base sm:text-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            {c.subhead}
          </p>
          <Link href="/c/onboarding" className="mt-8 hero-cta-primary inline-flex">
            {c.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {c.modules.map((mod, idx) => {
            const icon = MODULE_ICONS[idx % MODULE_ICONS.length];
            return (
              <Link key={mod.href} href={mod.href} className="pillar-card">
                <div className="mb-4 pillar-card-icon">
                  <span className="text-xl">{icon}</span>
                </div>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {mod.title}
                </h2>
                <p
                  className="mt-2 text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {mod.desc}
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

        <div
          className="mt-12 rounded-2xl p-6 sm:p-8"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <p className="text-sm sm:text-base" style={{ color: "var(--text-secondary)" }}>
            {c.syncedNote}
          </p>
        </div>
      </section>

      </main>
      <MarketingFooter />
    </div>
  );
}
