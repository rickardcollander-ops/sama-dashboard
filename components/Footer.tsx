import Link from "next/link";

/**
 * Footer with legal links — required for GDPR/EU sales: ToS, Privacy,
 * Data Processing Agreement must be reachable from every authenticated page.
 */
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:px-6">
        <span>© {new Date().getFullYear()} Successifier. Alla rättigheter förbehållna.</span>
        <nav className="flex gap-4">
          <Link href="/c/legal/terms" className="hover:text-slate-700">Villkor</Link>
          <Link href="/c/legal/privacy" className="hover:text-slate-700">Integritet</Link>
          <Link href="/c/legal/dpa" className="hover:text-slate-700">DPA</Link>
          <a href="mailto:support@successifier.com" className="hover:text-slate-700">Support</a>
        </nav>
      </div>
    </footer>
  );
}
