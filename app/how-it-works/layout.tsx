import type { Metadata } from "next";

const BASE_URL = "https://sama.successifier.com";

export const metadata: Metadata = {
  title: "How Sama AI Works — GEO & SEO Automation Pipeline",
  description:
    "See how Sama AI's 5-pillar pipeline works: AI visibility audit, keyword discovery, content creation, technical fixes and automated publishing.",
  alternates: {
    canonical: `${BASE_URL}/how-it-works`,
  },
  openGraph: {
    title: "How Sama AI Works — GEO & SEO Automation Pipeline",
    description:
      "Discover the 5-pillar pipeline that helps your business get cited by AI assistants.",
    url: `${BASE_URL}/how-it-works`,
    type: "website",
  },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
