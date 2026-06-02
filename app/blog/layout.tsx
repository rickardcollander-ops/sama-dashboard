import type { Metadata } from "next";

const BASE_URL = "https://sama.successifier.com";

export const metadata: Metadata = {
  title: "Blog — GEO & SEO Insights by Sama AI",
  description:
    "Expert articles on Generative Engine Optimization, AI visibility and SEO strategies — and how to get your business cited by ChatGPT and Perplexity.",
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
  openGraph: {
    title: "Blog — GEO & SEO Insights by Sama AI",
    description:
      "Expert articles on GEO, AI visibility, and SEO strategies from the Sama AI team.",
    url: `${BASE_URL}/blog`,
    type: "website",
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
