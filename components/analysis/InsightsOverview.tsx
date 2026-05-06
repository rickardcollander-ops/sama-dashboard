"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, AlertCircle, Sparkles, Loader2, Info,
} from "lucide-react";
import { tenantApi } from "@/lib/api";
import StatScoreboard, { type ScoreboardStat } from "@/components/StatScoreboard";
import TrendBadge from "@/components/dashboard/TrendBadge";

// Sprint 3 (I1) — Insikter-översikt.
//
// Standalone overview component that renders at the top of /c/analysis. Pulls
// GEO + SEO snapshots and synthesises a combined visibility score, top
// strengths and top gaps. Each gap card links into Content with a draft
// suggestion so the loop Insikter -> Content stays one click.
//
// Combined visibility score (0-100), v1:
//   geoComponent  = mention_rate * 100              (0-100)
//   seoComponent  = clamp(101 - avg_position, 0, 100)
//   visibility    = geoComponent * 0.5 + seoComponent * 0.5

interface GeoSummary {
  mention_rate?: number;
  open_gaps?: number;
  total_checks?: number;
  last_check_at?: string;
  mention_rate_delta?: number;
  previous_mention_rate?: number;
  top_competitors?: { name: string; count: number }[];
  engine_stats?: Record<string, { rate: number; mentioned: number; total: number }>;
}

interface SeoStats {
  totalKeywords?: number;
  total_keywords?: number;
  avg_position?: number;
  avgPosition?: number;
  total_clicks?: number;
  totalClicks?: number;
  position_delta?: number;
  positionDelta?: number;
  clicks_delta?: number;
  clicksDelta?: number;
  top_keywords?: { keyword: string; position: number; clicks?: number }[];
}

interface Strength {
  title: string;
  detail: string;
}

interface Gap {
  // Stable id used to round-trip the gap into Content (Sprint 2, K-1/K-2).
  id: string;
  title: string;
  detail: string;
  topic?: string;
}

interface InsightsOverviewProps {
  tenantId: string;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function buildStrengths(geo: GeoSummary | null, seo: SeoStats | null): Strength[] {
  const out: Strength[] = [];
  if (geo && (geo.mention_rate ?? 0) >= 0.5) {
    const pct = Math.round((geo.mention_rate ?? 0) * 100);
    out.push({
      title: "Synlig i AI-assistenter",
      detail: `Ditt varumärke nämns i ${pct}% av frågorna AI-agenten kör.`,
    });
  }
  if (geo?.engine_stats) {
    const best = Object.entries(geo.engine_stats)
      .filter(([, s]) => (s?.total ?? 0) > 0)
      .sort((a, b) => (b[1].rate ?? 0) - (a[1].rate ?? 0))[0];
    if (best && best[1].rate >= 0.5) {
      out.push({
        title: `Stark närvaro i ${best[0]}`,
        detail: `${Math.round(best[1].rate * 100)}% omnämnandegrad — er bästa AI-tjänst.`,
      });
    }
  }
  const avgPos = seo?.avg_position ?? seo?.avgPosition ?? 0;
  if (avgPos > 0 && avgPos <= 10) {
    out.push({
      title: "Top-10 i Google",
      detail: `Snittposition ${avgPos.toFixed(1)} på dina ${seo?.total_keywords ?? seo?.totalKeywords ?? 0} sökord.`,
    });
  }
  if (seo?.top_keywords && seo.top_keywords.length > 0) {
    const winners = seo.top_keywords.filter((k) => k.position > 0 && k.position <= 3);
    if (winners.length > 0) {
      out.push({
        title: `${winners.length} sökord i topp 3`,
        detail: `Topp: "${winners[0].keyword}" på position ${winners[0].position}.`,
      });
    }
  }
  return out.slice(0, 3);
}

function buildGaps(geo: GeoSummary | null, seo: SeoStats | null): Gap[] {
  const out: Gap[] = [];
  if (geo && (geo.open_gaps ?? 0) > 0) {
    out.push({
      id: "ai_open_gaps",
      title: `${geo.open_gaps} öppna AI-gap`,
      detail: "Frågor där konkurrenter nämns men inte ditt varumärke. Skapa content som täcker dem.",
      topic: "Frågor där konkurrenter nämns men inte vi",
    });
  }
  if (geo && (geo.mention_rate ?? 0) < 0.3 && (geo.total_checks ?? 0) > 0) {
    const pct = Math.round((geo.mention_rate ?? 0) * 100);
    out.push({
      id: "low_ai_mention",
      title: "Låg synlighet i AI-sök",
      detail: `Endast ${pct}% omnämnandegrad — branschspecifikt content kan lyfta siffran.`,
      topic: "Branschspecifikt content som lyfter omnämnandegraden",
    });
  }
  const avgPos = seo?.avg_position ?? seo?.avgPosition ?? 0;
  if (avgPos > 0 && avgPos > 30) {
    out.push({
      id: "low_seo_rank",
      title: "Sökord rankar utanför topp 30",
      detail: `Snittposition ${avgPos.toFixed(1)} — content som matchar sökintention behövs.`,
      topic: "Sökord-content som matchar sökintention",
    });
  }
  if (geo?.top_competitors && geo.top_competitors.length > 0) {
    const dominant = geo.top_competitors[0];
    if (dominant.count >= 3) {
      const slug = dominant.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      out.push({
        id: `competitor_${slug}`,
        title: `${dominant.name} dominerar i AI-svar`,
        detail: `Nämns ${dominant.count} gånger mer än ni. Värt att skriva content som svarar på samma frågor.`,
        topic: `Varför ${dominant.name} inte räcker — vår syn`,
      });
    }
  }
  if (out.length === 0) {
    out.push({
      id: "no_gaps",
      title: "Inga akuta gap upptäckta",
      detail: "Kör en ny AI-kontroll för att hitta nya förbättringsområden.",
    });
  }
  return out.slice(0, 3);
}

// Sprint 2 (K-10) — round-trip status for a gap. We treat any piece whose
// source_gap_id matches as "addressing" the gap, and use the piece's status
// to colour the badge: published = "Stängd", anything else = "Pågående".
interface PieceLink {
  id: string;
  title: string;
  status: string;
  source_gap_id?: string | null;
}

interface GapOutcome {
  state: "published" | "in_progress";
  pieceTitle: string;
  pieceId: string;
}

function pickGapOutcome(pieces: PieceLink[], gapId: string): GapOutcome | null {
  const matches = pieces.filter((p) => p.source_gap_id === gapId);
  if (matches.length === 0) return null;
  const published = matches.find((p) => p.status === "published");
  if (published) {
    return { state: "published", pieceTitle: published.title, pieceId: published.id };
  }
  const first = matches[0];
  return { state: "in_progress", pieceTitle: first.title, pieceId: first.id };
}

export default function InsightsOverview({ tenantId }: InsightsOverviewProps) {
  const [geo, setGeo] = useState<GeoSummary | null>(null);
  const [seo, setSeo] = useState<SeoStats | null>(null);
  const [pieces, setPieces] = useState<PieceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setHasError(false);
      try {
        const [g, s, p] = await Promise.allSettled([
          tenantApi(tenantId).get<GeoSummary>("/api/ai-visibility/summary?days=30"),
          tenantApi(tenantId).get<SeoStats>("/api/seo/stats?days=30"),
          tenantApi(tenantId).get<{ pieces?: PieceLink[] }>("/api/content/pieces?limit=200"),
        ]);
        if (cancelled) return;
        if (g.status === "fulfilled" && g.value) setGeo(g.value);
        if (s.status === "fulfilled" && s.value) setSeo(s.value);
        if (p.status === "fulfilled" && p.value?.pieces) setPieces(p.value.pieces);
        if (g.status === "rejected" && s.status === "rejected") setHasError(true);
      } catch {
        if (!cancelled) setHasError(true);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm flex items-center gap-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Hämtar synlighet…
      </div>
    );
  }

  // Sprint 1 (I-4) — first-visit empty state. Tell the user exactly what
  // SAMA needs (domain + a handful of phrases) instead of vague spinner /
  // generic "no data" copy.
  const noData =
    !geo?.total_checks && !(seo?.total_keywords || seo?.totalKeywords) && !hasError;
  if (noData) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-violet-500 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-slate-900">Ingen synlighetsdata än</h2>
            <p className="mt-1 text-sm text-slate-500">
              Vi behöver veta er domän och 3–5 fraser ni vill ranka för. Lägg till
              fraserna nedan så kör SAMA en första mätning — då dyker styrkor och
              gap upp här.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/c/settings"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Kontrollera varumärke och domän
              </Link>
              <a
                href="#queries"
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Lägg till fraser
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mentionRate = geo?.mention_rate ?? 0;
  const mentionDelta =
    geo?.mention_rate_delta ??
    (geo?.previous_mention_rate != null && geo?.mention_rate != null
      ? geo.mention_rate - geo.previous_mention_rate
      : null);
  const avgPos = seo?.avg_position ?? seo?.avgPosition ?? 0;

  // Combined visibility score (0-100)
  const geoComponent = mentionRate * 100;
  const seoComponent = avgPos > 0 ? clamp(101 - avgPos, 0, 100) : 0;
  const haveGeo = (geo?.total_checks ?? 0) > 0;
  const haveSeo = avgPos > 0;
  const visibility = (() => {
    if (haveGeo && haveSeo) return Math.round((geoComponent + seoComponent) / 2);
    if (haveGeo) return Math.round(geoComponent);
    if (haveSeo) return Math.round(seoComponent);
    return 0;
  })();

  const stats: ScoreboardStat[] = [
    {
      key: "visibility",
      label: "Synlighet",
      tooltip:
        "Sammanvägd synlighet 0–100, 50% AI-omnämnandegrad och 50% Google-position. Räknar bara med kanaler där du har data.",
      value: `${visibility}`,
      hint: visibility >= 70 ? "Stark" : visibility >= 40 ? "Okej" : "Behöver lyftas",
    },
    {
      key: "geo",
      label: "AI-omnämnandegrad",
      tooltip: "Andel AI-frågor där ditt varumärke nämns. Mätt över de senaste 30 dagarna.",
      value: haveGeo ? `${Math.round(mentionRate * 100)}%` : "—",
      trend: <TrendBadge delta={mentionDelta} format="percent" />,
    },
    {
      key: "seo",
      label: "Snittposition i Google",
      tooltip:
        "Genomsnittlig rankposition för dina spårade sökord. Lägre är bättre.",
      value: haveSeo ? avgPos.toFixed(1) : "—",
      trend: <TrendBadge delta={seo?.position_delta ?? seo?.positionDelta ?? null} format="rank" inverted />,
    },
  ];

  const strengths = buildStrengths(geo, seo);
  const gaps = buildGaps(geo, seo);

  return (
    <div className="space-y-6">
      <StatScoreboard stats={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Styrkor
          </h2>
          {strengths.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-5 text-sm text-slate-400">
              Inga uppenbara styrkor än — kör fler kontroller för att hitta dem.
            </div>
          ) : (
            <ul className="space-y-2">
              {strengths.map((s, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"
                >
                  <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{s.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Gap att täcka
          </h2>
          {gaps.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-5 text-sm text-slate-400">
              Inga gap upptäckta.
            </div>
          ) : (
            <ul className="space-y-2">
              {gaps.map((g) => {
                // Sprint 2 (K-1): always pass a stable gap id so Content can
                // round-trip the piece back via source_gap_id.
                const params = new URLSearchParams();
                params.set("gap", g.id);
                if (g.topic) params.set("topic", g.topic);
                params.set("gap_title", g.title);
                const href = `/c/content?${params.toString()}`;
                const outcome = pickGapOutcome(pieces, g.id);
                return (
                  <li key={g.id} className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                    <p className="text-sm font-semibold text-slate-900">{g.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{g.detail}</p>
                    {outcome && (
                      <div
                        className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          outcome.state === "published"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-blue-200 bg-blue-50 text-blue-700"
                        }`}
                      >
                        {outcome.state === "published" ? "Stängd" : "Pågående"}
                        <span className="opacity-70">— {outcome.pieceTitle}</span>
                      </div>
                    )}
                    {g.id !== "no_gaps" && (
                      <Link
                        href={href}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
                      >
                        Skapa artikel för detta
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <Info className="h-4 w-4 flex-shrink-0 text-slate-400 mt-0.5" />
        <p>
          <strong className="text-slate-700">Vad mäter vi?</strong>{" "}
          Synlighet kombinerar två saker: hur ofta ert varumärke nämns när AI-assistenter
          (ChatGPT, Claude, Perplexity, Gemini) får relevanta frågor — och hur högt era sidor
          rankar i Google-sök för spårade sökord. Båda mäts mot konkurrenterna ni angett.
        </p>
      </div>

      <div className="text-xs text-slate-400">
        Senaste AI-kontroll:{" "}
        {geo?.last_check_at
          ? new Date(geo.last_check_at).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
          : "aldrig"}
        {(seo?.total_keywords || seo?.totalKeywords) ? (
          <>
            {" · "}{seo?.total_keywords ?? seo?.totalKeywords} sökord spårade
          </>
        ) : null}
        {(geo?.total_checks ?? 0) > 0 && (
          <>
            {" · "}{geo?.total_checks} AI-kontroller
          </>
        )}
      </div>
    </div>
  );
}

