import Link from "next/link";
import {
  Activity, ArrowRight, BarChart2, Compass, FileText,
  Settings, Sparkles,
} from "lucide-react";

const SUGGESTIONS = [
  { href: "/c/dashboard", label: "Hem", description: "Status och nästa steg", icon: BarChart2 },
  { href: "/c/strategy", label: "Strategi", description: "Riktning och plan", icon: Compass },
  { href: "/c/analysis", label: "Insikter", description: "Synlighet i Google och AI-assistenter", icon: Sparkles },
  { href: "/c/content", label: "Content", description: "Skapa, planera, publicera", icon: FileText },
  { href: "/c/settings", label: "Inställningar", description: "Konto, varumärke, integrationer", icon: Settings },
];

export default function CustomerNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-white px-4 sm:px-6">
        <Link href="/c/dashboard" className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-bold text-slate-900">SAMA</span>
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <p className="text-sm font-semibold text-blue-600">404</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Sidan finns inte</h1>
        <p className="mt-2 text-slate-500">
          Länken du följde fungerar inte längre, eller så har sidan flyttats. Här är vart du
          kan gå istället.
        </p>

        <ul className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-xl border bg-white shadow-sm">
          {SUGGESTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
              >
                <span className="rounded-lg bg-slate-100 p-2.5">
                  <s.icon className="h-5 w-5 text-slate-700" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{s.label}</span>
                  <span className="block text-sm text-slate-500">{s.description}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
