"use client";

import Link from "next/link";
import { ArrowRight, FileText, ShieldCheck, Sparkles, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NextStepsInput {
  pendingApprovals: number;
  mentionRateDelta: number | null;
  publishedLast30d: number;
  alertsCount: number;
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

  if (input.publishedLast30d === 0) {
    steps.push({
      id: "no-content",
      title: "Inget content publicerat sista 30 dagarna",
      why: "Synligheten påverkas av aktivitet — börja med ett nytt inlägg.",
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
