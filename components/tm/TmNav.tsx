"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, BarChart3, ListChecks } from "lucide-react";

const TABS = [
  { href: "/tm", label: "Kampanjer", icon: Phone, exact: true },
  { href: "/tm/overview", label: "Översikt", icon: BarChart3, exact: false },
  { href: "/tm/worklist", label: "Att ringa idag", icon: ListChecks, exact: false },
];

export default function TmNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
