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
    <div className="min-h-screen bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-violet-50/60 via-white to-white" />
        <div className="mx-auto max-w-5xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24 sm:pb-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            <Bot className="h-3.5 w-3.5" />
            {hero.eyebrow}
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {hero.headline.includes(" — ") ? (
              <>
                {hero.headline.split(" — ")[0]} —{" "}
                <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                  {hero.headline.split(" — ")[1]}
                </span>
              </>
            ) : (
              <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                {hero.headline}
              </span>
            )}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 sm:text-lg">
            {hero.subhead}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              {hero.cta1}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/c/onboarding"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              {hero.cta2}
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">{hero.trust}</p>
        </div>
      </section>

      {/* AI engines trust strip */}
      <section className="border-y border-slate-100 bg-slate-50/50 py-5">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{trust.label}</span>
            {AI_ENGINES.map((engine, i) => (
              <span key={engine} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-300">·</span>}
                <span className="font-semibold text-slate-800">{engine}</span>
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="font-medium">{trust.syncLabel}</span>
            {trust.syncs.map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-300">·</span>}
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-2xl font-bold sm:text-3xl">{problem.heading}</h2>
        <p className="mt-4 text-base text-slate-600 leading-relaxed">{problem.body1}</p>
        <p className="mt-4 text-base text-slate-600 leading-relaxed">{problem.body2}</p>
      </section>

      {/* 5 Pillars */}
      <section className="border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              {pillars.eyebrow}
            </span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{pillars.heading}</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.items.map((item, idx) => {
              const Icon = PILLAR_ICONS[idx % PILLAR_ICONS.length];
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-violet-200 hover:shadow-md"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                      <Clock className="h-3 w-3" />
                      {item.schedule}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold group-hover:text-violet-700">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                </Link>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900"
            >
              {pillars.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* AI Gap */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-8 sm:p-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {aiGap.eyebrow}
          </span>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{aiGap.heading}</h2>
          <p className="mt-4 max-w-2xl text-base text-slate-700">{aiGap.body}</p>
          <Link
            href="/ai-gap"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900"
          >
            {aiGap.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Integrations */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-xl font-bold">{integrations.heading}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">
            {integrations.body}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {CMS_INTEGRATIONS.map((cms) => (
              <span
                key={cms}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm"
              >
                {cms}
              </span>
            ))}
            <Link
              href="/integrations"
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              {lang === "sv" ? "+ Fler" : "+ More"} →
            </Link>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {social.eyebrow}
          </span>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{social.heading}</h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {social.stats.map((stat) => (
            <div
              key={stat.value}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"
            >
              <div className="text-4xl font-bold text-violet-600">{stat.value}</div>
              <p className="mt-2 text-sm text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
          <Quote className="h-6 w-6 text-violet-300" />
          <p className="mt-3 text-base italic text-slate-700 sm:text-lg">
            &ldquo;{social.quote}&rdquo;
          </p>
        </div>
      </section>

      {/* Audit CTA strip */}
      <section className="border-t border-slate-100">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-14 text-center sm:px-6 sm:py-20 lg:flex-row lg:justify-between lg:text-left">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold sm:text-3xl">{auditCta.heading}</h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">{auditCta.body}</p>
          </div>
          <Link
            href="/audit"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Globe className="h-4 w-4" />
            {auditCta.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              {pricing.eyebrow}
            </span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{pricing.heading}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">{pricing.subhead}</p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {pricing.tiers.map((t) => (
              <div
                key={t.name}
                className={`relative rounded-2xl border p-6 shadow-sm ${
                  t.highlight
                    ? "border-violet-300 bg-white ring-2 ring-violet-200"
                    : "border-slate-200 bg-white"
                }`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">
                    {lang === "sv" ? "Mest populär" : "Most popular"}
                  </span>
                )}
                <h3 className="text-lg font-semibold">{t.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{t.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{t.price}</span>
                  <span className="text-sm text-slate-500">{t.cadence}</span>
                </div>
                <ul className="mt-6 space-y-2">
                  {t.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
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
              className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900"
            >
              {pricing.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <Sparkles className="mx-auto h-10 w-10 text-violet-400" />
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">{bottom.heading}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300">{bottom.body}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100"
            >
              {bottom.cta1}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/c/onboarding"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-6 py-3 text-base font-semibold text-white hover:bg-slate-800"
            >
              {bottom.cta2}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
