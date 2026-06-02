import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "AI Visibility (GEO) — Win the AI Answers",
  description:
    "Track how your brand appears across ChatGPT, Perplexity, Claude, Google AI Overviews, Gemini and Copilot — with weekly competitor comparison.",
  path: "/platform/ai-visibility",
});

export default function AiVisibilityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Platform", path: "/platform" },
          { name: "AI Visibility (GEO)", path: "/platform/ai-visibility" },
        ])}
      />
      {children}
    </>
  );
}
