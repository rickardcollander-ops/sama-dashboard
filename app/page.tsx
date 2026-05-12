import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Bot,
  CheckCircle,
  FileText,
  Gauge,
  Globe,
  Radar,
  Send,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata: Metadata = {
  title: "Sama AI — Get cited by ChatGPT, Perplexity & Google AI",
  description:
    "AI has eaten search. Sama is the complete pipeline that audits, plans, writes and publishes the content AI engines actually cite — so your business is the one they recommend.",
  openGraph: {
    title: "Sama AI — Get cited by ChatGPT, Perplexity & Google AI",
    description:
      "The complete pipeline from audit to publish. Be the brand AI mentions when your customers ask.",
    type: "website",
    siteName: "Sama AI",
  },
};

const FEATURES = [
  {
    icon: Gauge,
    title: "AI visibility audit",
    desc: "30-second scan that scores how ChatGPT, Perplexity and Google AI see your site. Find every gap before your competitor does.",
  },
  {
    icon: Target,
    title: "Strategy + GEO insights",
    desc: "Tracks how often your brand surfaces in AI answers, who outranks you, and what content gaps you need to close.",
  },
  {
    icon: Bot,
    title: "Autonomous content agent",
    desc: "Drafts citation-ready articles from your strategy in minutes. You approve, the agent ships — no blank-page syndrome.",
  },
  {
    icon: Send,
    title: "Publish + weekly reports",
    desc: "One-click publish to WordPress, Ghost, Webflow or webhook. Weekly mail keeps your team on top of progress.",
  },
];

const STEPS = [
  {
    icon: Radar,
    title: "1. We audit your AI footprint",
    desc: "Free 30-second scan tells you exactly which AI engines mention you, which mention competitors, and why.",
  },
  {
    icon: Sparkles,
    title: "2. The agent builds the plan",
    desc: "From audit to strategy: which queries to win, which articles to write, which competitors to outflank.",
  },
  {
    icon: Zap,
    title: "3. Ship content AI cites",
    desc: "Approve drafts in a click, publish to your CMS, and watch your AI visibility climb week over week.",
  },
];

const TIERS = [
  {
    name: "Starter",
    price: "$149",
    cadence: "/mo",
    desc: "For founders and small teams getting into AI search.",
    features: ["1 site", "Weekly AI visibility scan", "10 content drafts/mo"],
  },
  {
    name: "Growth",
    price: "$399",
    cadence: "/mo",
    desc: "For teams that need to ship content and own the rankings.",
    features: ["3 sites", "Daily monitoring", "Unlimited drafts", "CMS integrations"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    desc: "For multi-brand teams and agencies with scale needs.",
    features: ["Unlimited sites", "Multi-tenant admin", "Dedicated success"],
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-violet-50/60 via-white to-white" />
        <div className="mx-auto max-w-5xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 sm:pb-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            <Bot className="h-3.5 w-3.5" />
            Generative Engine Optimization, end-to-end
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
            AI has eaten search.{" "}
            <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              Be the answer it gives.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 sm:text-lg">
            ChatGPT, Perplexity and Google AI now decide which brands customers
            hear about — and most websites are invisible to them. Sama is the
            complete pipeline from audit to published article, so your business
            is the one AI cites.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Run free AI audit
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/c/onboarding"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              Start 14-day trial
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Free audit · No card · Results in 30 seconds
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            How it works
          </span>
          <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            From invisible to cited, in three moves
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
            Most tools give you one piece. Sama runs the whole loop — so you
            don&apos;t hand off between five vendors to ship one article.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-violet-50 text-violet-600">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              Built for AI search
            </span>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              One pipeline. Every step covered.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
              Audit, strategy, content, publishing, monitoring — all under one
              roof, all designed for how AI engines actually rank brands today.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audit CTA strip */}
      <section className="border-t border-slate-100">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-14 text-center sm:px-6 sm:py-20 lg:flex-row lg:justify-between lg:text-left">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              See your AI visibility score in 30 seconds
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Free, no card, no account. We crawl your homepage and hand you 5
              AI queries you can test live in Perplexity, ChatGPT and Google AI
              right now.
            </p>
          </div>
          <Link
            href="/audit"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Globe className="h-4 w-4" />
            Run free audit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              Pricing
            </span>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              Start free. Scale when AI starts citing you.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
              All plans include the audit, content agent, and publishing.
              Choose the size that fits how many sites you run.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {TIERS.map((t) => (
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
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-slate-900">{t.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{t.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">{t.price}</span>
                  <span className="text-sm text-slate-500">{t.cadence}</span>
                </div>
                <ul className="mt-6 space-y-2">
                  {t.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/c/pricing"
              className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900"
            >
              Compare plans in detail
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <FileText className="mx-auto h-10 w-10 text-violet-400" />
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            The next time someone asks AI, be the answer.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300">
            Start with the free audit. See where you stand, see what to fix,
            and ship your first AI-cited article this week.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100"
            >
              Run free audit
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/c/onboarding"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-6 py-3 text-base font-semibold text-white hover:bg-slate-800"
            >
              Start 14-day trial
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
