"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/hooks/useLanguage";

const FOOTER = {
  sv: {
    tagline:
      "AI har ätit upp sökmotorn. Vi ser till att ert företag är det ChatGPT, Perplexity och Google AI rekommenderar.",
    columns: [
      {
        heading: "Plattformen",
        links: [
          { label: "AI-synlighet (GEO)", href: "/platform/ai-visibility" },
          { label: "SEO + Google", href: "/platform/seo" },
          { label: "Content", href: "/platform/content" },
          { label: "Tech", href: "/platform/tech" },
          { label: "Ads", href: "/platform/ads" },
          { label: "Social", href: "/platform" },
        ],
      },
      {
        heading: "Användningsområden",
        links: [
          { label: "B2B SaaS", href: "/use-cases/saas" },
          { label: "E-handel", href: "/use-cases/ecommerce" },
          { label: "Byråer", href: "/use-cases/agencies" },
          { label: "Lokala företag", href: "/use-cases/local-business" },
          { label: "Konsultbolag", href: "/use-cases/consulting" },
          { label: "Media", href: "/use-cases/media" },
        ],
      },
      {
        heading: "Resurser & Juridiskt",
        links: [
          { label: "Blogg", href: "/blog" },
          { label: "AI Gap", href: "/ai-gap" },
          { label: "Vanliga frågor", href: "/faq" },
          { label: "Om oss", href: "/about" },
          { label: "Integrationer", href: "/integrations" },
          { label: "Villkor", href: "/c/legal/terms" },
          { label: "Integritetspolicy", href: "/c/legal/privacy" },
          { label: "DPA", href: "/c/legal/dpa" },
        ],
      },
    ],
    rights: "Alla rättigheter förbehållna.",
  },
  en: {
    tagline:
      "AI has eaten search. We make sure your business is the one ChatGPT, Perplexity and Google AI mention when customers ask.",
    columns: [
      {
        heading: "Platform",
        links: [
          { label: "AI Visibility (GEO)", href: "/platform/ai-visibility" },
          { label: "SEO + Google", href: "/platform/seo" },
          { label: "Content", href: "/platform/content" },
          { label: "Tech", href: "/platform/tech" },
          { label: "Ads", href: "/platform/ads" },
          { label: "Social", href: "/platform" },
        ],
      },
      {
        heading: "Use Cases",
        links: [
          { label: "B2B SaaS", href: "/use-cases/saas" },
          { label: "E-commerce", href: "/use-cases/ecommerce" },
          { label: "Agencies", href: "/use-cases/agencies" },
          { label: "Local Business", href: "/use-cases/local-business" },
          { label: "Consulting", href: "/use-cases/consulting" },
          { label: "Media", href: "/use-cases/media" },
        ],
      },
      {
        heading: "Resources & Legal",
        links: [
          { label: "Blog", href: "/blog" },
          { label: "AI Gap", href: "/ai-gap" },
          { label: "FAQ", href: "/faq" },
          { label: "About", href: "/about" },
          { label: "Integrations", href: "/integrations" },
          { label: "Terms", href: "/c/legal/terms" },
          { label: "Privacy Policy", href: "/c/legal/privacy" },
          { label: "DPA", href: "/c/legal/dpa" },
        ],
      },
    ],
    rights: "All rights reserved.",
  },
};

export default function MarketingFooter() {
  const { language } = useLanguage();
  const f = FOOTER[language as keyof typeof FOOTER] ?? FOOTER.en;
  const year = new Date().getFullYear();

  return (
    <footer className="mkt-footer">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-4">
        {/* Brand column */}
        <div>
          <Link href="/" className="flex items-center gap-2 text-base font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "linear-gradient(135deg, var(--neon-orange), var(--neon-purple))" }}>
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <span className="mkt-logo-glow">Sama AI</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm" style={{ color: "var(--text-muted)" }}>{f.tagline}</p>
        </div>

        {/* Link columns */}
        {f.columns.map((col) => (
          <div key={col.heading}>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--neon-orange)" }}>
              {col.heading}
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="mkt-footer-link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t" style={{ borderColor: "var(--border-color)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs sm:px-6" style={{ color: "var(--text-muted)" }}>
          <span>© {year} Successifier. {f.rights}</span>
        </div>
      </div>
    </footer>
  );
}
