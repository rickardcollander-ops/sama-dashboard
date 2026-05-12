import Link from "next/link";
import { LogIn, Sparkles } from "lucide-react";

interface Props {
  variant?: "default" | "transparent";
}

export default function MarketingHeader({ variant = "default" }: Props) {
  const border =
    variant === "transparent" ? "border-transparent" : "border-slate-100";
  return (
    <header className={`border-b ${border}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>Sama AI</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href="/audit" className="hover:text-slate-900">
            Free audit
          </Link>
          <Link href="/#features" className="hover:text-slate-900">
            Features
          </Link>
          <Link href="/#how-it-works" className="hover:text-slate-900">
            How it works
          </Link>
          <Link href="/#pricing" className="hover:text-slate-900">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/c/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:px-4 sm:py-2"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
          <Link
            href="/c/onboarding"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 sm:px-4 sm:py-2"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
