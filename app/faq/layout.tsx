import type { Metadata } from "next";

const BASE_URL = "https://sama.successifier.com";

export const metadata: Metadata = {
  title: "FAQ — Common Questions About Sama AI",
  description:
    "Frequently asked questions about Sama AI's GEO and SEO platform, pricing, integrations, and how it helps businesses get cited by AI assistants like ChatGPT and Perplexity.",
  alternates: {
    canonical: `${BASE_URL}/faq`,
  },
  openGraph: {
    title: "FAQ — Common Questions About Sama AI",
    description:
      "Get answers to frequently asked questions about Sama AI's Generative Engine Optimization platform.",
    url: `${BASE_URL}/faq`,
    type: "website",
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
