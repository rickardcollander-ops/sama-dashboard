import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "Content — Articles That Rank and Get Cited",
  description:
    "AI-drafted articles in your brand voice, built on citation best practices and published to WordPress, Shopify, Webflow, Ghost or a GitHub PR.",
  path: "/platform/content",
});

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Platform", path: "/platform" },
          { name: "Content", path: "/platform/content" },
        ])}
      />
      {children}
    </>
  );
}
