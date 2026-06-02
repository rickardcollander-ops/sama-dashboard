import type { Metadata } from "next";

const BASE_URL = "https://sama.successifier.com";

export const metadata: Metadata = {
  title: "Free AI & SEO Audit — Analyze Your Site",
  description:
    "Get a free instant audit of your website's AI visibility, SEO health and GEO readiness — see how your site appears to ChatGPT and what to fix first.",
  alternates: {
    canonical: `${BASE_URL}/audit`,
  },
  openGraph: {
    title: "Free AI & SEO Audit — Analyze Your Site",
    description:
      "Instant audit of your site's AI visibility, SEO health, and GEO readiness. Free, no account needed.",
    url: `${BASE_URL}/audit`,
    type: "website",
  },
};

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
