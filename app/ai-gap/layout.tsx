import type { Metadata } from "next";

const BASE_URL = "https://sama.successifier.com";

export const metadata: Metadata = {
  title: "The AI Gap — Why Businesses Are Missing AI Citations | Sama AI",
  description:
    "Discover the AI visibility gap: why most businesses are invisible to AI assistants like ChatGPT and Perplexity, and how Generative Engine Optimization closes the gap.",
  alternates: {
    canonical: `${BASE_URL}/ai-gap`,
  },
  openGraph: {
    title: "The AI Gap — Why Businesses Are Missing AI Citations",
    description:
      "Most businesses are invisible to AI assistants. Learn why and how to fix it with GEO.",
    url: `${BASE_URL}/ai-gap`,
    type: "website",
  },
};

export default function AiGapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
