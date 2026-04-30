import { ReactNode } from "react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";

/**
 * Shared shell for legal documents. Uses a centered prose layout and a
 * "draft" banner that makes it explicit the boilerplate text below is a
 * starting point — replace before commercial launch.
 */
export default function LegalShell({
  title,
  effective,
  children,
}: {
  title: string;
  effective: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerNav />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-xs text-slate-400">Effective: {effective}</p>
        </div>

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <strong>Draft.</strong> This document is a starting template. Replace with reviewed legal copy before commercial launch — contact your legal counsel.
        </div>

        <article className="prose prose-slate prose-sm max-w-none rounded-xl border bg-white p-6 shadow-sm">
          {children}
        </article>

        <p className="mt-6 text-xs text-slate-400">
          Questions? <Link href="/c/legal/privacy" className="underline">Privacy</Link>{" · "}
          <Link href="/c/legal/terms" className="underline">Terms</Link>{" · "}
          <Link href="/c/legal/dpa" className="underline">DPA</Link>{" · "}
          <a href="mailto:legal@successifier.com" className="underline">legal@successifier.com</a>
        </p>
      </div>
    </div>
  );
}
