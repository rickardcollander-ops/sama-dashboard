/**
 * PDF render target for the Apollo telemarketing flow.
 *
 * This page is opened by sama-agent's Playwright service (via /api/admin/
 * campaigns/leads/[id]/pdf) — Playwright loads it, waits for `networkidle`,
 * and prints it to PDF. It's gated by an HMAC token so the URL doesn't
 * permanently expose customer data.
 *
 * Layout-wise, it's tuned for A4 print: a brand header on page 1, the
 * five-category gauge row, the top issues / quick wins, and 5 AI search
 * queries on page 2. Tailwind only — no JS-driven charts so the printed
 * version always matches what the browser shows.
 */

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyPdfToken } from "@/lib/apollo";
import { loadPublicAudit } from "@/lib/public-audit-store";
import type { SiteAuditFinding, SiteAuditRecommendation } from "@/app/c/analysis/audit-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LeadRow {
  id: string;
  company_name: string;
  domain: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  audit_id: string | null;
  audited_at: string | null;
}

type Params = Promise<{ leadId: string }>;
type Search = Promise<{ t?: string }>;

export default async function PdfReportPage({
  params, searchParams,
}: { params: Params; searchParams: Search }) {
  const { leadId } = await params;
  const { t: token } = await searchParams;

  const valid = token ? await verifyPdfToken(leadId, token) : false;
  if (!valid) notFound();

  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const { data: lead } = await admin
    .from("apollo_leads")
    .select("id, company_name, domain, contact_first_name, contact_last_name, contact_title, contact_email, industry, city, country, audit_id, audited_at")
    .eq("id", leadId)
    .maybeSingle<LeadRow>();
  if (!lead || !lead.audit_id) notFound();

  const result = await loadPublicAudit(lead.audit_id);
  if (!result) notFound();

  const scores = result.audit.scores;
  const summary = result.audit.summary;

  // Top 3 critical/high-impact findings — what the customer should care about most.
  const topIssues = [...(result.audit.findings || [])]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 5);

  // Quick wins from the recommendations bucket — easy + impactful.
  const quickWins = (result.audit.recommendation_groups?.quick_win
    ?? (result.audit.recommendations || []).filter((r) => r.priority !== "low"))
    .slice(0, 4);

  const generatedAt = new Date().toLocaleDateString("sv-SE");
  const contact = [lead.contact_first_name, lead.contact_last_name].filter(Boolean).join(" ");

  return (
    <html lang="sv">
      <head>
        <title>{`${lead.company_name} — Sajthälsoanalys`}</title>
        <meta charSet="utf-8" />
        <style>{`
          @page { size: A4; margin: 16mm 14mm; }
          @media print {
            html, body { background: #fff !important; }
            .page-break { page-break-before: always; }
          }
          body {
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            color: #0f172a;
          }
        `}</style>
      </head>
      <body className="bg-white">
        <div className="mx-auto max-w-[200mm] px-0 py-0">
          {/* ── Header ───────────────────────────────────────────── */}
          <header className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center gap-2 text-violet-600 font-semibold text-sm">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-violet-500 to-blue-600 text-white text-xs">S</span>
                Sama AI-audit
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900 leading-tight">{lead.company_name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Sajthälsa & AI-sökbarhet · {lead.domain ?? "—"}
              </p>
              {(lead.industry || lead.city) && (
                <p className="text-xs text-slate-400">
                  {lead.industry}
                  {lead.industry && lead.city ? " · " : ""}
                  {lead.city}{lead.country ? `, ${lead.country}` : ""}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>Genererad {generatedAt}</div>
              {contact && <div className="mt-2 text-slate-500">Till: {contact}</div>}
              {lead.contact_title && <div className="text-slate-400">{lead.contact_title}</div>}
            </div>
          </header>

          {/* ── Overall score hero ───────────────────────────────── */}
          <section className="mt-6 grid grid-cols-[auto_1fr] gap-6 rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 p-6 border border-violet-100">
            <ScoreGauge score={scores.overall} size="lg" />
            <div>
              <p className="text-xs uppercase tracking-wider text-violet-600 font-semibold">Sammanfattande sajthälsa</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                {scoreVerdict(scores.overall)}
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Vi analyserade <strong>{summary.pages_analyzed}</strong> sidor på {lead.domain}.
                {" "}Resultatet sammanfattar {lead.company_name}s nuvarande synlighet i klassisk sökmotor-SEO
                och i AI-baserad sökning (ChatGPT, Perplexity, Google AI Overviews).
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <Pill ok={summary.https} label="HTTPS" />
                <Pill ok={summary.has_robots_txt} label="robots.txt" />
                <Pill ok={summary.has_sitemap_xml} label="sitemap.xml" />
                <Pill ok={summary.has_llms_txt} label="llms.txt" />
                <Pill ok={summary.broken_links_count === 0} label={`${summary.broken_links_count} brutna länkar`} invert />
              </div>
            </div>
          </section>

          {/* ── Category scores ──────────────────────────────────── */}
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Resultat per kategori</h3>
            <div className="mt-3 grid grid-cols-5 gap-3">
              <CategoryCard label="Teknisk SEO"   score={scores.technical_seo}  />
              <CategoryCard label="On-page SEO"   score={scores.on_page_seo}    />
              <CategoryCard label="GEO / AI"      score={scores.geo_readiness}  highlight />
              <CategoryCard label="Länkhälsa"     score={scores.link_health}    />
              <CategoryCard label="Prestanda"     score={scores.performance}    />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              GEO (Generative Engine Optimization) mäter hur citerbar sajten är för AI-assistenter — schema, struktur, llms.txt, headings.
            </p>
          </section>

          {/* ── Top issues ───────────────────────────────────────── */}
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Viktigaste fynden</h3>
            <ul className="mt-3 space-y-2">
              {topIssues.length === 0 && (
                <li className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  Inga större brister hittades. Bra utgångsläge för fortsatt optimering.
                </li>
              )}
              {topIssues.map((f, i) => (
                <FindingRow key={i} finding={f} />
              ))}
            </ul>
          </section>

          {/* ── Page break ───────────────────────────────────────── */}
          <div className="page-break" />

          {/* ── Quick wins ───────────────────────────────────────── */}
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Snabba vinster</h3>
            <p className="mt-1 text-xs text-slate-500">
              Lågt motstånd, mätbar effekt. Det här är det vi rekommenderar att börja med.
            </p>
            <ul className="mt-3 space-y-2">
              {quickWins.length === 0 && (
                <li className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  Sajten har redan grunderna på plats — fokusera på strategiska initiativ.
                </li>
              )}
              {quickWins.map((r, i) => (
                <RecommendationRow key={i} rec={r} />
              ))}
            </ul>
          </section>

          {/* ── AI search queries ────────────────────────────────── */}
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Test din synlighet i AI just nu
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Skriv in dessa frågor i ChatGPT, Perplexity eller Google AI Overviews — ser du
              {" "}<strong>{lead.company_name}</strong> i svaret? Om inte ser konkurrenterna gör det.
            </p>
            <ol className="mt-3 space-y-2">
              {(result.suggested_queries || []).slice(0, 5).map((q, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700">{q}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* ── CTA / Footer ─────────────────────────────────────── */}
          <section className="mt-6 rounded-2xl bg-slate-900 p-6 text-white">
            <h3 className="text-lg font-bold">Vill du ranka i AI varje vecka — utan att tänka på det?</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Sama bevakar din AI-synlighet, övervakar konkurrenterna och föreslår exakta
              innehållsändringar för att lyfta din placering — automatiskt.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-white/10 px-3 py-1.5">14 dagar gratis</span>
              <span className="rounded-md bg-white/10 px-3 py-1.5">Ingen bindningstid</span>
              <span className="rounded-md bg-white/10 px-3 py-1.5">Cancel anytime</span>
            </div>
          </section>

          <footer className="mt-6 border-t border-slate-200 pt-3 text-[10px] text-slate-400 flex justify-between">
            <span>Sama AI-audit · successifier.com</span>
            <span>Rapport-ID: {lead.audit_id}</span>
          </footer>
        </div>
      </body>
    </html>
  );
}

// ── Building blocks ─────────────────────────────────────────────────────────

function severityRank(s: SiteAuditFinding["severity"]): number {
  switch (s) {
    case "critical": return 0;
    case "warning": return 1;
    case "info": return 2;
    case "success": return 3;
  }
}

function scoreColor(score: number): { bg: string; ring: string; text: string } {
  if (score >= 80) return { bg: "bg-emerald-100",  ring: "stroke-emerald-500", text: "text-emerald-700" };
  if (score >= 50) return { bg: "bg-amber-100",    ring: "stroke-amber-500",   text: "text-amber-700"   };
  return                   { bg: "bg-rose-100",     ring: "stroke-rose-500",    text: "text-rose-700"    };
}

function scoreVerdict(score: number): string {
  if (score >= 85) return "Stark grund — fokusera på AI-synlighet";
  if (score >= 70) return "Solid utgångsläge med tydliga förbättringspunkter";
  if (score >= 50) return "Flera viktiga fynd att åtgärda";
  return "Akuta brister — börja med det grundläggande";
}

function ScoreGauge({ score, size = "md" }: { score: number; size?: "md" | "lg" }) {
  const colors = scoreColor(score);
  const dim = size === "lg" ? 120 : 72;
  const r = size === "lg" ? 50 : 30;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(score, 100)) / 100) * circ;

  return (
    <div
      className={`relative grid place-items-center rounded-full ${colors.bg}`}
      style={{ width: dim, height: dim }}
    >
      <svg width={dim} height={dim} className="absolute inset-0 -rotate-90">
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" strokeWidth={size === "lg" ? 8 : 6} className="stroke-white/70" />
        <circle
          cx={dim / 2} cy={dim / 2} r={r}
          fill="none"
          strokeWidth={size === "lg" ? 8 : 6}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={colors.ring}
        />
      </svg>
      <div className={`relative ${size === "lg" ? "text-3xl" : "text-lg"} font-bold ${colors.text} tabular-nums`}>
        {score}
      </div>
    </div>
  );
}

function CategoryCard({ label, score, highlight }: { label: string; score: number; highlight?: boolean }) {
  const colors = scoreColor(score);
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-violet-200 bg-violet-50/40" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        {highlight && <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">AI</span>}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${colors.text}`}>{score}</div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

function Pill({ ok, label, invert }: { ok: boolean; label: string; invert?: boolean }) {
  const good = invert ? !ok : ok;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
        good ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
      }`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${good ? "bg-emerald-500" : "bg-rose-500"}`} />
      {label}
    </span>
  );
}

function FindingRow({ finding }: { finding: SiteAuditFinding }) {
  const tone =
    finding.severity === "critical" ? "border-rose-200 bg-rose-50" :
    finding.severity === "warning"  ? "border-amber-200 bg-amber-50" :
                                      "border-slate-200 bg-slate-50";
  const dot =
    finding.severity === "critical" ? "bg-rose-500" :
    finding.severity === "warning"  ? "bg-amber-500" :
                                      "bg-slate-400";
  return (
    <li className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-slate-900 text-sm">{finding.title}</span>
            {finding.affected_pages > 0 && (
              <span className="text-[10px] font-medium text-slate-500">
                {finding.affected_pages} {finding.affected_pages === 1 ? "sida" : "sidor"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{finding.description}</p>
        </div>
      </div>
    </li>
  );
}

function RecommendationRow({ rec }: { rec: SiteAuditRecommendation }) {
  return (
    <li className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-slate-900 text-sm">{rec.title}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-700">
              {rec.priority}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{rec.description}</p>
        </div>
      </div>
    </li>
  );
}
