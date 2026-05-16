"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle,
  Clock,
  Globe,
  Quote,
  Radar,
  Sparkles,
  Zap,
} from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { homeContent } from "@/lib/content/marketing/home";

const AI_ENGINES = [
  "ChatGPT",
  "Perplexity",
  "Claude",
  "Google AI Overviews",
  "Gemini",
  "Microsoft Copilot",
];

const CMS_INTEGRATIONS = [
  "WordPress",
  "Shopify",
  "Webflow",
  "Framer",
  "Ghost",
  "Wix",
  "GoHighLevel",
  "Duda",
  "BigCommerce",
  "Notion",
];

const PILLAR_ICONS = [Radar, Globe, Bot, Zap, Sparkles];

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://sama.successifier.com/#organization",
      name: "Sama AI",
      url: "https://sama.successifier.com",
      logo: "https://sama.successifier.com/logo.png",
      sameAs: ["https://www.linkedin.com/company/sama-ai"],
    },
    {
      "@type": "WebSite",
      "@id": "https://sama.successifier.com/#website",
      url: "https://sama.successifier.com",
      name: "Sama AI",
      publisher: { "@id": "https://sama.successifier.com/#organization" },
    },
    {
      "@type": "SoftwareApplication",
      name: "Sama AI",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: [
        { "@type": "Offer", price: "149", priceCurrency: "USD", name: "Starter" },
        { "@type": "Offer", price: "399", priceCurrency: "USD", name: "Growth" },
      ],
      description:
        "AI marketing platform: GEO, SEO, content, site analysis and reporting on autopilot.",
    },
  ],
};

export default function HomePage() {
  const { language } = useLanguage();
  const lang = language === "sv" ? "sv" : "en";

  const hero = homeContent.hero[lang];
  const trust = homeContent.trustStrip[lang];
  const problem = homeContent.problem[lang];
  const pillars = homeContent.pillars[lang];
  const aiGap = homeContent.aiGap[lang];
  const integrations = homeContent.integrations[lang];
  const social = homeContent.socialProof[lang];
  const auditCta = homeContent.auditCta[lang];
  const pricing = homeContent.pricing[lang];
  const bottom = homeContent.bottomCta[lang];

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />
      <MarketingHeader />

      {/* Hero */}
      <section className="hero-section">
        <div className="mx-auto max-w-5xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-28 sm:pb-20">
          <span className="hero-eyebrow">
            <Bot className="h-3.5 w-3.5" />
            {hero.eyebrow}
          </span>
          <h1 className="hero-headline mt-6">
            {hero.headline.includes(" — ") ? (
              <>
                {hero.headline.split(" — ")[0]} —{" "}
                <span>{hero.headline.split(" — ")[1]}</span>
              </>
            ) : (
              hero.headline
            )}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg" style={{ color: "var(--text-secondary)" }}>
            {hero.subhead}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/audit" className="hero-cta-primary">
              {hero.cta1}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/c/onboarding" className="hero-cta-secondary">
              {hero.cta2}
            </Link>
          </div>
          <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>{hero.trust}</p>
        </div>
      </section>

      {/* AI engines trust strip */}
      <section className="trust-strip">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{trust.label}</span>
            {AI_ENGINES.map((engine, i) => (
              <span key={engine} className="flex items-center gap-1">
                {i > 0 && <span style={{ color: "var(--neon-orange)", opacity: 0.4 }}>·</span>}
                <span className="font-bold" style={{ color: "var(--neon-blue)" }}>{engine}</span>
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="font-medium">{trust.syncLabel}</span>
            {trust.syncs.map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                {i > 0 && <span style={{ color: "var(--neon-orange)", opacity: 0.4 }}>·</span>}
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: "var(--text-primary)" }}>{problem.heading}</h2>
        <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>{problem.body1}</p>
        <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>{problem.body2}</p>
      </section>

      {/* 5 Pillars */}
      <section style={{ borderTop: "1px solid var(--border-color)" }}>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <span className="neon-eyebrow">{pillars.eyebrow}</span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl" style={{ color: "var(--text-primary)" }}>{pillars.heading}</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.items.map((item, idx) => {
              const Icon = PILLAR_ICONS[idx % PILLAR_ICONS.length];
              return (
                <Link key={item.title} href={item.href} className="pillar-card">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="pillar-card-icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="time-badge">
                      <Clock className="h-3 w-3" />
                      {item.schedule}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
                </Link>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm font-semibold transition"
              style={{ color: "var(--neon-orange)" }}
            >
              {pillars.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* AI Gap */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="ai-gap-box">
          <span className="neon-eyebrow">{aiGap.eyebrow}</span>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl" style={{ color: "var(--text-primary)" }}>{aiGap.heading}</h2>
          <p className="mt-4 max-w-2xl text-base" style={{ color: "var(--text-secondary)" }}>{aiGap.body}</p>
          <Link
            href="/ai-gap"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--neon-orange)" }}
          >
            {aiGap.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Integrations */}
      <section style={{ borderTop: "1px solid var(--border-color)" }} className="py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-xl font-bold" style={{ color: "var(--text-primary)" }}>{integrations.heading}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            {integrations.body}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {CMS_INTEGRATIONS.map((cms) => (
              <span key={cms} className="integration-badge">{cms}</span>
            ))}
            <Link href="/integrations" className="integration-more-btn">
              {lang === "sv" ? "+ Fler" : "+ More"} →
            </Link>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="stats-section">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <span className="neon-eyebrow">{social.eyebrow}</span>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl" style={{ color: "var(--text-primary)" }}>{social.heading}</h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {social.stats.map((stat) => (
              <div key={stat.value} className="stat-card text-center">
                <div className="stat-number">{stat.value}</div>
                <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="testimonial-block mt-10">
            <Quote className="h-6 w-6" style={{ color: "var(--neon-purple)", opacity: 0.6 }} />
            <p className="mt-3 text-base italic sm:text-lg" style={{ color: "var(--text-secondary)" }}>
              &ldquo;{social.quote}&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Audit CTA strip */}
      <section className="cta-banner-section">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-14 text-center sm:px-6 sm:py-20 lg:flex-row lg:justify-between lg:text-left">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: "var(--text-primary)" }}>{auditCta.heading}</h2>
            <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--text-secondary)" }}>{auditCta.body}</p>
          </div>
          <Link href="/audit" className="cta-banner-btn whitespace-nowrap">
            <Globe className="h-4 w-4" />
            {auditCta.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="pricing-section">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <span className="neon-eyebrow">{pricing.eyebrow}</span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl" style={{ color: "var(--text-primary)" }}>{pricing.heading}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base" style={{ color: "var(--text-secondary)" }}>{pricing.subhead}</p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {pricing.tiers.map((t) => (
              <div
                key={t.name}
                className={`relative ${t.highlight ? "pricing-card-popular" : "pricing-card"}`}
              >
                {t.highlight && (
                  <span className="pricing-popular-badge">
                    {lang === "sv" ? "Mest populär" : "Most popular"}
                  </span>
                )}
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{t.name}</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{t.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="pricing-amount">{t.price}</span>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>{t.cadence}</span>
                </div>
                <ul className="mt-6 space-y-2">
                  {t.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "var(--neon-blue)" }} />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/c/pricing"
              className="inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: "var(--neon-orange)" }}
            >
              {pricing.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bottom-cta-section">
        <div className="bottom-cta-orb bottom-cta-orb-1" />
        <div className="bottom-cta-orb bottom-cta-orb-2" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <Sparkles className="mx-auto h-10 w-10" style={{ color: "var(--neon-orange)" }} />
          <h2 className="bottom-cta-headline mt-4">{bottom.heading}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base" style={{ color: "var(--text-secondary)" }}>{bottom.body}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/audit" className="bottom-cta-primary">
              {bottom.cta1}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/c/onboarding" className="bottom-cta-secondary">
              {bottom.cta2}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
