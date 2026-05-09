import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Sparkles, LogIn } from "lucide-react";
import PublicAuditResult from "@/components/analysis/PublicAuditResult";
import { loadPublicAudit } from "@/lib/public-audit-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const result = await loadPublicAudit(id);
  if (!result) {
    return { title: "Audit not found — Sama AI" };
  }
  const score = result.audit.scores.overall;
  const title = `${result.domain} — ${score}/100 in AI visibility`;
  const description = `See the full AI visibility report for ${result.domain} and run your own free audit in 30 seconds.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Sama AI",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SharedAuditPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await loadPublicAudit(id);
  if (!result) notFound();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/c/audit" className="flex items-center gap-2 text-base font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>Sama AI-audit</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/c/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:px-4 sm:py-2"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
            <Link
              href="/c/audit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 sm:px-4 sm:py-2"
            >
              Run your own
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-violet-600">
            Shared audit
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            AI visibility report for {result.domain}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Created {new Date(result.fetched_at).toLocaleDateString(undefined, {
              year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>

        <PublicAuditResult result={result} />

        <div className="mt-12 rounded-2xl bg-slate-900 p-8 text-center text-white">
          <h2 className="text-2xl font-bold sm:text-3xl">Get the same report for your own site</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
            Free. No card. No account. 30 seconds.
          </p>
          <Link
            href="/c/audit"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100"
          >
            Run free audit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
