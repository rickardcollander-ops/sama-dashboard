import type { Metadata } from "next";

const BASE_URL = "https://sama.successifier.com";

export const metadata: Metadata = {
  title: "About Sama AI — Our Mission & Vision",
  description:
    "Sama AI was built to close the AI citation gap. Learn about our mission to help every business get found and cited by AI assistants like ChatGPT, Perplexity, and Google AI Overviews.",
  alternates: {
    canonical: `${BASE_URL}/about`,
  },
  openGraph: {
    title: "About Sama AI — Our Mission & Vision",
    description:
      "Learn about the team and mission behind Sama AI — the leading Generative Engine Optimization platform.",
    url: `${BASE_URL}/about`,
    type: "website",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
