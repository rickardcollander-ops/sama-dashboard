"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search, Sparkles, ArrowRight, CheckCircle, XCircle,
  Loader2, Globe, TrendingUp, Bot,
} from "lucide-react";
import PublicAuditResult, { type AuditResult } from "@/components/analysis/PublicAuditResult";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export default function AuditLandingPage() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/public-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
      } else {
        setResult(data);
        setTimeout(() => {
          document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
        }, 80);
      }
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-violet-50/60 via-white to-white" />
        <div className="mx-auto max-w-4xl px-4 pt-12 pb-10 text-center sm:px-6 sm:pt-20 sm:pb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            <Bot className="h-3.5 w-3.5" />
            How visible is your business in ChatGPT, Perplexity & Google AI?
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Is your website ready for{" "}
            <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              AI search?
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
            Get a free 30-second analysis of your website plus 5 ready-to-test AI search
            queries — see exactly how your brand shows up when customers ask AI.
          </p>

          <form onSubmit={onSubmit} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="yourcompany.com"
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-3 text-base shadow-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                autoComplete="url"
                inputMode="url"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !domain.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Crawling your site…
                </>
              ) : (
                <>
                  Run free audit
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-400">
            Free · No card · No account · Takes about 15–60 seconds
          </p>

          {error && (
            <div className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Live-crawls your homepage</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Analyses SEO + GEO</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Ready-made AI queries to test</span>
          </div>
        </div>
      </section>

      {result && (
        <section id="results" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <PublicAuditResult result={result} />
        </section>
      )}

      {!result && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Three steps from invisible to cited by AI
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Search, title: "1. We scan your site", desc: "We fetch your homepage and analyse 15+ signals that ChatGPT, Perplexity and Google AI look at." },
              { icon: Sparkles, title: "2. You get 5 AI queries", desc: "Tailored queries your customers would ask an AI — based directly on your industry." },
              { icon: TrendingUp, title: "3. Test & improve", desc: "Click and test each query in Perplexity, ChatGPT and Google AI. See immediately whether you're mentioned." },
            ].map((s) => (
              <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-violet-50 text-violet-600">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!result && (
        <section className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                40% of searches go through AI by 2026
              </h2>
              <p className="mt-4 text-base text-slate-600">
                Classic SEO is no longer enough. ChatGPT, Perplexity, Claude and Google AI Overviews
                choose which companies get mentioned — without sending clicks back to your site.
                If your website isn&apos;t optimised for{" "}
                <strong className="text-slate-900">Generative Engine Optimization (GEO)</strong>{" "}
                you&apos;re already missing business you don&apos;t even know about.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Schema.org markup that AI engines actually read",
                  "Content structured for citations",
                  "Competitor analysis — who gets mentioned when your customers ask?",
                  "Weekly tracking of your AI visibility",
                ].map((it) => (
                  <li key={it} className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Bot className="h-3.5 w-3.5" /> Example: how does AI see you?
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { q: "What's the best CRM for small businesses?", you: false },
                  { q: "Best accounting firm in London 2026", you: true },
                  { q: "Which marketing tool should I choose?", you: false },
                ].map((row, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                    <div className="text-slate-700">&ldquo;{row.q}&rdquo;</div>
                    <div className={`mt-1 text-xs ${row.you ? "text-green-600" : "text-red-500"}`}>
                      {row.you ? "✓ Your business was mentioned" : "✗ A competitor was mentioned instead"}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                The tool shows your real ranking per query — nothing faked.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Want to rank in AI every week — without thinking about it?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300">
            Sama tracks your AI visibility, monitors competitors, and suggests exact
            content changes to lift your ranking — on autopilot.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/c/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100"
            >
              Start 14-day free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/c/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-3 text-base font-semibold text-white hover:bg-slate-800"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">No commitments · Cancel anytime</p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
