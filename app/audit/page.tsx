"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, Sparkles, ArrowRight, CheckCircle, AlertTriangle, XCircle,
  Copy, ExternalLink, Loader2, Globe, TrendingUp, Bot, Shield, Zap,
} from "lucide-react";

interface AuditFinding {
  id: string;
  severity: "high" | "medium" | "low" | "good";
  title: string;
  detail: string;
}

interface PageSignals {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1: string | null;
  h1Count: number;
  h2Count: number;
  wordCount: number;
  hasViewport: boolean;
  hasLang: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  hasCanonical: boolean;
  schemaTypes: string[];
  imageCount: number;
  imagesMissingAlt: number;
}

interface AuditResult {
  domain: string;
  final_url: string;
  fetched_at: string;
  scores: { overall: number; seo: number; geo: number; technical: number };
  signals: PageSignals;
  findings: AuditFinding[];
  suggested_queries: string[];
}

const TEST_TARGETS = [
  { id: "perplexity", label: "Perplexity", url: (q: string) => `https://www.perplexity.ai/?q=${encodeURIComponent(q)}` },
  { id: "chatgpt", label: "ChatGPT", url: (q: string) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { id: "google", label: "Google AI", url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=50` },
];

export default function AuditLandingPage() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top nav */}
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

      {/* Hero */}
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

          {/* Form */}
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

          {/* Trust row */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Crawlar din startsida live</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Analyserar SEO + GEO</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Färdiga AI-fraser att testa</span>
          </div>
        </div>
      </section>

      {/* Results */}
      {result && (
        <section id="results" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <ResultBlock result={result} copy={copy} copied={copied} />
        </section>
      )}

      {/* How it works (only when no result) */}
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

      {/* Why AI search section */}
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

      {/* CTA */}
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

function ResultBlock({
  result,
  copy,
  copied,
}: {
  result: AuditResult;
  copy: (text: string, id: string) => void;
  copied: string | null;
}) {
  const overall = result.scores.overall;
  const grade = useMemo(() => {
    if (overall >= 80) return { label: "Stark", color: "text-green-600", ring: "#22c55e" };
    if (overall >= 60) return { label: "OK – men kan förbättras", color: "text-amber-600", ring: "#eab308" };
    if (overall >= 40) return { label: "Svag", color: "text-orange-600", ring: "#f97316" };
    return { label: "Kritisk – mycket att vinna", color: "text-red-600", ring: "#ef4444" };
  }, [overall]);

  const high = result.findings.filter((f) => f.severity === "high");
  const medium = result.findings.filter((f) => f.severity === "medium");
  const low = result.findings.filter((f) => f.severity === "low");
  const good = result.findings.filter((f) => f.severity === "good");

  return (
    <div className="space-y-8">
      {/* Score banner */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="#e5e7eb" strokeWidth="3"
                />
                <path
                  d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke={grade.ring} strokeWidth="3"
                  strokeDasharray={`${overall}, 100`} strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-900">{overall}</span>
                <span className="text-[10px] font-medium uppercase text-slate-400">/ 100</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Audit för</p>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{result.domain}</h2>
              <p className={`mt-1 text-sm font-semibold ${grade.color}`}>{grade.label}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ScoreCard label="SEO" score={result.scores.seo} max={40} icon={Search} color="text-blue-600" bg="bg-blue-50" />
            <ScoreCard label="GEO / AI" score={result.scores.geo} max={40} icon={Bot} color="text-violet-600" bg="bg-violet-50" />
            <ScoreCard label="Tekniskt" score={result.scores.technical} max={20} icon={Shield} color="text-slate-700" bg="bg-slate-100" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Findings */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Vad vi hittade</h3>

          {high.length > 0 && (
            <FindingsGroup
              title="Kritiska problem"
              icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
              findings={high}
              tone="red"
            />
          )}
          {medium.length > 0 && (
            <FindingsGroup
              title="Förbättringsmöjligheter"
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              findings={medium}
              tone="amber"
            />
          )}
          {low.length > 0 && (
            <FindingsGroup
              title="Nice to have"
              icon={<AlertTriangle className="h-4 w-4 text-slate-400" />}
              findings={low}
              tone="slate"
            />
          )}
          {good.length > 0 && (
            <FindingsGroup
              title="Det här gör du bra"
              icon={<CheckCircle className="h-4 w-4 text-green-500" />}
              findings={good}
              tone="green"
            />
          )}

          {/* Page signals */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h4 className="mb-3 text-sm font-semibold text-slate-700">Tekniska signaler</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <SignalRow label="Title" value={result.signals.title || "—"} />
              <SignalRow label="Meta desc." value={result.signals.metaDescription || "—"} />
              <SignalRow label="H1" value={result.signals.h1 || "—"} />
              <SignalRow label="Antal ord" value={result.signals.wordCount.toString()} />
              <SignalRow label="Schema-typer" value={result.signals.schemaTypes.length ? result.signals.schemaTypes.join(", ") : "Inga"} />
              <SignalRow label="Open Graph" value={result.signals.hasOpenGraph ? "Ja" : "Nej"} />
              <SignalRow label="Bilder utan alt" value={`${result.signals.imagesMissingAlt} av ${result.signals.imageCount}`} />
              <SignalRow label="Canonical" value={result.signals.hasCanonical ? "Ja" : "Nej"} />
            </dl>
          </div>
        </div>

        {/* AI search queries */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              <h3 className="text-lg font-semibold text-slate-900">5 AI-fraser att testa</h3>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Klicka och se direkt om {result.domain} nämns när dina kunder frågar AI.
            </p>
          </div>

          <div className="space-y-3">
            {result.suggested_queries.map((q, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                    {idx + 1}
                  </span>
                  <p className="flex-1 text-sm text-slate-800">{q}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {TEST_TARGETS.map((t) => (
                    <a
                      key={t.id}
                      href={t.url(q)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      {t.label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                  <button
                    onClick={() => copy(q, `q-${idx}`)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === `q-${idx}` ? "Kopierat" : "Kopiera"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Upsell card */}
          <div className="rounded-xl border-2 border-dashed border-violet-300 bg-white p-5">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-600" />
              <h4 className="text-sm font-bold text-slate-900">Vill du veta exakt var du rankar?</h4>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Vi kör automatiserade tester mot ChatGPT, Perplexity, Claude och Google AI varje vecka
              — och berättar exakt vad du behöver fixa för att synas.
            </p>
            <Link
              href="/c/onboarding"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Få full rapport gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  label, score, max, icon: Icon, color, bg,
}: {
  label: string; score: number; max: number; icon: React.ElementType; color: string; bg: string;
}) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <div className={`grid h-7 w-7 place-items-center rounded-md ${bg}`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold text-slate-900">
        {score}<span className="text-xs font-normal text-slate-400"> / {max}</span>
      </p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FindingsGroup({
  title, icon, findings, tone,
}: {
  title: string;
  icon: React.ReactNode;
  findings: AuditFinding[];
  tone: "red" | "amber" | "slate" | "green";
}) {
  const border = {
    red: "border-l-red-400",
    amber: "border-l-amber-400",
    slate: "border-l-slate-300",
    green: "border-l-green-400",
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-slate-700">
          {title} <span className="text-slate-400">({findings.length})</span>
        </h4>
      </div>
      <ul className="space-y-2">
        {findings.map((f) => (
          <li key={f.id} className={`rounded-md border-l-4 ${border} bg-slate-50/50 p-3`}>
            <p className="text-sm font-medium text-slate-900">{f.title}</p>
            <p className="mt-0.5 text-xs text-slate-600">{f.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="truncate text-slate-700" title={value}>{value}</dd>
    </>
  );
}
