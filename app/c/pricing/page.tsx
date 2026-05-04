"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Sparkles, Zap, Building2 } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useUser } from "@/lib/hooks/useUser";

type TierName = "Starter" | "Growth" | "Enterprise";

const TIERS: {
  name: TierName;
  price: string;
  period: string;
  description: string;
  icon: typeof Zap;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
  badge?: string;
}[] = [
  {
    name: "Starter",
    price: "$149",
    period: "/mo",
    description: "Essential marketing automation for growing brands",
    icon: Zap,
    features: [
      "SEO Agent",
      "5 content pieces/mo",
      "Social posting (X only)",
      "Review monitoring",
      "Basic analytics dashboard",
    ],
    cta: "Start Free Trial",
    href: "/c/dashboard",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$399",
    period: "/mo",
    description: "Full-stack marketing AI for scaling companies",
    icon: Sparkles,
    features: [
      "Everything in Starter",
      "Ads Agent (Google & Meta)",
      "Social (X + LinkedIn + Reddit)",
      "Auto-reply to reviews",
      "Full analytics & reporting",
      "AI Visibility monitoring",
    ],
    cta: "Get Started",
    href: "/c/dashboard",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Tailored solution for large organizations",
    icon: Building2,
    features: [
      "Everything in Growth",
      "API access",
      "Custom integrations",
      "Dedicated support",
      "Custom agent workflows",
      "SLA & uptime guarantees",
    ],
    cta: "Contact Us",
    href: "mailto:hello@successifier.com",
    highlighted: false,
  },
];

const getSupabase = getSupabaseBrowser;

export default function PricingPage() {
  const { user } = useUser();
  const [currentPlan, setCurrentPlan] = useState<TierName | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase
          .from("user_settings")
          .select("settings")
          .eq("user_id", user.id)
          .single();
        const planRaw: unknown = data?.settings?.plan;
        if (typeof planRaw === "string") {
          const normalized = planRaw.charAt(0).toUpperCase() + planRaw.slice(1).toLowerCase();
          if (normalized === "Starter" || normalized === "Growth" || normalized === "Enterprise") {
            setCurrentPlan(normalized);
          }
        }
      } catch {
        // No subscription info yet — leave unset
      }
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="mx-auto max-w-5xl px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
          Choose the plan that fits your marketing needs. All plans include a
          14-day free trial with no credit card required.
        </p>
      </div>

      {/* Tier cards */}
      <div className="mx-auto max-w-5xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => {
            const isCurrent = currentPlan === tier.name;
            return (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                tier.highlighted
                  ? "border-blue-500 bg-zinc-900 shadow-lg shadow-blue-500/10"
                  : "border-zinc-800 bg-zinc-900"
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-500 px-4 py-1 text-xs font-semibold text-white">
                    {tier.badge}
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`rounded-lg p-2 ${
                      tier.highlighted
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <tier.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-xl font-bold">{tier.name}</h2>
                </div>

                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  {tier.period && (
                    <span className="text-zinc-500">{tier.period}</span>
                  )}
                </div>
                <p className="text-sm text-zinc-400">{tier.description}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                    <span className="text-zinc-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {tier.href.startsWith("mailto:") ? (
                <a
                  href={tier.href}
                  className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                    tier.highlighted
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  }`}
                >
                  {tier.cta}
                </a>
              ) : (
                <Link
                  href={tier.href}
                  className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                    tier.highlighted
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  }`}
                >
                  {tier.cta}
                </Link>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
