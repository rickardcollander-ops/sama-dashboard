"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const STORAGE_KEY = "sama-cookie-consent-v1";

/**
 * Minimal GDPR cookie consent banner. We don't run third-party analytics
 * tracking inside the customer portal so this is a notice rather than a
 * granular preference center — but the banner is required for EU sales
 * and gates first-party analytics if/when those are added.
 */
export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      // private browsing or storage disabled — show banner; user dismissal
      // will simply not persist, which is acceptable.
      setShow(true);
    }
  }, []);

  const dismiss = (choice: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: Date.now() }));
    } catch {
      // ignore storage errors
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1 text-sm text-slate-700">
          <p className="font-semibold">We value your privacy</p>
          <p className="mt-1 text-xs text-slate-500">
            We use only essential cookies to keep you signed in and remember
            your preferences. No third-party trackers run in this dashboard.
            Read our{" "}
            <Link href="/c/legal/privacy" className="underline">privacy policy</Link>.
          </p>
        </div>
        <button
          onClick={() => dismiss("rejected")}
          aria-label="Dismiss"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => dismiss("rejected")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Reject non-essential
        </button>
        <button
          onClick={() => dismiss("accepted")}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
