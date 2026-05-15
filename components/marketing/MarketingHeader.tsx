"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, LogIn, Menu, Sparkles, X } from "lucide-react";
import { useLanguage } from "@/lib/hooks/useLanguage";

const NAV = {
  sv: {
    platform: "Plattformen",
    useCases: "Användningsområden",
    resources: "Resurser",
    pricing: "Priser",
    signIn: "Logga in",
    cta: "Gratis audit",
    platformItems: [
      { label: "AI-synlighet (GEO)", href: "/platform/ai-visibility" },
      { label: "SEO + Google", href: "/platform/seo" },
      { label: "Content", href: "/platform/content" },
      { label: "Tech", href: "/platform/tech" },
      { label: "Ads", href: "/platform/ads" },
    ],
    useCaseItems: [
      { label: "B2B SaaS", href: "/use-cases/saas" },
      { label: "E-handel", href: "/use-cases/ecommerce" },
      { label: "Byråer", href: "/use-cases/agencies" },
      { label: "Lokala företag", href: "/use-cases/local-business" },
      { label: "Konsultbolag", href: "/use-cases/consulting" },
      { label: "Media", href: "/use-cases/media" },
    ],
    resourceItems: [
      { label: "Blogg", href: "/blog" },
      { label: "AI Gap", href: "/ai-gap" },
      { label: "Vanliga frågor", href: "/faq" },
      { label: "Om oss", href: "/about" },
    ],
  },
  en: {
    platform: "Platform",
    useCases: "Use Cases",
    resources: "Resources",
    pricing: "Pricing",
    signIn: "Sign in",
    cta: "Free audit",
    platformItems: [
      { label: "AI Visibility (GEO)", href: "/platform/ai-visibility" },
      { label: "SEO + Google", href: "/platform/seo" },
      { label: "Content", href: "/platform/content" },
      { label: "Tech", href: "/platform/tech" },
      { label: "Ads", href: "/platform/ads" },
    ],
    useCaseItems: [
      { label: "B2B SaaS", href: "/use-cases/saas" },
      { label: "E-commerce", href: "/use-cases/ecommerce" },
      { label: "Agencies", href: "/use-cases/agencies" },
      { label: "Local Business", href: "/use-cases/local-business" },
      { label: "Consulting", href: "/use-cases/consulting" },
      { label: "Media", href: "/use-cases/media" },
    ],
    resourceItems: [
      { label: "Blog", href: "/blog" },
      { label: "AI Gap", href: "/ai-gap" },
      { label: "FAQ", href: "/faq" },
      { label: "About", href: "/about" },
    ],
  },
};

interface DropdownProps {
  label: string;
  items: { label: string; href: string }[];
}

function Dropdown({ label, items }: DropdownProps) {
  return (
    <div className="group relative">
      <button className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
        {label}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
      </button>
      <div className="invisible absolute left-0 top-full z-50 min-w-[180px] rounded-xl border border-slate-200 bg-white py-2 shadow-lg group-hover:visible">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

interface Props {
  variant?: "default" | "transparent";
}

export default function MarketingHeader({ variant = "default" }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
  const nav = NAV[language as keyof typeof NAV] ?? NAV.en;
  const border = variant === "transparent" ? "border-transparent" : "border-slate-100";

  return (
    <header className={`border-b ${border} relative z-40 bg-white`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-base font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>Sama AI</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Dropdown label={nav.platform} items={nav.platformItems} />
          <Dropdown label={nav.useCases} items={nav.useCaseItems} />
          <Dropdown label={nav.resources} items={nav.resourceItems} />
          <Link
            href="/c/pricing"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            {nav.pricing}
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => setLanguage(language === "sv" ? "en" : "sv")}
            className="hidden rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50 md:block"
            aria-label="Toggle language"
          >
            {language === "sv" ? "EN" : "SV"}
          </button>
          <Link
            href="/c/login"
            className="hidden items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex sm:px-4 sm:py-2"
          >
            <LogIn className="h-4 w-4" />
            {nav.signIn}
          </Link>
          <Link
            href="/audit"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 sm:px-4 sm:py-2"
          >
            {nav.cta}
          </Link>
          {/* Mobile menu toggle */}
          <button
            className="md:hidden rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 md:hidden">
          <div className="mt-2 space-y-1">
            <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {nav.platform}
            </p>
            {nav.platformItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <p className="px-2 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {nav.useCases}
            </p>
            {nav.useCaseItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <p className="px-2 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {nav.resources}
            </p>
            {nav.resourceItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-3 flex items-center gap-2">
              <button
                onClick={() => setLanguage(language === "sv" ? "en" : "sv")}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500"
              >
                {language === "sv" ? "Switch to EN" : "Byt till SV"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
