"use client";

import Link from "next/link";
import { ArrowRight, Compass, FileText, ShieldCheck, Sparkles, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Sprint 2 (H2) — "Nästa steg" / What should I do next?
//
// V1 is *purely rule-based* on data we already have. No AI inference. Each
// step has a `why` sentence anchored on a concrete datapoint. Show top 3.
//
// Priority order (highest first):
//   1. Pending approvals waiting on the user (most urgent — blocks publishing)
//   2. Mention-rate dropped meaningfully period-over-period
//   3. Strategy is stale (>30 days since generation)
//   4. No content published recently (>14 days) and we have a strategy
//   5. Critical alerts unread

export interface NextStepsInput {
  pendingApprovals: number;
  mentionRateDelta: number | null;
  strategyGeneratedAt?: string | null;
  publishedLast30d: number;
  alertsCount: number;
  hasStrategy: boolean;
}

interface NextStep {
  id: string;
  title: string;
  why: string;
  href: string;
  cta: string;
  icon: LucideIcon;
  tone: "blue" | "amber" | "violet" | "emerald";
}

const TONE_CLASSES: Record<NextStep["tone"], { bg: string; icon: string; cta: string }> = {
  blue:    { bg: "bg-blue-50 border-blue-200",       icon: "text-blue-600",       cta: "text-blue-700 hover:text-blue-900" },
  amber:   { bg: "bg-amber-50 border-amber-200",     icon: "text-amber-600",      cta: "text-amber-700 hover:text-amber-900" },
  violet:  { bg: "bg-violet-50 border-violet-200",   icon: "text-violet-600",     cta: "text-violet-700 hover:text-violet-900" },
  emerald: { bg: "bg-emerald-50 border-emerald-200", icon: "text-emerald-600",    cta: "text-emerald-700 hover:text-emerald-900" },
};

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function buildNextSteps(input: NextStepsInput): NextStep[] {
  const steps: NextStep[] = [];

  if (input.pendingApprovals > 0) {
    steps.push({
      id: "pending-drafts",
      title: input.pendingApprovals === 1
        ? "1 utkast väntar på dig"
        : `${input.pendingApprovals} utkast väntar på dig`,
      why: "Tills du godkänner kan vi inte publicera.",
      href: "/c/approvals",
      cta: "Granska",
      icon: ShieldCheck,
      tone: "blue",
    });
  }

  if (input.mentionRateDelta !== null && input.mentionRateDelta < -0.05) {
    const drop = Math.round(Math.abs(input.mentionRateDelta) * 100);
    steps.push({
      id: "mention-drop",
      title: "Synligheten i AI-assistenter har sjunkit",
      why: `Omnämnandegrad är ${drop} procentenheter lägre än förra perioden.`,
      href: "/c/geo",
      cta: "Se varför",
      icon: TrendingDown,
      tone: "amber",
    });
  }

  const strategyAge = daysSince(input.strategyGeneratedAt);
  if (!input.hasStrategy) {
    steps.push({
      id: "no-strategy",
      title: "Sätt en strategi",
      why: "Utan strategi blir content-förslag generiska.",
      href: "/c/strategy",
      cta: "Skapa",
      icon: Compass,
      tone: "emerald",
    });
  } else if (strategyAge !== null && strategyAge > 30) {
    steps.push({
      id: "stale-strategy",
      title: "Strategin är gammal",
      why: `Senast uppdaterad för ${strategyAge} dagar sen — utfallet kan ha hunnit ändras.`,
      href: "/c/strategy",
      cta: "Förfina",
      icon: Compass,
      tone: "emerald",
    });
  }

  if (input.hasStrategy && input.publishedLast30d === 0) {
    steps.push({
      id: "no-content",
      title: "Inget content publicerat sista 30 dagarna",
      why: "Synligheten påverkas av aktivitet — börja med ett förslag baserat på din strategi.",
      // Sprint 2 (K-12) — deep link straight to the ideas panel so the
      // next step lands in context, not just on the page.
      href: "/c/content#ideas",
      cta: "Skapa content",
      icon: FileText,
      tone: "violet",
    });
  }

  if (input.alertsCount > 0 && steps.length < 3) {
    steps.push({
      id: "alerts",
      title: input.alertsCount === 1
        ? "1 varning behöver din uppmärksamhet"
        : `${input.alertsCount} varningar behöver din uppmärksamhet`,
      why: "Öppna systemstatus för att se vad som hänt.",
      // Sprint 3 (H-3) — every Next Step now lands on a real page, no
      // placeholder anchors.
      href: "/system-health",
      cta: "Öppna varningar",
      icon: Sparkles,
      tone: "amber",
    });
  }

  return steps.slice(0, 3);
}

interface NextStepsProps {
  input: NextStepsInput;
}

export default function NextSteps({ input }: NextStepsProps) {
  const steps = buildNextSteps(input);
  if (steps.length === 0) {
    return (
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Nästa steg
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Inget kräver din uppmärksamhet just nu — agenterna jobbar i bakgrunden.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Nästa steg
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s) => {
          const tone = TONE_CLASSES[s.tone];
          return (
            <Link
              key={s.id}
              href={s.href}
              className={`flex flex-col gap-2 rounded-xl border p-4 transition-colors hover:shadow-sm ${tone.bg}`}
            >
              <div className="flex items-start gap-2">
                <s.icon className={`h-5 w-5 flex-shrink-0 ${tone.icon}`} />
                <h3 className="font-semibold text-slate-900 leading-snug">{s.title}</h3>
              </div>
              <p className="text-sm text-slate-600">{s.why}</p>
              <span className={`mt-auto inline-flex items-center gap-1 text-sm font-semibold ${tone.cta}`}>
                {s.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
