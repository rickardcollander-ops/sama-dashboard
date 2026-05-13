"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Check, ExternalLink, Globe, Loader2,
  ShieldCheck, Sparkles,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { api, ApiError } from "@/lib/api";
import { useSubscription } from "@/lib/hooks/useSubscription";

const FEATURES = [
  "Full SEO + content agent",
  "Ads agent (Google & Meta)",
  "Social (X + LinkedIn + Reddit)",
  "AI visibility monitoring",
  "Auto-replies to reviews",
  "Full analytics & reporting",
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function BillingPage() {
  const { status, loading, error, refresh } = useSubscription();
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [busyMsg, setBusyMsg] = useState<string | null>(null);

  const sites = status?.site_count ?? 0;
  const quantity = status?.quantity ?? Math.max(sites, 1);
  const unit = status?.unit_price_usd ?? 169;
  const total = status?.monthly_total_usd ?? unit * Math.max(quantity, 1);

  const isAdminGranted = status?.status === "admin_granted";
  const isTrial = status?.status === "trial";
  const isActive = status?.status === "active" || status?.status === "trialing";
  const isPastDue = status?.status === "past_due";
  const isBlocked = status && !status.has_access;

  async function startCheckout() {
    setBusy("checkout");
    setBusyMsg(null);
    try {
      const { url } = await api.post<{ url: string }>("/api/subscriptions/checkout", {});
      if (url) window.location.href = url;
    } catch (e) {
      setBusyMsg(
        e instanceof ApiError ? `Checkout failed (${e.status})` : "Checkout failed",
      );
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setBusyMsg(null);
    try {
      const { url } = await api.post<{ url: string }>("/api/subscriptions/portal", {});
      if (url) window.location.href = url;
    } catch (e) {
      setBusyMsg(
        e instanceof ApiError ? `Portal unavailable (${e.status})` : "Portal unavailable",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Plan & billing</h1>
          <p className="mt-1 text-sm text-slate-500">
            ${unit} / month per site. Your bill updates automatically as you add or remove sites.
          </p>
        </div>

        {/* Status banners */}
        {isTrial && status && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 mt-0.5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">
                  Free trial — {status.trial_days_remaining}{" "}
                  {status.trial_days_remaining === 1 ? "day" : "days"} remaining
                </p>
                <p className="mt-0.5 text-amber-800">
                  Trial ends {fmtDate(status.trial_ends_at)}. Subscribe before then to keep
                  everything running without interruption.
                </p>
              </div>
            </div>
          </div>
        )}

        {isBlocked && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 mt-0.5 text-rose-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Trial expired</p>
                <p className="mt-0.5 text-rose-800">
                  Subscribe to re-enable content generation, agent runs and the
                  rest of the AI features. Already paid? Refresh this page.
                </p>
              </div>
            </div>
          </div>
        )}

        {isPastDue && (
          <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
            <p className="font-semibold">Payment is past due</p>
            <p className="mt-0.5 text-orange-800">
              Stripe couldn&apos;t charge your card. Open the billing portal to update
              it before access is paused.
            </p>
          </div>
        )}

        {isAdminGranted && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 mt-0.5 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Free access granted</p>
                <p className="mt-0.5 text-emerald-800">
                  An admin has granted you free access
                  {status?.admin_granted_until
                    ? ` until ${fmtDate(status.admin_granted_until)}`
                    : " with no end date"}
                  .
                </p>
              </div>
            </div>
          </div>
        )}

        {busyMsg && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {busyMsg}
          </div>
        )}

        {/* Plan card */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current plan
              </p>
              <div className="mt-1 flex items-center gap-3">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : (
                  <>
                    <Globe className="h-6 w-6 text-blue-600" />
                    <h2 className="text-2xl font-bold text-slate-900">SAMA</h2>
                    <span className="text-slate-500">${unit} / site / mo</span>
                  </>
                )}
              </div>
              {error && (
                <p className="mt-2 text-xs text-rose-600">Failed to load: {error}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {isActive || isPastDue ? (
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={busy === "portal"}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-60"
                >
                  {busy === "portal" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Manage billing
                      <ExternalLink className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={busy === "checkout"}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
                >
                  {busy === "checkout" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Subscribe
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Site breakdown */}
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Connected sites</span>
              <span className="font-semibold text-slate-900">{sites || 0}</span>
            </div>
            {isActive && quantity !== sites && sites > 0 && (
              <div className="mt-1 flex items-center justify-between text-xs text-amber-700">
                <span>Stripe quantity</span>
                <span>
                  {quantity} (syncing to {sites})
                </span>
              </div>
            )}
            <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3">
              <span className="text-slate-500">
                ${unit} × {Math.max(quantity, 1)}
              </span>
              <span className="text-xl font-bold text-slate-900">
                ${total} <span className="text-sm font-normal text-slate-400">/ mo</span>
              </span>
            </div>
          </div>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {FEATURES.map((h) => (
              <li key={h} className="flex items-center gap-2 text-sm text-slate-700">
                <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                {h}
              </li>
            ))}
          </ul>

          {status?.current_period_end && (isActive || isPastDue) && (
            <p className="mt-4 text-xs text-slate-500">
              Next renewal: {fmtDate(status.current_period_end)}
            </p>
          )}
        </div>

        {/* Help */}
        <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Need help with your invoice?</h3>
          <p className="mt-1 text-sm text-slate-500">
            Receipts, tax docs, payment-method updates and cancellations live in
            the Stripe billing portal. For anything else, reach out and
            we&apos;ll sort it.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <a
              href="mailto:hello@successifier.com"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Contact support
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <Link
              href="/c/pricing"
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              View pricing
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Refresh status
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
