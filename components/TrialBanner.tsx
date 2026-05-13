"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import { useSubscription } from "@/lib/hooks/useSubscription";

/**
 * Thin banner shown across the customer portal when the user is on the
 * 3-day free trial or has hit a blocked state (trial expired, past due).
 * Active / admin_granted users see nothing.
 */
export default function TrialBanner() {
  const { status } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (!status || dismissed) return null;
  if (status.status === "active" || status.status === "trialing" || status.status === "admin_granted") {
    return null;
  }

  // Trial countdown — friendly amber bar.
  if (status.status === "trial" && status.has_access) {
    const days = status.trial_days_remaining;
    return (
      <div className="sticky top-0 z-30 border-b border-amber-200 bg-amber-50 text-amber-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <span className="font-semibold">{days} {days === 1 ? "day" : "days"}</span>{" "}
              left in your free trial.
            </span>
            <Link
              href="/c/pricing"
              className="font-semibold text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
            >
              Subscribe
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-amber-700 hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Blocked — red bar (no dismiss).
  if (!status.has_access) {
    return (
      <div className="sticky top-0 z-30 border-b border-rose-300 bg-rose-50 text-rose-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>
              <span className="font-semibold">Trial ended.</span>{" "}
              Subscribe to keep generating content and running agents.
            </span>
          </div>
          <Link
            href="/c/pricing"
            className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
          >
            See plans
          </Link>
        </div>
      </div>
    );
  }

  // Past due — orange.
  if (status.status === "past_due") {
    return (
      <div className="sticky top-0 z-30 border-b border-orange-200 bg-orange-50 text-orange-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
          <span>
            <span className="font-semibold">Payment failed.</span>{" "}
            Update your card before access pauses.
          </span>
          <Link
            href="/c/settings/billing"
            className="rounded-md bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700"
          >
            Fix billing
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
