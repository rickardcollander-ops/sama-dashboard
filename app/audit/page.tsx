"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search, Sparkles, ArrowRight, CheckCircle, XCircle,
  Loader2, Globe, TrendingUp, Bot,
} from "lucide-react";
import PublicAuditResult, { type AuditResult } from "@/components/analysis/PublicAuditResult";

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
        setError(data?.error || "Något gick fel. Försök igen.");
      } else {
        setResult(data);
        setTimeout(() => {
          document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
        }, 80);
      }
    } catch {
      setError("Kunde inte nå servern. Kontrollera din uppkoppling.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/audit" className="flex items-center gap-2 text-base font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>Sama AI-audit</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/c/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Logga in
            </Link>
            <Link
              href="/c/onboarding"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 sm:px-4 sm:py-2"
            >
              Kom igång
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-violet-50/60 via-white to-white" />
        <div className="mx-auto max-w-4xl px-4 pt-12 pb-10 text-center sm:px-6 sm:pt-20 sm:pb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            <Bot className="h-3.5 w-3.5" />
            Hur syns ditt företag i ChatGPT, Perplexity & Google AI?
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Är din hemsida redo för{" "}
            <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              AI-sök?
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
            Få en gratis analys av din hemsida på 30 sekunder och 5 färdiga AI-sökfraser
            du kan testa direkt — så du ser exakt hur du syns när kunder frågar AI.
          </p>

          <form onSubmit={onSubmit} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="dittforetag.se"
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
                  Analyserar…
                </>
              ) : (
                <>
                  Kör gratis audit
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-400">
            Gratis · Inget kort · Inget konto · Tar ca 10–30 sekunder
          </p>

          {error && (
            <div className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Crawlar din startsida live</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Analyserar SEO + GEO</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Färdiga AI-fraser att testa</span>
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
            Tre steg från osynlig till citerad av AI
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Search, title: "1. Vi skannar din sida", desc: "Vi hämtar din startsida och analyserar 15+ signaler som ChatGPT, Perplexity och Google AI tittar på." },
              { icon: Sparkles, title: "2. Du får 5 AI-fraser", desc: "Skräddarsydda sökfraser som dina kunder skulle ställa till en AI — direkt baserade på din bransch." },
              { icon: TrendingUp, title: "3. Testa & förbättra", desc: "Klicka och testa varje fras i Perplexity, ChatGPT och Google AI. Se direkt om du nämns." },
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
                40 % av sökningar går genom AI redan 2026
              </h2>
              <p className="mt-4 text-base text-slate-600">
                Klassisk SEO räcker inte längre. ChatGPT, Perplexity, Claude och Google AI Overviews
                väljer vilka företag som nämns — utan att skicka klickar tillbaka till din sajt.
                Om din hemsida inte är optimerad för{" "}
                <strong className="text-slate-900">Generative Engine Optimization (GEO)</strong>{" "}
                missar du redan idag affärer du inte ens vet om.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Schema.org-markup som AI-motorer faktiskt läser",
                  "Innehåll strukturerat för citeringar",
                  "Konkurrentanalys — vem nämns när dina kunder frågar?",
                  "Veckovis spårning av din AI-synlighet",
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
                <Bot className="h-3.5 w-3.5" /> Exempel: hur ser AI dig?
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { q: "Vad är bästa CRM:et för småföretag i Sverige?", you: false },
                  { q: "Bästa redovisningsbyrå i Stockholm 2026", you: true },
                  { q: "Vilket marknadsföringsverktyg bör jag välja?", you: false },
                ].map((row, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                    <div className="text-slate-700">&ldquo;{row.q}&rdquo;</div>
                    <div className={`mt-1 text-xs ${row.you ? "text-green-600" : "text-red-500"}`}>
                      {row.you ? "✓ Ditt företag nämndes" : "✗ Konkurrent nämndes istället"}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Verktyget visar din riktiga rankning per fras — inget fake.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Vill du ranka i AI varje vecka — utan att tänka på det?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300">
            Sama spårar din AI-synlighet, övervakar konkurrenter, och föreslår exakta
            innehållsförändringar för att höja din ranking — på autopilot.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/c/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100"
            >
              Starta 14 dagar gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/c/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-3 text-base font-semibold text-white hover:bg-slate-800"
            >
              Se priser
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">Inga bindningstider · Avsluta när du vill</p>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:px-6">
          <span>&copy; {new Date().getFullYear()} Sama AI</span>
          <div className="flex gap-4">
            <Link href="/c/legal/privacy" className="hover:text-slate-600">Integritet</Link>
            <Link href="/c/legal/terms" className="hover:text-slate-600">Villkor</Link>
            <Link href="/c/legal/dpa" className="hover:text-slate-600">DPA</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
