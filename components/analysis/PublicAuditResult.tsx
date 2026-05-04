"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, Sparkles, ArrowRight, CheckCircle, AlertTriangle, XCircle,
  Copy, ExternalLink, Bot, Shield, Zap, Share2, Linkedin, Twitter, Link2,
} from "lucide-react";

export interface AuditFinding {
  id: string;
  severity: "high" | "medium" | "low" | "good";
  title: string;
  detail: string;
}

export interface PageSignals {
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

export interface AuditResult {
  id?: string;
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

export default function PublicAuditResult({ result }: { result: AuditResult }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

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

        {/* Share row */}
        {result.id && <ShareRow id={result.id} domain={result.domain} score={overall} copy={copy} copied={copied} />}
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

function ShareRow({
  id, domain, score, copy, copied,
}: {
  id: string; domain: string; score: number;
  copy: (text: string, key: string) => void;
  copied: string | null;
}) {
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/audit/r/${id}`
    : `/audit/r/${id}`;
  const text = `${domain} fick ${score}/100 i AI-synlighet. Kör din egen gratis audit:`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Share2 className="h-4 w-4 text-violet-600" />
        <span className="font-medium text-slate-700">Dela ditt resultat</span>
        <span className="hidden text-xs text-slate-400 sm:inline">— eller skicka till kollegan som äger sajten</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => copy(url, "share-url")}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Link2 className="h-3.5 w-3.5" />
          {copied === "share-url" ? "Länk kopierad" : "Kopiera länk"}
        </button>
        <a
          href={li}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0A66C2] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#004182]"
        >
          <Linkedin className="h-3.5 w-3.5" /> LinkedIn
        </a>
        <a
          href={tw}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
        >
          <Twitter className="h-3.5 w-3.5" /> X
        </a>
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

export { XCircle };
