"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, Zap, Building2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useUser } from "@/lib/hooks/useUser";
import { useSubscription } from "@/lib/hooks/useSubscription";

type TierKey = "starter" | "growth" | "enterprise";

const TIERS: {
  key: TierKey;
  name: string;
  price: string;
  period: string;
  description: string;
  icon: typeof Zap;
  features: string[];
  cta: string;
  highlighted: boolean;
  badge?: string;
}[] = [
  {
    key: "starter",
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
    cta: "Subscribe",
    highlighted: false,
  },
  {
    key: "growth",
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
    cta: "Subscribe",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    key: "enterprise",
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
    highlighted: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { status } = useSubscription();
  const [busyTier, setBusyTier] = useState<TierKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = status?.plan?.toLowerCase() ?? null;

  async function subscribe(tier: TierKey) {
    if (tier === "enterprise") {
      window.location.href = "mailto:hello@successifier.com";
      return;
    }
    if (!user) {
      router.push("/c/login?next=/c/pricing");
      return;
    }
    setBusyTier(tier);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>("/api/subscriptions/checkout", { plan: tier });
      if (url) window.location.href = url;
    } catch (e) {
      const msg = e instanceof ApiError ? `Checkout failed (${e.status})` : "Checkout failed";
      setError(msg);
    } finally {
      setBusyTier(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
          Every plan starts with a 3-day free trial. No credit card required to
          start — pay only when you&apos;re convinced.
        </p>
        {status?.status === "trial" && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800 border border-amber-200">
            <Sparkles className="h-4 w-4" />
            {status.trial_days_remaining} day
            {status.trial_days_remaining === 1 ? "" : "s"} left in your trial
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm text-rose-600">{error}</p>
        )}
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => {
            const isCurrent = currentPlan === tier.key && (status?.status === "active" || status?.status === "trialing");
            const isBusy = busyTier === tier.key;
            return (
              <div
                key={tier.key}
                className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm ${
                  tier.highlighted
                    ? "border-blue-500 shadow-blue-500/10"
                    : "border-slate-200"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                      {tier.badge}
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`rounded-lg p-2 ${
                        tier.highlighted ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <tier.icon className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{tier.name}</h2>
                  </div>

                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-bold text-slate-900">{tier.price}</span>
                    {tier.period && (
                      <span className="text-slate-400">{tier.period}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{tier.description}</p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => void subscribe(tier.key)}
                  disabled={isBusy || isCurrent}
                  className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors disabled:opacity-60 ${
                    tier.highlighted
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {isBusy ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "You’re on this plan"
                  ) : (
                    tier.cta
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
