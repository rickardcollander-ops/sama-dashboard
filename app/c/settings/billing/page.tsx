"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Building2, Check, ExternalLink, Loader2, Sparkles, Zap,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type TierName = "Starter" | "Growth" | "Enterprise";

interface Tier {
  name: TierName;
  price: string;
  period: string;
  blurb: string;
  icon: typeof Zap;
  highlights: string[];
}

const TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$149",
    period: "/mo",
    blurb: "Starter pack for growing brands",
    icon: Zap,
    highlights: ["SEO agent", "5 content/mo", "Reviews"],
  },
  {
    name: "Growth",
    price: "$399",
    period: "/mo",
    blurb: "Full marketing AI for scaling companies",
    icon: Sparkles,
    highlights: ["Everything in Starter", "Ad agent", "AI visibility", "Full reporting"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    blurb: "Tailored for larger organisations",
    icon: Building2,
    highlights: ["Everything in Growth", "API access", "Dedicated support"],
  },
];

export default function BillingPage() {
  const { user } = useUser();
  const [currentPlan, setCurrentPlan] = useState<TierName | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const supabase = getSupabaseBrowser();
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
        /* leave unset */
      }
      setLoading(false);
    })();
  }, [user]);

  const current = TIERS.find((t) => t.name === currentPlan) ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Plan & billing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your subscription and see where your plan stands.
          </p>
        </div>

        {/* Current plan card */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current plan
              </p>
              <div className="mt-1 flex items-center gap-3">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : current ? (
                  <>
                    <current.icon className="h-6 w-6 text-blue-600" />
                    <h2 className="text-2xl font-bold text-slate-900">{current.name}</h2>
                    <span className="text-slate-500">
                      {current.price}
                      {current.period}
                    </span>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-slate-900">No active plan</h2>
                  </>
                )}
              </div>
              {current && (
                <p className="mt-2 text-sm text-slate-500">{current.blurb}</p>
              )}
            </div>
            <Link
              href="/c/pricing"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              {current ? "Change plan" : "Pick a plan"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {current && (
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {current.highlights.map((h) => (
                <li key={h} className="flex items-center gap-2 text-sm text-slate-700">
                  <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Other tiers — quick comparison */}
        <h3 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Other plans
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {TIERS.filter((t) => t.name !== currentPlan).map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <t.icon className="h-5 w-5 text-slate-500" />
                <h4 className="font-semibold text-slate-900">{t.name}</h4>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {t.price}
                <span className="text-sm font-normal text-slate-400">{t.period}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{t.blurb}</p>
              <Link
                href="/c/pricing"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                See details
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* Billing details placeholder */}
        <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Billing information</h3>
          <p className="mt-1 text-sm text-slate-500">
            Billing details and receipts are handled via our support team.
          </p>
          <a
            href="mailto:hello@successifier.com"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Contact support
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </main>
    </div>
  );
}
