"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles, ArrowRight, CheckCircle, AlertTriangle, XCircle,
  Copy, ExternalLink, Bot, Shield, Zap, Share2, Linkedin, Twitter, Link2,
  Swords, Mail, Loader2, Globe, Activity, FileText, Link as LinkIcon, Gauge as GaugeIcon, Search,
} from "lucide-react";
import type { SiteAuditRun, SiteAuditFinding } from "@/app/c/analysis/audit-types";

export interface AuditResult {
  id?: string;
  domain: string;
  fetched_at: string;
  audit: SiteAuditRun;
  suggested_queries: string[];
}

const TEST_TARGETS = [
  { id: "perplexity", label: "Perplexity", url: (q: string) => `https://www.perplexity.ai/?q=${encodeURIComponent(q)}` },
  { id: "chatgpt", label: "ChatGPT", url: (q: string) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { id: "google", label: "Google AI", url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=50` },
];

const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  on_page: "On-page",
  geo: "GEO / AI",
  links: "Links",
  performance: "Performance",
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 0, warning: 1, info: 2, success: 3,
};

export default function PublicAuditResult({
  result: initialResult,
  hideUpsells = false,
}: {
  result: AuditResult;
  /**
   * When true, hides prospect-facing CTAs (email capture, competitor audit,
   * "want the full report" sidebar). Used by the admin/TM view where we're
   * looking at a lead's audit, not pitching the product to a visitor.
   */
  hideUpsells?: boolean;
}) {
  const [result, setResult] = useState<AuditResult>(initialResult);
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

  const audit = result.audit;
  const overall = audit.scores.overall;
  const grade = useMemo(() => {
    if (overall >= 80) return { label: "Strong", color: "text-green-600", ring: "#22c55e" };
    if (overall >= 60) return { label: "OK – room to improve", color: "text-amber-600", ring: "#eab308" };
    if (overall >= 40) return { label: "Weak", color: "text-orange-600", ring: "#f97316" };
    return { label: "Critical – lots to gain", color: "text-red-600", ring: "#ef4444" };
  }, [overall]);

  const findingsSorted = useMemo(
    () => [...audit.findings].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)),
    [audit.findings],
  );
  const critical = findingsSorted.filter((f) => f.severity === "critical");
  const warning = findingsSorted.filter((f) => f.severity === "warning");
  const success = findingsSorted.filter((f) => f.severity === "success");
  const info = findingsSorted.filter((f) => f.severity === "info");

  return (
    <div className="space-y-8">
      {/* Score banner */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
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
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Audit for</p>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{result.domain}</h2>
              <p className={`mt-1 text-sm font-semibold ${grade.color}`}>{grade.label}</p>
              <p className="mt-1 text-xs text-slate-400">
                {audit.summary.pages_analyzed} pages analysed · {(audit.summary.audit_duration_ms / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          {/* Site-wide flags */}
          <div className="flex flex-wrap gap-2">
            <Flag ok={audit.summary.https} label="HTTPS" />
            <Flag ok={audit.summary.has_robots_txt} label="robots.txt" />
            <Flag ok={audit.summary.has_sitemap_xml} label="sitemap.xml" />
            <Flag ok={audit.summary.has_llms_txt} label="llms.txt" />
          </div>
        </div>

        {/* 5 score cards — same as admin tool */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ScoreCard label="Technical" score={audit.scores.technical_seo} icon={Shield} color="text-blue-600" bg="bg-blue-50" />
          <ScoreCard label="On-page" score={audit.scores.on_page_seo} icon={FileText} color="text-violet-600" bg="bg-violet-50" />
          <ScoreCard label="GEO / AI" score={audit.scores.geo_readiness} icon={Bot} color="text-fuchsia-600" bg="bg-fuchsia-50" />
          <ScoreCard label="Link health" score={audit.scores.link_health} icon={LinkIcon} color="text-emerald-600" bg="bg-emerald-50" />
          <ScoreCard label="Performance" score={audit.scores.performance} icon={Activity} color="text-orange-600" bg="bg-orange-50" />
        </div>

        {/* Share row */}
        {result.id && !hideUpsells && <ShareRow id={result.id} domain={result.domain} score={overall} copy={copy} copied={copied} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Findings + page list */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">What we found</h3>

          {critical.length > 0 && (
            <FindingsGroup
              title="Critical issues"
              icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
              findings={critical}
              tone="red"
            />
          )}
          {warning.length > 0 && (
            <FindingsGroup
              title="Room to improve"
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              findings={warning}
              tone="amber"
            />
          )}
          {info.length > 0 && (
            <FindingsGroup
              title="Good to know"
              icon={<AlertTriangle className="h-4 w-4 text-slate-400" />}
              findings={info}
              tone="slate"
            />
          )}
          {success.length > 0 && (
            <FindingsGroup
              title="What you're doing well"
              icon={<CheckCircle className="h-4 w-4 text-green-500" />}
              findings={success}
              tone="green"
            />
          )}

          {/* Top recommendations from backend */}
          {audit.recommendations.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <GaugeIcon className="h-4 w-4 text-violet-500" />
                <h4 className="text-sm font-semibold text-slate-700">Priority actions</h4>
              </div>
              <ul className="space-y-2">
                {audit.recommendations.slice(0, 5).map((r, i) => (
                  <li key={i} className="rounded-md border-l-4 border-l-violet-300 bg-violet-50/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        r.priority === "high" ? "bg-red-100 text-red-700" :
                        r.priority === "medium" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>{r.priority}</span>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                        {CATEGORY_LABEL[r.category] || r.category}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-900">{r.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{r.description}</p>
                    {r.affected_count > 0 && (
                      <p className="mt-1 text-[11px] text-slate-400">Affects {r.affected_count} pages</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Per-page summary */}
          {audit.pages.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h4 className="mb-3 text-sm font-semibold text-slate-700">
                Crawlade sidor ({audit.pages.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">URL</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Ord</th>
                      <th className="py-2 pr-3 font-medium">Schema</th>
                      <th className="py-2 font-medium">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.pages.slice(0, 10).map((p) => (
                      <tr key={p.url} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 pr-3 max-w-[260px] truncate" title={p.url}>
                          {new URL(p.url).pathname || "/"}
                        </td>
                        <td className={`py-2 pr-3 ${p.status_code >= 400 ? "text-red-600" : "text-slate-600"}`}>
                          {p.status_code}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{p.word_count}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {p.has_schema ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-slate-300" />}
                        </td>
                        <td className="py-2 text-slate-600">{p.issues.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Broken links */}
          {audit.broken_links.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h4 className="mb-3 text-sm font-semibold text-slate-700">
                Broken links ({audit.broken_links.length})
              </h4>
              <ul className="space-y-1.5 text-xs">
                {audit.broken_links.slice(0, 8).map((l) => (
                  <li key={l.url} className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2">
                    <span className="truncate text-red-700" title={l.url}>{l.url}</span>
                    <span className="font-mono text-red-600">{l.status_code}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* AI search queries */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              <h3 className="text-lg font-semibold text-slate-900">5 AI queries to test</h3>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Click and see immediately whether {result.domain} is mentioned when your customers ask AI.
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
                    {copied === `q-${idx}` ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!hideUpsells && (
            <div className="rounded-xl border-2 border-dashed border-violet-300 bg-white p-5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-600" />
                <h4 className="text-sm font-bold text-slate-900">Want to know exactly where you rank?</h4>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                We run automated tests against ChatGPT, Perplexity, Claude and Google AI every week
                — and tell you exactly what to fix to be visible.
              </p>
              <Link
                href="/c/onboarding"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Get the full report free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {!hideUpsells && (
        <>
          <EmailCapture domain={result.domain} auditId={result.id} />
          <CompetitorAudit currentDomain={result.domain} onResult={setResult} />
        </>
      )}
    </div>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
      ok ? "bg-green-50 text-green-700 border border-green-200"
         : "bg-slate-100 text-slate-500 border border-slate-200"
    }`}>
      {ok ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function ScoreCard({
  label, score, icon: Icon, color, bg,
}: {
  label: string; score: number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <div className={`grid h-7 w-7 place-items-center rounded-md ${bg}`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold text-slate-900">
        {score}<span className="text-xs font-normal text-slate-400"> / 100</span>
      </p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color.replace("text-", "bg-")}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function FindingsGroup({
  title, icon, findings, tone,
}: {
  title: string;
  icon: React.ReactNode;
  findings: SiteAuditFinding[];
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
        {findings.map((f, i) => (
          <li key={i} className={`rounded-md border-l-4 ${border} bg-slate-50/50 p-3`}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                {CATEGORY_LABEL[f.category] || f.category}
              </span>
              {f.affected_pages > 0 && (
                <span className="text-[10px] text-slate-400">· {f.affected_pages} sidor</span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-900">{f.title}</p>
            <p className="mt-0.5 text-xs text-slate-600">{f.description}</p>
          </li>
        ))}
      </ul>
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
    ? `${window.location.origin}/c/audit/r/${id}`
    : `/c/audit/r/${id}`;
  const text = `${domain} scored ${score}/100 in AI visibility. Run your own free audit:`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Share2 className="h-4 w-4 text-violet-600" />
        <span className="font-medium text-slate-700">Share your result</span>
        <span className="hidden text-xs text-slate-400 sm:inline">— or send it to the colleague who owns the site</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => copy(url, "share-url")}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Link2 className="h-3.5 w-3.5" />
          {copied === "share-url" ? "Link copied" : "Copy link"}
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

function EmailCapture({ domain, auditId }: { domain: string; auditId?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || state === "loading") return;
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/public-audit/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), domain, audit_id: auditId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.error || "Could not save. Please try again.");
        setState("error");
        return;
      }
      setState("ok");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  };

  if (state === "ok") {
    return (
      <div className="rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-white p-6 text-center sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-100 text-green-600">
          <CheckCircle className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-xl font-bold text-slate-900">You're on the list</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
          We'll email you a full 20-page report and update you every week as your
          AI visibility changes. Check your inbox in a minute or so.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
            <Mail className="h-3.5 w-3.5" />
            Weekly AI monitoring
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
            Get a 20-page PDF + weekly monitoring
          </h3>
          <p className="mt-3 text-sm text-slate-600">
            Enter your email and we'll send a deep-dive report with concrete actions, monitor
            {" "}{domain} against ChatGPT/Perplexity/Google AI every week, and alert you when something changes.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Detailed PDF (page by page)</li>
            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Weekly email with ranking changes</li>
            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Unsubscribe at any time</li>
          </ul>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Your work email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              disabled={state === "loading"}
              autoComplete="email"
            />
          </label>
          <button
            type="submit"
            disabled={state === "loading" || !email.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
          >
            {state === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                Send me the report
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          {state === "error" && (
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {errorMsg}
            </p>
          )}
          <p className="text-xs text-slate-400">
            By submitting you agree to our{" "}
            <Link href="/c/legal/privacy" className="underline hover:text-slate-600">privacy policy</Link>.
            No spam.
          </p>
        </form>
      </div>
    </div>
  );
}

function CompetitorAudit({
  currentDomain,
  onResult,
}: {
  currentDomain: string;
  onResult: (r: AuditResult) => void;
}) {
  const [domain, setDomain] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = domain.trim();
    if (!value || state === "loading") return;
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/public-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || "Could not analyse that domain.");
        setState("error");
        return;
      }
      onResult(data);
      setDomain("");
      setState("idle");
      setTimeout(() => {
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-[auto,1fr] sm:items-center">
        <div className="grid h-14 w-14 place-items-center rounded-xl bg-orange-50 text-orange-600">
          <Swords className="h-7 w-7" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 sm:text-2xl">
            How do competitors compare?
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Run the same audit on a competitor and compare directly against {currentDomain}.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="konkurrent.se"
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-3 text-base shadow-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            disabled={state === "loading"}
            autoComplete="url"
            inputMode="url"
          />
        </div>
        <button
          type="submit"
          disabled={state === "loading" || !domain.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
        >
          {state === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyserar… (10–60s)
            </>
          ) : (
            <>
              Audita konkurrent
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {state === "error" && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {errorMsg}
        </p>
      )}
    </div>
  );
}

export { Search, XCircle };
