"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe, Loader2, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useUser } from "@/lib/hooks/useUser";
import { useSubscription } from "@/lib/hooks/useSubscription";

/**
 * Pricing page — single per-site tier at $169/mo.
 *
 * Stripe quantity == number of sites the user has connected, so the
 * "$169 × N" math updates automatically as sites are added/removed (the
 * backend syncs the quantity onto the Stripe subscription).
 */
export default function PricingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { status } = useSubscription();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sites = status?.site_count ?? 1;
  const unit = status?.unit_price_usd ?? 169;
  const total = unit * Math.max(sites, 1);
  const isActive = status?.status === "active" || status?.status === "trialing";

  async function subscribe() {
    if (!user) {
      router.push("/c/login?next=/c/pricing");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>("/api/subscriptions/checkout", {});
      if (url) window.location.href = url;
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `Checkout failed (${e.status}). ${e.message.split(":").slice(-1)[0] || ""}`
          : "Checkout failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
          Pricing
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-xl mx-auto">
          One simple plan, billed per site. Start with a 3-day free trial — no
          credit card needed until you decide to keep going.
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

      <div className="mx-auto max-w-xl px-4 pb-20">
        <div className="relative flex flex-col rounded-2xl border border-blue-500 bg-white p-8 shadow-lg shadow-blue-500/10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
              Per site
            </span>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <Globe className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">SAMA</h2>
            </div>

            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-5xl font-bold text-slate-900">${unit}</span>
              <span className="text-slate-400">/ month per site</span>
            </div>
            <p className="text-sm text-slate-600">
              Includes everything — SEO, content, ads, social, reviews, AI visibility.
            </p>
          </div>

          <ul className="mb-8 space-y-3">
            {[
              "Full SEO + content agent",
              "Ads agent (Google & Meta)",
              "Social posting (X + LinkedIn + Reddit)",
              "AI visibility monitoring",
              "Auto-replies to reviews",
              "Full analytics & reporting",
              "Unlimited team seats per site",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                <span className="text-slate-700">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Your sites</span>
              <span className="font-semibold">{sites}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-base text-slate-900">
              <span>
                ${unit} × {sites}
              </span>
              <span className="font-bold">${total} / mo</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void subscribe()}
            disabled={busy || isActive}
            className="block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : isActive ? (
              "You’re subscribed"
            ) : (
              "Subscribe"
            )}
          </button>

          <p className="mt-3 text-center text-xs text-slate-400">
            Cancel anytime from the Stripe billing portal. Adding a new site
            adjusts your bill automatically.
          </p>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Need something custom — multi-region, white-label, API access?{" "}
          <a
            href="mailto:hello@successifier.com"
            className="font-semibold text-blue-600 hover:text-blue-800"
          >
            Talk to us
          </a>
          .
        </p>
      </div>
    </div>
  );
}
