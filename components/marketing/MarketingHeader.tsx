"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, LogIn, Menu, X } from "lucide-react";
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
      <button className="mkt-nav-link flex items-center gap-1">
        {label}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
      </button>
      <div className="mkt-dropdown-panel absolute left-0 top-full min-w-[200px]">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="mkt-dropdown-item">
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

  return (
    <header className={`mkt-header ${variant === "transparent" ? "border-transparent" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "linear-gradient(135deg, var(--neon-orange), var(--neon-purple))" }}>
            <span className="text-sm">✨</span>
          </span>
          <span className="mkt-logo-glow">Sama AI</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
          <Dropdown label={nav.platform} items={nav.platformItems} />
          <Dropdown label={nav.useCases} items={nav.useCaseItems} />
          <Dropdown label={nav.resources} items={nav.resourceItems} />
          <Link href="/c/pricing" className="mkt-nav-link">
            {nav.pricing}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(language === "sv" ? "en" : "sv")}
            className="mkt-lang-btn hidden md:block"
            aria-label="Toggle language"
          >
            {language === "sv" ? "EN" : "SV"}
          </button>
          <Link href="/c/login" className="mkt-signin-btn hidden sm:inline-flex items-center gap-1.5">
            <LogIn className="h-4 w-4" />
            {nav.signIn}
          </Link>
          <Link href="/audit" className="mkt-audit-btn">
            {nav.cta}
          </Link>
          <button
            className="rounded-md p-1.5 md:hidden"
            style={{ color: "var(--text-secondary)" }}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="border-t px-4 pb-4 md:hidden"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
        >
          <div className="mt-2 space-y-1">
            <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {nav.platform}
            </p>
            {nav.platformItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-2 py-1.5 text-sm"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <p className="px-2 pt-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {nav.useCases}
            </p>
            {nav.useCaseItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-2 py-1.5 text-sm"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <p className="px-2 pt-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {nav.resources}
            </p>
            {nav.resourceItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-2 py-1.5 text-sm"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/c/pricing"
              className="mt-3 block rounded-md px-2 py-1.5 text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
              onClick={() => setMobileOpen(false)}
            >
              {nav.pricing}
            </Link>
            <Link
              href="/c/login"
              className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
              onClick={() => setMobileOpen(false)}
            >
              <LogIn className="h-4 w-4" />
              {nav.signIn}
            </Link>
            <div className="pt-3 flex items-center gap-2">
              <button
                onClick={() => setLanguage(language === "sv" ? "en" : "sv")}
                className="mkt-lang-btn"
              >
                {language === "sv" ? "Switch to EN" : "Byt till SV"}
              </button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
