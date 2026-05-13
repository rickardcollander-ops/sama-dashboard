import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Link href="/" className="flex items-center gap-2 text-base font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>Sama AI</span>
          </Link>
          <p className="mt-3 max-w-sm text-sm text-slate-500">
            AI has eaten search. We make sure your business is the one ChatGPT,
            Perplexity and Google AI mention when customers ask.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Product
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li><Link href="/audit" className="hover:text-slate-900">Free AI audit</Link></li>
            <li><Link href="/#features" className="hover:text-slate-900">Features</Link></li>
            <li><Link href="/#pricing" className="hover:text-slate-900">Pricing</Link></li>
            <li><Link href="/c/login" className="hover:text-slate-900">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Legal
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li><Link href="/c/legal/terms" className="hover:text-slate-900">Terms</Link></li>
            <li><Link href="/c/legal/privacy" className="hover:text-slate-900">Privacy Policy</Link></li>
            <li><Link href="/c/legal/dpa" className="hover:text-slate-900">DPA</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-400 sm:px-6">
          © {year} Successifier. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
